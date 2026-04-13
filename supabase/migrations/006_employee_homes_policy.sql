-- Allow employees to read homes that are assigned to their appointments
CREATE POLICY "homes_employee_select" ON public.homes
  FOR SELECT USING (
    public.current_user_role() = 'employee' AND
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.appointment_employees ae ON ae.appointment_id = a.id
      WHERE a.home_id = homes.id AND ae.employee_id = auth.uid()
    )
  );
