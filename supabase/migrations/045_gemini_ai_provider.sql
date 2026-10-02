-- 045_gemini_ai_provider.sql
-- Allow Gemini as a first-class BYO-key AI provider.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'ai_configs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%provider%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ai_configs DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE ai_configs
  ADD CONSTRAINT ai_configs_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'gemini'));
