-- Migration: Enforce at-most-one primary home per client at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_homes_one_primary
  ON public.homes (client_id)
  WHERE is_primary = true;
