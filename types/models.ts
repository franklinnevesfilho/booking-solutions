export type Role = 'admin' | 'employee'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ClientHome {
  id: string
  client_id: string
  label: string | null
  street: string
  city: string
  state: string
  postal_code: string
  country: string
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  name: string
  description: string | null
  default_price_per_hour: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  appointment_id: string
  amount_charged: number
  discount_amount: number
  discount_reason: string | null
  is_paid: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  client_id: string | null
  home_id: string | null
  job_id: string | null
  title: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  notes: string | null
  recurrence_series_id: string | null
  recurrence_rule: string | null
  is_master: boolean
  created_at: string
  updated_at: string
}

export interface AppointmentEmployee {
  appointment_id: string
  employee_id: string
}