-- Add Google Gemini as a supported BYO-key AI provider.
-- Existing OpenAI and Anthropic configurations remain valid.

ALTER TABLE ai_configs
  DROP CONSTRAINT IF EXISTS ai_configs_provider_check;

ALTER TABLE ai_configs
  ADD CONSTRAINT ai_configs_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'gemini'));
