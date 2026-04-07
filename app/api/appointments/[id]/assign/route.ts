import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const assignEmployeesSchema = z
  .object({
    employee_ids: z.array(z.string().uuid()),
  })
  .strict()

type RouteContext = {
  params: {
    id: string
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function POST(request: Request, { params }: RouteContext) {
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

  const parsed = assignEmployeesSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from('appointment_employees')
    .delete()
    .eq('appointment_id', params.id)

  if (deleteError) {
    console.error('Failed to clear existing appointment assignments', deleteError)
    return serverError()
  }

  if (parsed.data.employee_ids.length > 0) {
    const { error: insertError } = await supabase.from('appointment_employees').insert(
      parsed.data.employee_ids.map((employeeId) => ({
        appointment_id: params.id,
        employee_id: employeeId,
      })),
    )

    if (insertError) {
      console.error('Failed to insert appointment assignments', insertError)
      return serverError()
    }
  }

  const { data: assignments, error: readError } = await supabase
    .from('appointment_employees')
    .select('appointment_id, employee_id, profiles!appointment_employees_employee_id_fkey(id, full_name)')
    .eq('appointment_id', params.id)

  if (readError) {
    console.error('Failed to fetch updated appointment assignments', readError)
    return serverError()
  }

  return jsonResponse(assignments ?? [], 200)
}