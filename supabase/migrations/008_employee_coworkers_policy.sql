-- Drop existing policies for idempotency (safe to re-run).
DROP POLICY IF EXISTS "appt_employees_coworker_select" ON public.appointment_employees;
DROP POLICY IF EXISTS "profiles_coworker_select" ON public.profiles;

-- Drop existing helper for idempotency before (re-)creating it.
DROP FUNCTION IF EXISTS public.get_appointment_ids_for_user(uuid);

-- Returns all appointment_ids the given user is assigned to.
--
-- SECURITY DEFINER: executes as the function owner, not the calling user.
-- This means Postgres does NOT apply RLS when the function body reads
-- appointment_employees, breaking the self-referential loop that occurs when
-- a policy on appointment_employees queries appointment_employees directly.
--
-- SET search_path = public: prevents search_path injection (OWASP requirement).
CREATE OR REPLACE FUNCTION public.get_appointment_ids_for_user(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT appointment_id
  FROM public.appointment_employees
  WHERE employee_id = uid;
$$;

-- Allow employees to see all appointment_employee rows for appointments they are
-- assigned to. Uses the SECURITY DEFINER helper to avoid self-referential recursion.
CREATE POLICY "appt_employees_coworker_select" ON public.appointment_employees
  FOR SELECT USING (
    public.current_user_role() = 'employee' AND
    appointment_id IN (SELECT public.get_appointment_ids_for_user(auth.uid()))
  );

-- Allow employees to see profiles of co-workers on their shared appointments.
-- Without this, profiles_select blocks access to any profile other than auth.uid().
-- Uses the same helper to avoid cascading recursion through appointment_employees
-- policies when this policy's subquery reads that table.
CREATE POLICY "profiles_coworker_select" ON public.profiles
  FOR SELECT USING (
    public.current_user_role() = 'employee' AND
    EXISTS (
      SELECT 1
      FROM public.appointment_employees ae
      WHERE ae.employee_id = profiles.id
        AND ae.appointment_id IN (SELECT public.get_appointment_ids_for_user(auth.uid()))
    )
  );
