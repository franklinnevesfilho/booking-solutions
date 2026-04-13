'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type EmployeeInviteModalProps = {
  isOpen: boolean
  onClose: () => void
  onInvited: () => void
}

const employeeInviteSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required'),
  email: z.string().trim().email('Email is required'),
})

type EmployeeInviteFormValues = z.infer<typeof employeeInviteSchema>

export function EmployeeInviteModal({ isOpen, onClose, onInvited }: EmployeeInviteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeInviteFormValues>({
    resolver: zodResolver(employeeInviteSchema),
    defaultValues: {
      full_name: '',
      email: '',
    },
  })

  useEffect(() => {
    if (!isOpen) {
      return
    }

    reset({
      full_name: '',
      email: '',
    })
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [isOpen, reset])

  useEffect(() => {
    if (!isOpen || !modalRef.current) {
      return
    }

    const node = modalRef.current
    const focusables = node.querySelectorAll<HTMLElement>('button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])')

    if (focusables.length > 0) {
      focusables[0].focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    node.addEventListener('keydown', handleKeyDown)
    return () => node.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  async function onSubmit(values: EmployeeInviteFormValues) {
    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        throw new Error('Failed to invite employee')
      }

      setSuccessMessage('Invite sent!')
      onInvited()
      reset({
        full_name: '',
        email: '',
      })
    } catch (error) {
      console.error('Failed to invite employee', error)
      setErrorMessage('Failed to send invite. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        onClick={onClose}
        aria-label="Close invite employee modal"
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Invite employee"
        className="relative ml-auto flex h-full w-full flex-col bg-white shadow-xl sm:mx-auto sm:my-10 sm:h-auto sm:w-[min(560px,95vw)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">Invite Employee</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            {errorMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
            ) : null}

            {successMessage ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</div>
            ) : null}

            <Input label="Full name" error={errors.full_name?.message} {...register('full_name')} />
            <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Close
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Send Invite
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
