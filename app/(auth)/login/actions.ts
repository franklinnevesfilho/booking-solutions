'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type SignInState = {
  error: string | null
}

export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get('email')
  const password = formData.get('password')

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return { error: 'Please enter your email and password.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Invalid email or password.' }
  }

  redirect('/')
}
