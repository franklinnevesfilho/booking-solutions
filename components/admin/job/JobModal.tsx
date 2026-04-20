'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { z } from 'zod'

import type { Job } from '@/types'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type JobModalProps = {
  isOpen: boolean
  onClose: () => void
  onSaved: (job: Job) => void
  job?: Job | null
}

const jobSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim().optional(),
  default_price_per_hour: z.preprocess(
    (v) => (v === '' ? undefined : Number(v)),
    z.number({ invalid_type_error: 'Price is required' }).positive('Must be greater than 0'),
  ),
  is_active: z.boolean().optional(),
})

type JobFormValues = z.infer<typeof jobSchema>

function defaultValues(job?: Job | null): JobFormValues {
  return {
    name: job?.name ?? '',
    description: job?.description ?? '',
    default_price_per_hour: job?.default_price_per_hour ?? ('' as unknown as number),
    is_active: job?.is_active ?? true,
  }
}

export function JobModal({ isOpen, onClose, onSaved, job }: JobModalProps) {
  const t = useTranslations('jobs')
  const tCommon = useTranslations('common')
  const modalRef = useRef<HTMLDivElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: defaultValues(job),
  })

  useEffect(() => {
    reset(defaultValues(job))
    setErrorMessage(null)
  }, [job, isOpen, reset])

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

  if (!isOpen) {
    return null
  }

  async function onSubmit(values: JobFormValues) {
    console.log('Submitting job form with values:', values)
    try {
      setIsSaving(true)
      setErrorMessage(null)

      const url = job ? `/api/jobs/${job.id}` : '/api/jobs'
      const method = job ? 'PUT' : 'POST'

      console.log('Sending request to:', url, 'with method:', method, 'and payload:', values)

      const payload = job
        ? {
            name: values.name,
            description: values.description || null,
            default_price_per_hour: values.default_price_per_hour,
            is_active: values.is_active,
          }
        : {
            name: values.name,
            description: values.description || null,
            default_price_per_hour: values.default_price_per_hour,
            is_active: true,
          }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        console.log('Response: ', response)
        throw new Error('Failed to save job')
      }

      const savedJob = (await response.json()) as Job
      onSaved(savedJob)
    } catch (error) {
      console.error('Failed to save job', error)
      setErrorMessage(t('failedToSave'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        onClick={onClose}
        aria-label="Close job modal"
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={job ? 'Edit job' : 'Add job'}
        className="relative ml-auto flex h-full w-full flex-col bg-white shadow-xl sm:mx-auto sm:my-10 sm:h-auto sm:max-h-[calc(100%-5rem)] sm:w-[min(480px,95vw)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">{job ? t('editTitle') : t('addTitle')}</h2>
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

            <Input label={t('nameLabel')} error={errors.name?.message} {...register('name')} />

            <div className="w-full">
              <label htmlFor="job_description" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('descriptionLabel')}
              </label>
              <textarea
                id="job_description"
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                {...register('description')}
              />
            </div>

            <div className="w-full">
              <label htmlFor="default_price_per_hour" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('priceLabel')}
              </label>
              <div className={`flex h-11 overflow-hidden rounded-lg border transition focus-within:ring-2 ${errors.default_price_per_hour ? 'border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-200' : 'border-slate-300 focus-within:border-brand-500 focus-within:ring-brand-200'}`}>
                <span className="flex items-center border-r border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-500">
                  $
                </span>
                <input
                  id="default_price_per_hour"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  className="h-full w-full bg-white px-3 text-base text-slate-900 outline-none placeholder:text-slate-400"
                  {...register('default_price_per_hour')}
                />
              </div>
              {errors.default_price_per_hour ? (
                <p className="mt-1.5 text-sm text-rose-600">{errors.default_price_per_hour.message}</p>
              ) : null}
            </div>

            {job ? (
              <div className="flex items-center gap-3">
                <input
                  id="job_is_active"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  {...register('is_active')}
                />
                <label htmlFor="job_is_active" className="text-sm font-medium text-slate-700">
                  {t('activeToggle')}
                </label>
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" isLoading={isSaving}>
                {t('saveJob')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
