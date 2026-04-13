-- Allow employees to read clients associated with their assigned appointments
CREATE POLICY "clients_employee_select" ON public.clients
  FOR SELECT USING (
    public.current_user_role() = 'employee' AND
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.appointment_employees ae ON ae.appointment_id = a.id
      WHERE a.client_id = clients.id
        AND ae.employee_id = auth.uid()
    )
  );