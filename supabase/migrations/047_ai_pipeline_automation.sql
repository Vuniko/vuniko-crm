-- 047_ai_pipeline_automation.sql
-- Track AI-created opportunities and prevent duplicate deals per conversation.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_intent TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS deals_open_conversation_unique
  ON deals(conversation_id)
  WHERE conversation_id IS NOT NULL AND status = 'open';
