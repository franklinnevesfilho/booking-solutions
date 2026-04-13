'use client'

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { createClient } from '@/lib/supabase/client'

const setPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

type SetPasswordValues = z.infer<typeof setPasswordSchema>

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    let isMounted = true

    const checkSession = async () => {
      if (!supabase) {
        if (isMounted) {
          setServerError('Unable to initialize authentication. Please try again.')
          setIsCheckingAuth(false)
        }
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      if (isMounted) {
        setIsCheckingAuth(false)
      }
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [router, supabase])

  const onSubmit = async ({ password }: SetPasswordValues) => {
    setServerError(null)

    if (!supabase) {
      setServerError('Unable to initialize authentication. Please try again.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setServerError(error.message)
      return
    }

    router.push('/')
  }

  return (
    <Card className="w-full">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">CleanSchedule</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Set your password</h1>
        <p className="mt-2 text-sm text-slate-600">Choose a secure password to complete your account setup.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          error={errors.password?.message}
          disabled={isCheckingAuth}
          {...register('password')}
        />

        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          disabled={isCheckingAuth}
          {...register('confirmPassword')}
        />

        {serverError ? <p className="text-sm text-rose-600">{serverError}</p> : null}

        <Button type="submit" isLoading={isSubmitting || isCheckingAuth} className="h-11 w-full text-base">
          Set password & continue
        </Button>
      </form>
    </Card>
  )
}
