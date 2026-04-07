import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

type RouteContext = {
  params: {
    id: string
    homeId: string
  }
}

const updateHomeSchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    street: z.string().trim().min(1).optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    postal_code: z.string().trim().optional(),
    country: z.string().trim().optional(),
    is_primary: z.boolean().optional(),
  })
  .strict()

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = updateHomeSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  if (Object.keys(parsed.data).length === 0) {
    return badRequest('No fields to update')
  }

  const supabase = await createClient()

  if (parsed.data.is_primary === true) {
    const { error: unsetPrimaryError } = await supabase
      .from('client_homes')
      .update({ is_primary: false })
      .eq('client_id', params.id)
      .neq('id', params.homeId)
      .eq('is_primary', true)

    if (unsetPrimaryError) {
      console.error('Failed to unset other primary homes', unsetPrimaryError)
      return serverError()
    }
  }

  const { data, error } = await supabase
    .from('client_homes')
    .update(parsed.data)
    .eq('id', params.homeId)
    .eq('client_id', params.id)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return notFound()
    }

    console.error('Failed to update client home', error)
    return serverError()
  }

  return jsonResponse(data, 200)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  const supabase = await createClient()

  const { count, error: countError } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('home_id', params.homeId)
    .gt('start_time', new Date().toISOString())
    .neq('status', 'cancelled')

  if (countError) {
    console.error('Failed to check upcoming appointments for home deletion', countError)
    return serverError()
  }

  if ((count ?? 0) > 0) {
    return badRequest('Cannot delete a home with upcoming appointments. Reassign or cancel them first.')
  }

  const { error } = await supabase.from('client_homes').delete().eq('id', params.homeId).eq('client_id', params.id)

  if (error) {
    console.error('Failed to delete client home', error)
    return serverError()
  }

  return jsonResponse({ success: true }, 200)
}
