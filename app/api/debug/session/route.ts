import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return Response.json({
      authenticated: false,
      userError: userError?.message ?? 'No user',
      user: null,
      profile: null,
    })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return Response.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
    profileError: profileError?.message ?? null,
  })
}
