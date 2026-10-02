-- 046_business_profile_and_web_leads.sql
-- Structured business context, progressive web lead capture, and intent classification.

CREATE TABLE IF NOT EXISTS business_profiles (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  location_text TEXT NOT NULL DEFAULT '',
  business_hours TEXT NOT NULL DEFAULT '',
  services TEXT NOT NULL DEFAULT '',
  pricing TEXT NOT NULL DEFAULT '',
  faqs TEXT NOT NULL DEFAULT '',
  policies TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view business profile" ON business_profiles;
DROP POLICY IF EXISTS "Admins can manage business profile" ON business_profiles;
CREATE POLICY "Members can view business profile" ON business_profiles FOR SELECT
  USING (is_account_member(account_id, 'viewer'));
CREATE POLICY "Admins can manage business profile" ON business_profiles FOR ALL
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

ALTER TABLE web_chat_visitors
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS lead_capture_completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS lead_intent TEXT,
  ADD COLUMN IF NOT EXISTS lead_intent_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS lead_intent_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_account_lead_intent
  ON conversations(account_id, lead_intent);
