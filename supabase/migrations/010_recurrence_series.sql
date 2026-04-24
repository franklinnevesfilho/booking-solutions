-- 1. Create recurrence_series table
CREATE TABLE public.recurrence_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rrule TEXT NOT NULL,
  dtstart TIMESTAMPTZ NOT NULL,
  duration_ms BIGINT NOT NULL,
  horizon_date TIMESTAMPTZ NOT NULL,
  end_condition TEXT NOT NULL DEFAULT 'infinite' CHECK (end_condition IN ('until', 'count', 'infinite')),
  end_date TIMESTAMPTZ,
  max_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add constraint: end_date required when end_condition = 'until', max_count required when 'count'
ALTER TABLE public.recurrence_series
  ADD CONSTRAINT recurrence_series_end_date_required
    CHECK (end_condition != 'until' OR end_date IS NOT NULL),
  ADD CONSTRAINT recurrence_series_max_count_required
    CHECK (end_condition != 'count' OR max_count IS NOT NULL);

-- 3. updated_at trigger
CREATE TRIGGER set_updated_at_recurrence_series
  BEFORE UPDATE ON public.recurrence_series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable RLS
ALTER TABLE public.recurrence_series ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies
CREATE POLICY "recurrence_series_admin_all" ON public.recurrence_series
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "recurrence_series_employee_select" ON public.recurrence_series
  FOR SELECT USING (public.current_user_role() IN ('admin', 'employee'));

-- 6. Populate from existing master appointments
-- Each master appointment with a recurrence_rule becomes a recurrence_series row
-- Use the master's recurrence_series_id as the series row id for consistency
INSERT INTO public.recurrence_series (id, rrule, dtstart, duration_ms, horizon_date, end_condition)
SELECT
  a.recurrence_series_id,
  a.recurrence_rule,
  a.start_time,
  EXTRACT(EPOCH FROM (a.end_time - a.start_time)) * 1000,
  a.start_time + INTERVAL '52 weeks',
  'infinite'
FROM public.appointments a
WHERE a.is_master = true
  AND a.recurrence_rule IS NOT NULL
  AND a.recurrence_series_id IS NOT NULL;

-- Safety pre-check: abort if any appointment has a recurrence_series_id that was not backfilled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.recurrence_series_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.recurrence_series rs WHERE rs.id = a.recurrence_series_id
      )
  ) THEN
    RAISE EXCEPTION 'Orphaned recurrence_series_id values found — backfill is incomplete. Fix data before re-running migration.';
  END IF;
END $$;

-- 7. Add proper FK constraint from appointments to recurrence_series
ALTER TABLE public.appointments
  ADD CONSTRAINT fk_appointments_recurrence_series
    FOREIGN KEY (recurrence_series_id)
    REFERENCES public.recurrence_series(id)
    ON DELETE CASCADE;

-- 8. Add index on recurrence_series for horizon queries (used by extension job)
CREATE INDEX idx_recurrence_series_horizon ON public.recurrence_series(horizon_date);

-- 9. Drop recurrence_rule column from appointments (now lives in recurrence_series)
ALTER TABLE public.appointments DROP COLUMN recurrence_rule;
