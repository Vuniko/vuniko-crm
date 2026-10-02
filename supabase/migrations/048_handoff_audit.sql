-- 048_handoff_audit.sql
-- Lightweight ownership audit for AI ↔ human transitions.

CREATE TABLE IF NOT EXISTS conversation_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event TEXT NOT NULL CHECK (event IN ('customer_requested_human','human_took_over','ai_resumed','ai_handoff')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversation_handoffs_conversation_idx ON conversation_handoffs(conversation_id, created_at DESC);
ALTER TABLE conversation_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_handoffs_select ON conversation_handoffs FOR SELECT USING (is_account_member(account_id));
CREATE POLICY conversation_handoffs_insert ON conversation_handoffs FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
