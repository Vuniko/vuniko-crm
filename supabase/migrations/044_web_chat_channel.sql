-- 044_web_chat_channel.sql
-- Adds a first-party web chat channel without changing the existing WhatsApp transport.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp'
  CHECK (channel IN ('whatsapp', 'web'));

CREATE INDEX IF NOT EXISTS idx_conversations_account_channel
  ON conversations(account_id, channel, last_message_at DESC);

CREATE TABLE IF NOT EXISTS web_chat_widgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_key UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  name TEXT NOT NULL DEFAULT 'Website chat',
  welcome_message TEXT NOT NULL DEFAULT 'Hi! How can we help?',
  accent_color TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_web_chat_widgets_account
  ON web_chat_widgets(account_id);

ALTER TABLE web_chat_widgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view web chat widget" ON web_chat_widgets;
DROP POLICY IF EXISTS "Account admins can manage web chat widget" ON web_chat_widgets;

CREATE POLICY "Account members can view web chat widget"
  ON web_chat_widgets FOR SELECT
  USING (is_account_member(account_id, 'viewer'));

CREATE POLICY "Account admins can manage web chat widget"
  ON web_chat_widgets FOR ALL
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON web_chat_widgets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON web_chat_widgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS web_chat_visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  widget_id UUID NOT NULL REFERENCES web_chat_widgets(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  visitor_token_hash TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(widget_id, visitor_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_web_chat_visitors_account
  ON web_chat_visitors(account_id);

ALTER TABLE web_chat_visitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view web chat visitors" ON web_chat_visitors;
CREATE POLICY "Account members can view web chat visitors"
  ON web_chat_visitors FOR SELECT
  USING (is_account_member(account_id, 'viewer'));
