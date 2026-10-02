-- Business booking availability for VUNIKO.
CREATE TABLE IF NOT EXISTS public.booking_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT true,
  opens_at time NOT NULL DEFAULT '09:00',
  closes_at time NOT NULL DEFAULT '18:00',
  slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 480),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, weekday)
);

CREATE INDEX IF NOT EXISTS booking_availability_account_idx
  ON public.booking_availability(account_id, weekday);

ALTER TABLE public.booking_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view booking availability"
ON public.booking_availability FOR SELECT
USING (public.is_account_member(account_id, 'viewer'));

CREATE POLICY "Account admins can manage booking availability"
ON public.booking_availability FOR ALL
USING (public.is_account_member(account_id, 'admin'))
WITH CHECK (public.is_account_member(account_id, 'admin'));
