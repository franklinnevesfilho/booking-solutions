import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, notFound, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{
    id: string
    homeId: string
  }>
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
    headers: { 'Content-Type': 'application/json' },
  })
}

function validationError(parsed: z.SafeParseError<unknown>): Response {
  const flattened = parsed.error.flatten()
  console.error('Validation failed:', JSON.stringify(flattened, null, 2))
  return jsonResponse(
    {
      error: 'Validation failed',
      fieldErrors: flattened.fieldErrors,
      formErrors: flattened.formErrors,
    },
    400
  )
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id, homeId } = await params
  console.log('PATCH /api/clients/:id/homes/:homeId — params:', { id, homeId })

  const session = await getSessionAndRole(request)
  console.log('Session:', session)

  if (!session || session.role !== 'admin') {
    console.warn('Forbidden — session:', session)
    return forbidden()
  }

  let body: unknown

  try {
    body = await request.json()
  } catch (err) {
    console.error('Failed to parse JSON body:', err)
    return badRequest('Invalid JSON body')
  }

  console.log('Request body:', JSON.stringify(body, null, 2))

  const parsed = updateHomeSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed)
  }

  if (Object.keys(parsed.data).length === 0) {
    console.warn('No fields to update')
    return badRequest('No fields to update')
  }

  console.log('Parsed data:', parsed.data)

  const supabase = await createClient()

  if (parsed.data.is_primary === true) {
    console.log('Unsetting other primary homes for client:', id, 'excluding home:', homeId)

    const { error: unsetPrimaryError } = await supabase
      .from('homes')
      .update({ is_primary: false })
      .eq('client_id', id)
      .neq('id', homeId)
      .eq('is_primary', true)

    if (unsetPrimaryError) {
      console.error('Failed to unset other primary homes:', {
        message: unsetPrimaryError.message,
        code: unsetPrimaryError.code,
        details: unsetPrimaryError.details,
        hint: unsetPrimaryError.hint,
      })
      return serverError()
    }
  }

  const { data, error } = await supabase
    .from('homes')
    .update(parsed.data)
    .eq('id', homeId)
    .eq('client_id', id)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn('Home not found — homeId:', homeId, 'clientId:', id)
      return notFound()
    }

    console.error('Failed to update client home:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeId,
      clientId: id,
      updateData: parsed.data,
    })
    return jsonResponse(
      { error: 'Database error', message: error.message, code: error.code, hint: error.hint ?? null },
      500
    )
  }

  console.log('Successfully updated home:', data)
  return jsonResponse(data, 200)
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id, homeId } = await params
  console.log('DELETE /api/clients/:id/homes/:homeId — params:', { id, homeId })

  const session = await getSessionAndRole(request)
  console.log('Session:', session)

  if (!session || session.role !== 'admin') {
    console.warn('Forbidden — session:', session)
    return forbidden()
  }

  const supabase = await createClient()

  console.log('Checking upcoming appointments for home:', homeId)

  const { count, error: countError } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .gt('start_time', new Date().toISOString())
    .neq('status', 'cancelled')

  if (countError) {
    console.error('Failed to check upcoming appointments:', {
      message: countError.message,
      code: countError.code,
      details: countError.details,
      hint: countError.hint,
      homeId,
    })
    return serverError()
  }

  console.log('Upcoming appointment count for home:', homeId, '→', count)

  if ((count ?? 0) > 0) {
    console.warn('Blocking delete — home has upcoming appointments:', { homeId, count })
    return badRequest('Cannot delete a home with upcoming appointments. Reassign or cancel them first.')
  }

  const { error } = await supabase
    .from('homes')
    .delete()
    .eq('id', homeId)
    .eq('client_id', id)

  if (error) {
    console.error('Failed to delete client home:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeId,
      clientId: id,
    })
    return jsonResponse(
      { error: 'Database error', message: error.message, code: error.code, hint: error.hint ?? null },
      500
    )
  }

  console.log('Successfully deleted home:', homeId)
  return jsonResponse({ success: true }, 200)
}