import { createClient } from '@supabase/supabase-js'

import type { AppointmentWithDetails } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

function getClient() {
  return createClient(supabaseUrl!, supabaseAnonKey!)
}

async function invokeNotification(
  type: 'created' | 'updated' | 'cancelled',
  appointment: AppointmentWithDetails,
): Promise<void> {
  const supabase = getClient()
  const { error } = await supabase.functions.invoke('send-notification', {
    body: { type, appointment },
  })

  if (error) {
    console.error(`Failed to invoke send-notification (${type}):`, error)
  }
}

export async function notifyAppointmentCreated(appointment: AppointmentWithDetails): Promise<void> {
  await invokeNotification('created', appointment)
}

export async function notifyAppointmentUpdated(appointment: AppointmentWithDetails): Promise<void> {
  await invokeNotification('updated', appointment)
}

export async function notifyAppointmentCancelled(appointment: AppointmentWithDetails): Promise<void> {
  await invokeNotification('cancelled', appointment)
}
