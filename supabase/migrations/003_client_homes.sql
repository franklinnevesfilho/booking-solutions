-- Migration: Add client_homes table and link appointments to homes

CREATE TABLE IF NOT EXISTS public.client_homes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label TEXT,
  street TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_homes_client_id
  ON public.client_homes(client_id);

CREATE INDEX IF NOT EXISTS idx_client_homes_primary
  ON public.client_homes(client_id, is_primary);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_updated_at_client_homes'
      AND tgrelid = 'public.client_homes'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_client_homes
      BEFORE UPDATE ON public.client_homes
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS home_id UUID REFERENCES public.client_homes(id) ON DELETE SET NULL;

INSERT INTO public.client_homes (
  client_id,
  label,
  street,
  city,
  state,
  postal_code,
  country,
  is_primary
)
SELECT
  c.id,
  'Primary',
  c.address,
  '',
  '',
  '',
  '',
  true
FROM public.clients c
WHERE c.address IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.client_homes ch
    WHERE ch.client_id = c.id
      AND ch.is_primary = true
  );

UPDATE public.appointments a
SET home_id = ch.id
FROM public.client_homes ch
WHERE ch.client_id = a.client_id
  AND ch.is_primary = true
  AND a.home_id IS NULL;

ALTER TABLE public.client_homes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_homes_admin_all" ON public.client_homes
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "client_homes_employee_select" ON public.client_homes
  FOR SELECT USING (
    public.current_user_role() = 'employee' AND
    EXISTS (
      SELECT 1
      FROM public.appointments a
      JOIN public.appointment_employees ae ON ae.appointment_id = a.id
      WHERE a.home_id = client_homes.id
        AND ae.employee_id = auth.uid()
    )
  );
