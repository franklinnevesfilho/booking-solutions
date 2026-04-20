'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { createClient } from '@/lib/supabase/client'

export function ProfilePasswordForm() {
  const t = useTranslations('profile')
  const supabase = createClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const profilePasswordSchema = z
    .object({
      currentPassword: z.string().min(1, t('currentPasswordRequired')),
      newPassword: z.string().min(8, t('passwordMinLength')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('passwordsDoNotMatch'),
      path: ['confirmPassword'],
    })

  type ProfilePasswordValues = z.infer<typeof profilePasswordSchema>

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
      setErrorMessage(t('unableToUpdatePassword'))
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: values.currentPassword,
    })

    if (signInError) {
      setErrorMessage(t('currentPasswordIncorrect'))
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: values.newPassword })

      if (error) {
        setErrorMessage(t('unableToUpdatePassword'))
        return
      }

      reset()
      setSuccessMessage(t('passwordUpdatedSuccessfully'))
    } catch {
      setErrorMessage(t('unableToUpdatePassword'))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PasswordInput
        label={t('currentPassword')}
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />

      <PasswordInput
        label={t('newPassword')}
        autoComplete="new-password"
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />

      <PasswordInput
        label={t('confirmPassword')}
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

      <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
        {t('updatePassword')}
      </Button>
    </form>
  )
}