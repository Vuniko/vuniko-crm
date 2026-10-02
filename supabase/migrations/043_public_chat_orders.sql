-- Public web chat sessions and orders. Writes are performed only by the
-- server-side service-role client; browser roles intentionally have no policy.
CREATE TABLE IF NOT EXISTS public_chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  visitor_token TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  cart JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public_chat_sessions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','confirmed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_chat_sessions_account ON public_chat_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_public_chat_messages_session ON public_chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_public_orders_account ON public_orders(account_id, created_at);

ALTER TABLE public_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_orders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON public_chat_sessions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
