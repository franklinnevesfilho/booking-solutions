'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { createClient } from '@/lib/supabase/client'

const profilePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

type ProfilePasswordValues = z.infer<typeof profilePasswordSchema>

export function ProfilePasswordForm() {
  const supabase = createClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfilePasswordValues>({
    resolver: zodResolver(profilePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: ProfilePasswordValues) {
    setErrorMessage(null)
    setSuccessMessage(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      setErrorMessage('Unable to update password. Please try again.')
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: values.currentPassword,
    })

    if (signInError) {
      setErrorMessage('Current password is incorrect.')
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: values.newPassword })

      if (error) {
        setErrorMessage('Unable to update password. Please try again.')
        return
      }

      reset()
      setSuccessMessage('Password updated successfully.')
    } catch {
      setErrorMessage('Unable to update password. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PasswordInput
        label="Current password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />

      <PasswordInput
        label="New Password"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />

      <PasswordInput
        label="Confirm New Password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

      <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
        Update Password
      </Button>
    </form>
  )
}