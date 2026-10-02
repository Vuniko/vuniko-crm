import { AiError, type ProviderResult } from '../types';
import {
  mergeConsecutive,
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared';

interface GeminiResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [250, 700];
// Gemini shares the output budget with thinking. A 600-token cap can leave
// only a few words for the answer. Concision is controlled by the prompt.
const GEMINI_OUTPUT_TOKENS = 8192;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestGemini(
  args: ProviderArgs,
  maxOutputTokens = GEMINI_OUTPUT_TOKENS
): Promise<Response> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: mergeConsecutive(messages).map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          maxOutputTokens,
          ...(/^gemini-3[.\-]/.test(model)
            ? { thinkingConfig: { thinkingLevel: 'low' } }
            : /^gemini-2\.5-flash(?:-|$)/.test(model)
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw toNetworkError(err);
  }
}

export async function generateGemini(
  args: ProviderArgs
): Promise<ProviderResult> {
  let res = await requestGemini(args);

  for (
    let attempt = 0;
    !res.ok &&
    RETRYABLE_STATUSES.has(res.status) &&
    attempt < RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    // Consume the failed response before retrying so the connection can be reused.
    await res.text().catch(() => undefined);
    await sleep(RETRY_DELAYS_MS[attempt]);
    res = await requestGemini(args);
  }

  if (!res.ok) throw await providerHttpError('Gemini', res);

  let data = (await res.json().catch(() => null)) as GeminiResponse | null;
  if (data?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    // Regenerate once with more room; never save a partial answer as complete.
    console.warn(
      '[Gemini] output limit reached; retrying with a larger budget'
    );
    res = await requestGemini(args, GEMINI_OUTPUT_TOKENS * 2);
    if (!res.ok) throw await providerHttpError('Gemini', res);
    data = (await res.json().catch(() => null)) as GeminiResponse | null;
  }
  if (data?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    throw new AiError('Gemini response exceeded the output limit.', {
      code: 'truncated_response',
    });
  }
  const text = data?.candidates?.[0]?.content?.parts
    ?.filter((part) => !part.thought)
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new AiError('Gemini returned an empty response.', {
      code: 'empty_response',
    });
  }

  const usage = normalizeUsage({
    prompt: data?.usageMetadata?.promptTokenCount,
    completion: data?.usageMetadata?.candidatesTokenCount,
    total: data?.usageMetadata?.totalTokenCount,
  });
  return { text, usage };
}
