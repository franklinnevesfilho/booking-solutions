import type { Appointment, Invoice, Client, ClientHome, Job, Profile } from './models'

export interface ClientWithHomes extends Client {
  client_homes: ClientHome[]
}

export interface AppointmentWithDetails extends Appointment {
  client: Client | null
  home: ClientHome | null
  job: Job | null
  invoice?: Invoice 
  employees: Profile[]
}