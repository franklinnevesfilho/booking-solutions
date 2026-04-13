CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_price_per_hour numeric(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ADD COLUMN job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;
CREATE INDEX idx_appointments_job_id ON public.appointments(job_id);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  amount_charged numeric(10,2) NOT NULL,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  discount_reason text,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_invoices_appointment_id ON public.invoices(appointment_id);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_admin_all" ON public.jobs
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "jobs_employee_admin_select" ON public.jobs
  FOR SELECT USING (public.current_user_role() IN ('admin', 'employee'));

CREATE POLICY "invoices_admin_all" ON public.invoices
  FOR ALL USING (public.current_user_role() = 'admin');