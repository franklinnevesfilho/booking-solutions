import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const createJobSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().optional(),
  default_price_per_hour: z.number().positive('Default price must be positive'),
  is_active: z.boolean().optional().default(true),
})

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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
    console.error('Failed to fetch jobs', error)
    return serverError()
  }

  return jsonResponse(data)
}

export async function POST(request: Request) {
  const session = await getSessionAndRole(request)

  console.log('Session:', session)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const parsed = createJobSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('jobs')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    console.error('Failed to create job', error)
    return serverError()
  }

  return jsonResponse(data, 201)
}
