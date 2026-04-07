-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_employees ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
-- Users can read their own profile; admins can read all
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR public.current_user_role() = 'admin'
  );

-- Admins can update any profile; users can update their own
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid() OR public.current_user_role() = 'admin'
  );

-- Only admins can insert (new profiles are created by trigger)
-- No explicit insert policy needed for direct inserts; trigger handles it

-- CLIENTS
-- Only admins can read/write clients
CREATE POLICY "clients_admin_all" ON public.clients
  FOR ALL USING (public.current_user_role() = 'admin');

-- APPOINTMENTS
-- Admins can read/write all appointments
CREATE POLICY "appointments_admin_all" ON public.appointments
  FOR ALL USING (public.current_user_role() = 'admin');

-- Employees can read appointments they are assigned to
CREATE POLICY "appointments_employee_select" ON public.appointments
  FOR SELECT USING (
    public.current_user_role() = 'employee' AND
    EXISTS (
      SELECT 1 FROM public.appointment_employees ae
      WHERE ae.appointment_id = appointments.id
        AND ae.employee_id = auth.uid()
    )
  );

-- APPOINTMENT_EMPLOYEES
-- Admins can manage all
CREATE POLICY "appt_employees_admin_all" ON public.appointment_employees
  FOR ALL USING (public.current_user_role() = 'admin');

-- Employees can read their own assignment rows
CREATE POLICY "appt_employees_employee_select" ON public.appointment_employees
  FOR SELECT USING (
    public.current_user_role() = 'employee' AND employee_id = auth.uid()
  );
