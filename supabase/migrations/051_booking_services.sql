-- Migration 051: booking services catalog
CREATE TABLE IF NOT EXISTS public.booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'PEN',
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 5 AND 480),
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS booking_services_account_active_idx
  ON public.booking_services(account_id, is_active, position);

ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view booking services"
ON public.booking_services FOR SELECT
USING (public.is_account_member(account_id, 'viewer'));

CREATE POLICY "Account admins can manage booking services"
ON public.booking_services FOR ALL
USING (public.is_account_member(account_id, 'admin'))
WITH CHECK (public.is_account_member(account_id, 'admin'));
