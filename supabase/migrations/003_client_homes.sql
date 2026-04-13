-- Migration: Add homes table and link appointments to homes

CREATE TABLE IF NOT EXISTS public.homes (
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

CREATE INDEX IF NOT EXISTS idx_homes_client_id
  ON public.homes(client_id);

CREATE INDEX IF NOT EXISTS idx_homes_primary
  ON public.homes(client_id, is_primary);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_updated_at_homes'
      AND tgrelid = 'public.homes'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_homes
      BEFORE UPDATE ON public.homes
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS home_id UUID REFERENCES public.homes(id) ON DELETE SET NULL;

INSERT INTO public.homes (
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
    FROM public.homes ch
    WHERE ch.client_id = c.id
      AND ch.is_primary = true
  );

UPDATE public.appointments a
SET home_id = ch.id
FROM public.homes ch
WHERE ch.client_id = a.client_id
  AND ch.is_primary = true
  AND a.home_id IS NULL;

ALTER TABLE public.homes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homes_admin_all" ON public.homes
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "homes_employee_select" ON public.homes
  FOR SELECT USING (
    public.current_user_role() = 'employee' AND
    EXISTS (
      SELECT 1
      FROM public.appointments a
      JOIN public.appointment_employees ae ON ae.appointment_id = a.id
      WHERE a.home_id = homes.id
        AND ae.employee_id = auth.uid()
    )
  );
