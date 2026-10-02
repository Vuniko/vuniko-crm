-- Booking requests captured by the VUNIKO web assistant.
-- These are requests, not confirmed appointments: availability must be verified by the business.
CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  service text,
  requested_date text,
  requested_time text,
  customer_name text,
  customer_phone text,
  status text NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting','pending_confirmation','confirmed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS booking_requests_account_status_idx
  ON public.booking_requests(account_id, status, created_at DESC);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view booking requests"
ON public.booking_requests FOR SELECT
USING (public.is_account_member(account_id, 'viewer'));

CREATE POLICY "Account members can manage booking requests"
ON public.booking_requests FOR ALL
USING (public.is_account_member(account_id, 'member'))
WITH CHECK (public.is_account_member(account_id, 'member'));
