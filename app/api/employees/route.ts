import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { badRequest, forbidden, getSessionAndRole, serverError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types'

const inviteEmployeeSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(1),
})

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function GET(request: Request) {
  const session = await getSessionAndRole(request)

  if (!session || session.role !== 'admin') {
    return forbidden()
  }

  const requestUrl = new URL(request.url)
  const assignable = requestUrl.searchParams.get('assignable') === 'true'

  const supabase = await createClient()
  const roles = assignable ? ['employee', 'admin'] : ['employee']

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, is_active, created_at, updated_at')
    .in('role', roles)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch employees', error)
    return serverError()
  }

  return jsonResponse(data, 200)
}

export async function POST(request: Request) {
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

  const parsed = inviteEmployeeSchema.safeParse(body)

  if (!parsed.success) {
    return jsonResponse(parsed.error.flatten(), 400)
  }

  let adminClient

  try {
    adminClient = createAdminClient()
  } catch (error) {
    console.error('Failed to initialize admin client', error)
    return serverError()
  }

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      role: 'employee',
      full_name: parsed.data.full_name,
    },
  })

  if (error) {
    console.error('Failed to invite employee', error)
    return serverError('Failed to invite employee')
  }

  return jsonResponse(
    {
      user: data.user,
    },
    201,
  )
}