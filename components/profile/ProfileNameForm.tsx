'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const profileNameSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required'),
})

type ProfileNameValues = z.infer<typeof profileNameSchema>

type ProfileNameFormProps = {
  defaultFullName: string
}

export function ProfileNameForm({ defaultFullName }: ProfileNameFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileNameValues>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: {
      full_name: defaultFullName,
    },
  })

  async function onSubmit(values: ProfileNameValues) {
    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        let message = 'Failed to save profile.'

        try {
          const errorPayload = (await response.json()) as { error?: string }
          if (errorPayload?.error) {
            message = errorPayload.error
          }
        } catch {
          // Keep default fallback message.
        }

        throw new Error(message)
      }

      const updatedProfile = (await response.json()) as { full_name?: string }
      const updatedName = updatedProfile.full_name ?? values.full_name

      reset({ full_name: updatedName })
      setSuccessMessage('Name updated successfully.')
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unexpected error.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Full Name" error={errors.full_name?.message} {...register('full_name')} />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

      <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
        Save Changes
      </Button>
    </form>
  )
}