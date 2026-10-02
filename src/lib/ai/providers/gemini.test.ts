import { afterEach, expect, it, vi } from 'vitest';
import { generateGemini } from './gemini';

const args = {
  apiKey: 'test',
  model: 'gemini-3.5-flash',
  systemPrompt: 'Reply concisely.',
  messages: [{ role: 'user' as const, content: 'Precios' }],
  timeoutMs: 30000,
};
const response = (text: string, finishReason = 'STOP') =>
  Response.json({
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
  });
afterEach(() => vi.unstubAllGlobals());

it('regenerates a truncated answer rather than returning the fragment', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(response('Corte: S/', 'MAX_TOKENS'))
    .mockResolvedValueOnce(response('Corte: S/ 20.'));
  vi.stubGlobal('fetch', fetchMock);
  expect((await generateGemini(args)).text).toBe('Corte: S/ 20.');
  const first = JSON.parse(fetchMock.mock.calls[0][1].body);
  const retry = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(first.generationConfig).toEqual({
    maxOutputTokens: 8192,
    thinkingConfig: { thinkingLevel: 'low' },
  });
  expect(retry.generationConfig.maxOutputTokens).toBe(16384);
});

it('rejects an answer still truncated after the bounded retry', async () => {
  const fetchMock = vi
    .fn()
    .mockImplementation(async () => response('Corte: S/', 'MAX_TOKENS'));
  vi.stubGlobal('fetch', fetchMock);
  await expect(generateGemini(args)).rejects.toMatchObject({
    code: 'truncated_response',
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('does not expose thinking text and keeps line breaks', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  { text: 'Internal thought', thought: true },
                  { text: 'Servicios:\n• Corte: S/ 20.\n• Barba: S/ 15.' },
                ],
              },
            },
          ],
        })
      )
  );
  expect((await generateGemini(args)).text).toBe(
    'Servicios:\n• Corte: S/ 20.\n• Barba: S/ 15.'
  );
});

it('uses the supported thinking budget for Gemini 2.5 Flash', async () => {
  const fetchMock = vi.fn().mockResolvedValue(response('Hola.'));
  vi.stubGlobal('fetch', fetchMock);
  await generateGemini({ ...args, model: 'gemini-2.5-flash' });
  expect(
    JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.thinkingConfig
  ).toEqual({ thinkingBudget: 0 });
});
