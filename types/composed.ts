import type { Appointment, Invoice, Client, ClientHome, Job, Profile } from './models'

export interface ClientWithHomes extends Client {
  homes: ClientHome[]
}

export interface AppointmentWithDetails extends Appointment {
  client: Client | null
  home: ClientHome | null
  job: Job | null
  invoice: Invoice | null
  employees: Profile[]
}

export type InvoiceWithDetails = Invoice & {
  appointment: Pick<Appointment, 'id' | 'title' | 'start_time' | 'end_time'> | null
  client: Pick<Client, 'id' | 'full_name'> | null
  job: Pick<Job, 'id' | 'name'> | null
}