'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Employee = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

type EmployeeEmailModalProps = {
  isOpen: boolean
  employee: Employee | null
  onClose: () => void
  onUpdated: () => void
}

const employeeEmailSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
})

type EmployeeEmailFormValues = z.infer<typeof employeeEmailSchema>

export function EmployeeEmailModal({ isOpen, employee, onClose, onUpdated }: EmployeeEmailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeEmailFormValues>({
    resolver: zodResolver(employeeEmailSchema),
    defaultValues: {
      email: '',
    },
  })

  useEffect(() => {
    if (!isOpen || !employee) {
      return
    }

    reset({
      email: '',
    })
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [employee, isOpen, reset])

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
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const items = Array.from(
        node.querySelectorAll<HTMLElement>('button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])'),
      ).filter((item) => !item.hasAttribute('disabled'))

      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', handleKeyDown)
    return () => node.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !employee) {
    return null
  }

  async function onSubmit(values: EmployeeEmailFormValues) {
    const currentEmployee = employee

    if (!currentEmployee) {
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/employees/${currentEmployee.id}/email`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
        }),
      })

      if (response.status === 409) {
        setErrorMessage('This email is already in use by another account.')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to update employee email')
      }

      setSuccessMessage('Email updated successfully.')
      onUpdated()
      reset({
        email: '',
      })
    } catch (error) {
      console.error('Failed to update employee email', error)
      setErrorMessage('Failed to update email. Please try again.')
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
        aria-label="Close change employee email modal"
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Change employee email"
        className="relative ml-auto flex h-full w-full flex-col bg-white shadow-xl sm:mx-auto sm:my-10 sm:h-auto sm:w-[min(560px,95vw)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">Change Email</h2>
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

            <Input label="Email" type="email" placeholder="employee@example.com" error={errors.email?.message} {...register('email')} />
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Update Email
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}