-- Allow invoices to remain after an appointment is deleted (appointment_id set to NULL)
ALTER TABLE public.invoices
  DROP CONSTRAINT invoices_appointment_id_fkey;

ALTER TABLE public.invoices
  ALTER COLUMN appointment_id DROP NOT NULL;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_appointment_id_fkey
    FOREIGN KEY (appointment_id)
    REFERENCES public.appointments(id)
    ON DELETE SET NULL;