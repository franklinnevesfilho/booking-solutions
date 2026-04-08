import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const createJobSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().nullable().optional().transform(val => (!val ? null : val)),
  default_price_per_hour: z.coerce.number().positive('Default price must be positive'),
  is_active: z.boolean().optional().default(true),
})

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

export async function GET(request: Request) {
  const session = await getSessionAndRole(request)

  if (!session) {
    return forbidden()
  }

  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('activeOnly') !== 'false'

  const supabase = await createClient()

  let query = supabase.from('jobs').select('*').order('name', { ascending: true })

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch jobs:', { message: error.message, code: error.code, details: error.details })
    return serverError()
  }

  return jsonResponse(data)
}

export async function POST(request: Request) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    console.warn('Forbidden POST /jobs — session:', session)
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

  const parsed = createJobSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed)
  }

  console.log('Parsed data:', parsed.data)

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('jobs')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    console.error('Supabase insert failed:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      insertedData: parsed.data,
    })
    return jsonResponse(
      {
        error: 'Database error',
        message: error.message,
        code: error.code,
        hint: error.hint ?? null,
      },
      500
    )
  }

  return jsonResponse(data, 201)
}