'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { AppointmentWithDetails, AppointmentInvoice, Client, ClientHome, Job, Profile } from '@/types'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'

type AppointmentModalProps = {
  isOpen: boolean
  onClose: () => void
  onSaved: (appointment: AppointmentWithDetails) => void
  onDeleted?: (appointmentId: string) => void
  appointment?: AppointmentWithDetails | null
  defaultStart?: string
  defaultEnd?: string
}

type RepeatType = 'daily' | 'weekly'
type EditScope = 'single' | 'series'

type ClientOption = Pick<Client, 'id' | 'full_name'>
type EmployeeOption = Pick<Profile, 'id' | 'full_name'>
type JobOption = Pick<Job, 'id' | 'name' | 'description' | 'default_price_per_hour'>

type AppointmentApiShape = {
  id: string
  title: string
  client_id: string | null
  home_id: string | null
  job_id?: string | null
  start_time: string
  end_time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes: string | null
  recurrence_series_id: string | null
  recurrence_rule: string | null
  is_master: boolean
  created_at: string
  updated_at: string
  clients?: { id: string; full_name: string } | null
  jobs?: JobOption | null
  invoice?: AppointmentInvoice | null
  client_homes?: {
    id: string
    client_id: string
    label: string | null
    street: string
    city: string
    state: string
    postal_code: string
    country: string
    is_primary: boolean
    created_at: string
    updated_at: string
  } | null
  appointment_employees?: Array<{
    employee_id: string
    profiles: {
      id: string
      full_name: string
    } | null
  }>
}

const appointmentSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    client_id: z.string().optional(),
    job_id: z.string().uuid({ message: 'Job is required' }),
    home_id: z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
    start_time: z.string().min(1, 'Start date and time is required'),
    end_time: z.string().min(1, 'End date and time is required'),
    employee_ids: z.array(z.string()),
    notes: z.string().optional(),
    amount_charged: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
      z.number().positive().optional(),
    ),
    discount_amount: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? 0 : Number(v)),
      z.number().min(0).default(0),
    ),
    discount_reason: z.string().trim().optional(),
    is_paid: z.boolean().default(false),
    status: z.enum(['scheduled', 'completed', 'cancelled']),
    doesRepeat: z.boolean(),
    repeatType: z.enum(['daily', 'weekly']),
    weeklyDays: z.array(z.number()),
    editScope: z.enum(['single', 'series']),
  })
  .superRefine((value, ctx) => {
    const start = new Date(value.start_time)
    const end = new Date(value.end_time)

    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid start date/time',
        path: ['start_time'],
      })
    }

    if (Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid end date/time',
        path: ['end_time'],
      })
    }

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() <= start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['end_time'],
      })
    }

    if (value.doesRepeat && value.repeatType === 'weekly' && value.weeklyDays.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one day for weekly recurrence',
        path: ['weeklyDays'],
      })
    }

    if (value.discount_amount > 0 && (!value.discount_reason || value.discount_reason.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Discount reason is required when a discount is applied',
        path: ['discount_reason'],
      })
    }
  })

type AppointmentFormValues = z.infer<typeof appointmentSchema>

const weekdayLabels = [
  { label: 'Mon', value: 0 },
  { label: 'Tue', value: 1 },
  { label: 'Wed', value: 2 },
  { label: 'Thu', value: 3 },
  { label: 'Fri', value: 4 },
  { label: 'Sat', value: 5 },
  { label: 'Sun', value: 6 },
]

const byDayTokens = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

function toDatetimeLocal(value: string) {
  const date = new Date(value)
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return offsetDate.toISOString().slice(0, 16)
}

function toIsoString(datetimeLocal: string) {
  return new Date(datetimeLocal).toISOString()
}

function toAppointmentWithDetails(row: AppointmentApiShape): AppointmentWithDetails {
  return {
    id: row.id,
    client_id: row.client_id,
    home_id: row.home_id,
    job_id: row.job_id ?? null,
    title: row.title,
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.status,
    notes: row.notes,
    recurrence_series_id: row.recurrence_series_id,
    recurrence_rule: row.recurrence_rule,
    is_master: row.is_master,
    created_at: row.created_at,
    updated_at: row.updated_at,
    client: row.clients
      ? {
          id: row.clients.id,
          full_name: row.clients.full_name,
          email: null,
          phone: null,
          address: null,
          notes: null,
          created_at: '',
          updated_at: '',
        }
      : null,
    home: row.client_homes ?? null,
    job: (row.jobs as Job | null) ?? null,
    invoice: row.invoice ?? null,
    employees:
      row.appointment_employees
        ?.map((assignment) => assignment.profiles)
        .filter((profile): profile is { id: string; full_name: string } => Boolean(profile))
        .map((profile) => ({
          id: profile.id,
          full_name: profile.full_name,
          phone: null,
          role: 'employee',
          is_active: true,
          created_at: '',
          updated_at: '',
        })) ?? [],
  }
}

function defaultValuesFromProps(
  currentAppointment: AppointmentWithDetails | null | undefined,
  defaultStart?: string,
  defaultEnd?: string,
): AppointmentFormValues {
  if (currentAppointment) {
    return {
      title: currentAppointment.title,
      client_id: currentAppointment.client_id ?? '',
      job_id: currentAppointment.job_id ?? '',
      home_id: currentAppointment.home_id ?? '',
      start_time: toDatetimeLocal(currentAppointment.start_time),
      end_time: toDatetimeLocal(currentAppointment.end_time),
      employee_ids: currentAppointment.employees.map((employee) => employee.id),
      notes: currentAppointment.notes ?? '',
      amount_charged: currentAppointment.invoice?.amount_charged ?? undefined,
      discount_amount: currentAppointment.invoice?.discount_amount ?? 0,
      discount_reason: currentAppointment.invoice?.discount_reason ?? '',
      is_paid: currentAppointment.invoice?.is_paid ?? false,
      status: currentAppointment.status,
      doesRepeat: false,
      repeatType: 'weekly',
      weeklyDays: [],
      editScope: 'single',
    }
  }

  const now = new Date()
  const start = defaultStart ? new Date(defaultStart) : now
  const end = defaultEnd ? new Date(defaultEnd) : new Date(start.getTime() + 60 * 60 * 1000)

  return {
    title: '',
    client_id: '',
    job_id: '',
    home_id: '',
    start_time: toDatetimeLocal(start.toISOString()),
    end_time: toDatetimeLocal(end.toISOString()),
    employee_ids: [],
    notes: '',
    amount_charged: undefined,
    discount_amount: 0,
    discount_reason: '',
    is_paid: false,
    status: 'scheduled',
    doesRepeat: false,
    repeatType: 'weekly',
    weeklyDays: [],
    editScope: 'single',
  }
}

export function AppointmentModal({
  isOpen,
  onClose,
  onSaved,
  onDeleted,
  appointment,
  defaultStart,
  defaultEnd,
}: AppointmentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [homes, setHomes] = useState<ClientHome[]>([])
  const [isLoadingHomes, setIsLoadingHomes] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showDeleteScopePrompt, setShowDeleteScopePrompt] = useState(false)

  const isEditMode = Boolean(appointment)
  const hasSeries = Boolean(appointment?.recurrence_series_id)

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: defaultValuesFromProps(appointment, defaultStart, defaultEnd),
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, dirtyFields },
  } = form

  const doesRepeat = watch('doesRepeat')
  const repeatType = watch('repeatType')
  const selectedEmployeeIds = watch('employee_ids')
  const clientId = watch('client_id')
  const watchedJobId = watch('job_id')
  const watchedStart = watch('start_time')
  const watchedEnd = watch('end_time')
  const watchedAmountCharged = watch('amount_charged')
  const watchedDiscountAmount = watch('discount_amount')

  const weeklyDayError = errors.weeklyDays?.message

  useEffect(() => {
    reset(defaultValuesFromProps(appointment, defaultStart, defaultEnd))
    setHomes([])
    setErrorMessage(null)
    setShowDeleteScopePrompt(false)
  }, [appointment, defaultStart, defaultEnd, reset, isOpen])

  useEffect(() => {
    if (!isOpen || !clientId) {
      setHomes([])
      setValue('home_id', '')
      return
    }

    let cancelled = false
    setIsLoadingHomes(true)

    fetch(`/api/clients/${clientId}/homes`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ClientHome[]) => {
        if (!cancelled) {
          setHomes(data)
          const current = form.getValues('home_id')
          if (!current) {
            const primary = data.find((h) => h.is_primary)
            if (primary) {
              setValue('home_id', primary.id)
            } else if (data.length === 1) {
              setValue('home_id', data[0].id)
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHomes([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingHomes(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [clientId, isOpen, form, setValue])

  useEffect(() => {
    if (!isOpen) return
    setIsLoadingJobs(true)
    fetch('/api/jobs?activeOnly=true')
      .then((res) => res.json())
      .then((data: JobOption[]) => {
        setJobs(data.sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(() => {
        // silently fail; jobs array stays empty
      })
      .finally(() => setIsLoadingJobs(false))
  }, [isOpen])

  useEffect(() => {
    if (!watchedJobId || !watchedStart || !watchedEnd) return
    if (dirtyFields.amount_charged) return

    const job = jobs.find((j) => j.id === watchedJobId)
    if (!job) return

    const start = new Date(watchedStart)
    const end = new Date(watchedEnd)
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

    if (durationHours > 0) {
      const suggested = Math.round(job.default_price_per_hour * durationHours * 100) / 100
      setValue('amount_charged', suggested, { shouldDirty: false })
    }
  }, [watchedJobId, watchedStart, watchedEnd, jobs, dirtyFields.amount_charged, setValue])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    async function loadOptions() {
      try {
        setIsLoadingOptions(true)
        const [clientsResponse, employeesResponse] = await Promise.all([fetch('/api/clients'), fetch('/api/employees')])

        if (!clientsResponse.ok || !employeesResponse.ok) {
          throw new Error('Unable to load form options')
        }

        const clientsData = (await clientsResponse.json()) as ClientOption[]
        const employeesData = (await employeesResponse.json()) as EmployeeOption[]

        setClients(clientsData)
        setEmployees(employeesData)
      } catch (error) {
        console.error('Failed to load appointment form options', error)
        setErrorMessage('Unable to load clients and employees right now.')
      } finally {
        setIsLoadingOptions(false)
      }
    }

    void loadOptions()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !modalRef.current) {
      return
    }

    const node = modalRef.current
    const focusable = node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')

    if (focusable.length > 0) {
      focusable[0].focus()
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
        node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
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

    return () => {
      node.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [clients],
  )

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [employees],
  )

  if (!isOpen) {
    return null
  }

  function handleEmployeeToggle(employeeId: string, checked: boolean) {
    if (checked) {
      setValue('employee_ids', [...selectedEmployeeIds, employeeId], { shouldValidate: true })
      return
    }

    setValue(
      'employee_ids',
      selectedEmployeeIds.filter((id) => id !== employeeId),
      { shouldValidate: true },
    )
  }

  function handleWeekdayToggle(day: number, checked: boolean) {
    const current = watch('weeklyDays')

    if (checked) {
      setValue('weeklyDays', Array.from(new Set([...current, day])).sort((a, b) => a - b), { shouldValidate: true })
      return
    }

    setValue(
      'weeklyDays',
      current.filter((value) => value !== day),
      { shouldValidate: true },
    )
  }

  async function onSubmit(values: AppointmentFormValues) {
    try {
      setIsSaving(true)
      setErrorMessage(null)

      const payload: Record<string, unknown> = {
        title: values.title,
        client_id: values.client_id || undefined,
        job_id: values.job_id,
        home_id: values.home_id || undefined,
        start_time: toIsoString(values.start_time),
        end_time: toIsoString(values.end_time),
        employee_ids: values.employee_ids,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
      }

      if (values.amount_charged !== undefined) {
        payload.invoice = {
          amount_charged: values.amount_charged,
          discount_amount: values.discount_amount ?? 0,
          discount_reason: values.discount_reason || null,
          is_paid: values.is_paid,
        }
      }

      if (isEditMode) {
        payload.status = values.status
        payload.edit_scope = hasSeries ? values.editScope : 'single'
      } else if (values.doesRepeat) {
        if (values.repeatType === 'daily') {
          payload.recurrence_rule = 'FREQ=DAILY;INTERVAL=1'
        } else {
          const byDays = values.weeklyDays.map((day) => byDayTokens[day]).join(',')
          payload.recurrence_rule = `FREQ=WEEKLY;INTERVAL=1;BYDAY=${byDays}`
        }
      }

      const endpoint = isEditMode ? `/api/appointments/${appointment?.id}` : '/api/appointments'
      const method = isEditMode ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to save appointment')
      }

      const result = (await response.json()) as AppointmentApiShape | AppointmentApiShape[]
      const firstRow = Array.isArray(result) ? result[0] : result

      if (!firstRow) {
        throw new Error('No appointment returned from server')
      }

      onSaved(toAppointmentWithDetails(firstRow))
      onClose()
    } catch (error) {
      console.error('Failed to save appointment', error)
      setErrorMessage('Failed to save appointment. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function runDelete(scope: 'single' | 'series') {
    if (!appointment) {
      return
    }

    try {
      setIsDeleting(true)
      setErrorMessage(null)

      const query = scope === 'series' ? '?scope=series' : ''
      const response = await fetch(`/api/appointments/${appointment.id}${query}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete appointment')
      }

      onDeleted?.(appointment.id)
      onClose()
    } catch (error) {
      console.error('Failed to delete appointment', error)
      setErrorMessage('Failed to delete appointment. Please try again.')
    } finally {
      setIsDeleting(false)
      setShowDeleteScopePrompt(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-slate-900/45"
        onClick={onClose}
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEditMode ? 'Edit appointment' : 'Create appointment'}
        className="relative ml-auto flex h-full w-full flex-col bg-white shadow-xl sm:mx-auto sm:my-8 sm:h-[calc(100%-4rem)] sm:max-h-[920px] sm:w-[min(840px,95vw)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">{isEditMode ? 'Edit Appointment' : 'New Appointment'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close appointment modal"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
            {errorMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
            ) : null}

            {isLoadingOptions ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <Spinner className="h-4 w-4" />
                Loading clients and employees...
              </div>
            ) : null}

            <Input label="Title" placeholder="Kitchen + living room clean" error={errors.title?.message} {...register('title')} />

            <div>
              <label htmlFor="job_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                Job <span className="text-red-500">*</span>
              </label>
              <select
                id="job_id"
                {...register('job_id')}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                disabled={isLoadingJobs}
              >
                <option value="">Select a job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name} - ${job.default_price_per_hour.toFixed(2)}/hr
                  </option>
                ))}
              </select>
              {errors.job_id ? <p className="mt-1.5 text-sm text-rose-600">{errors.job_id.message}</p> : null}
            </div>

            <div>
              <label htmlFor="client_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                Client
              </label>
              <select
                id="client_id"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                {...register('client_id')}
              >
                <option value="">Unassigned</option>
                {sortedClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name}
                  </option>
                ))}
              </select>
            </div>

            {clientId ? (
              <div>
                {isLoadingHomes ? (
                  <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                    Loading homes...
                  </div>
                ) : homes.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">No homes on file for this client</p>
                ) : (
                  <>
                    <label htmlFor="home_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                      Home
                      {homes.length > 1 ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {homes.length} homes
                        </span>
                      ) : null}
                    </label>
                    <select
                      id="home_id"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                      {...register('home_id')}
                      disabled={homes.length === 1}
                    >
                      <option value="">Select a home</option>
                      {homes.map((home) => (
                        <option key={home.id} value={home.id}>
                          {home.label ? `${home.label} - ` : ''}
                          {home.street}
                          {home.city ? `, ${home.city}` : ''}
                        </option>
                      ))}
                    </select>
                    {homes.length === 1 ? (
                      <p className="mt-1 text-xs text-slate-500">This client has 1 home on file - it&apos;s pre-selected.</p>
                    ) : null}
                    {homes.length > 1 ? (
                      <p className="mt-1 text-xs text-amber-700">
                        This client has multiple homes - please select the correct one.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                type="datetime-local"
                label="Start date & time"
                error={errors.start_time?.message}
                {...register('start_time')}
              />
              <Input
                type="datetime-local"
                label="End date & time"
                error={errors.end_time?.message}
                {...register('end_time')}
              />
            </div>

            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-slate-700">Assigned employees</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sortedEmployees.length === 0 ? (
                  <p className="text-sm text-slate-500">No employees found.</p>
                ) : (
                  sortedEmployees.map((employee) => {
                    const checked = selectedEmployeeIds.includes(employee.id)

                    return (
                      <label
                        key={employee.id}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => handleEmployeeToggle(employee.id, event.target.checked)}
                          className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>{employee.full_name}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </fieldset>

            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                id="notes"
                rows={4}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="Any special instructions or supplies needed"
                {...register('notes')}
              />
            </div>

            {isEditMode ? (
              <div>
                <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  id="status"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  {...register('status')}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between text-left text-sm font-semibold text-slate-800"
                  onClick={() => setValue('doesRepeat', !doesRepeat, { shouldValidate: true })}
                  aria-expanded={doesRepeat}
                >
                  <span>Does this repeat?</span>
                  <span>{doesRepeat ? 'Yes' : 'No'}</span>
                </button>

                {doesRepeat ? (
                  <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          value="daily"
                          checked={repeatType === 'daily'}
                          onChange={() => setValue('repeatType', 'daily', { shouldValidate: true })}
                          className="h-5 w-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        Daily
                      </label>
                      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          value="weekly"
                          checked={repeatType === 'weekly'}
                          onChange={() => setValue('repeatType', 'weekly', { shouldValidate: true })}
                          className="h-5 w-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        Weekly
                      </label>
                    </div>

                    {repeatType === 'weekly' ? (
                      <div>
                        <p className="mb-2 text-sm font-medium text-slate-700">Repeat on days</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {weekdayLabels.map((weekday) => {
                            const checked = watch('weeklyDays').includes(weekday.value)

                            return (
                              <label
                                key={weekday.value}
                                className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => handleWeekdayToggle(weekday.value, event.target.checked)}
                                  className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                />
                                {weekday.label}
                              </label>
                            )
                          })}
                        </div>
                        {weeklyDayError ? <p className="mt-1.5 text-sm text-rose-600">{weeklyDayError}</p> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">Pricing</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="amount_charged" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Amount charged
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                    <input
                      id="amount_charged"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('amount_charged')}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pl-7 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.amount_charged ? <p className="mt-1.5 text-sm text-rose-600">{errors.amount_charged.message}</p> : null}
                </div>

                <div>
                  <label htmlFor="discount_amount" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Discount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                    <input
                      id="discount_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('discount_amount')}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pl-7 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                      placeholder="0.00"
                    />
                  </div>
                  {errors.discount_amount ? <p className="mt-1.5 text-sm text-rose-600">{errors.discount_amount.message}</p> : null}
                </div>
              </div>

              {(watchedDiscountAmount ?? 0) > 0 ? (
                <div>
                  <label htmlFor="discount_reason" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Discount reason <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="discount_reason"
                    type="text"
                    {...register('discount_reason')}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    placeholder="e.g. Loyalty discount"
                  />
                  {errors.discount_reason ? <p className="mt-1.5 text-sm text-rose-600">{errors.discount_reason.message}</p> : null}
                </div>
              ) : null}

              {watchedAmountCharged !== undefined ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Net amount</span>
                  <span className="font-semibold text-slate-900">
                    ${((Number(watchedAmountCharged) || 0) - (Number(watchedDiscountAmount) || 0)).toFixed(2)}
                  </span>
                </div>
              ) : null}

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  {...register('is_paid')}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-700">Mark as paid</span>
              </label>
            </div>

            {isEditMode && hasSeries ? (
              <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <legend className="px-1 text-sm font-medium text-slate-700">Edit scope</legend>
                <div className="space-y-2">
                  <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      value="single"
                      checked={watch('editScope') === 'single'}
                      onChange={() => setValue('editScope', 'single')}
                      className="h-5 w-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    Edit this appointment only
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      value="series"
                      checked={watch('editScope') === 'series'}
                      onChange={() => setValue('editScope', 'series')}
                      className="h-5 w-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    Edit all in series
                  </label>
                </div>
              </fieldset>
            ) : null}

            {showDeleteScopePrompt ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">Delete recurring appointment</p>
                <p className="mt-1 text-sm text-amber-800">Choose whether to remove just this event or every event in this series.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button variant="danger" className="w-full" isLoading={isDeleting} onClick={() => void runDelete('single')}>
                    Delete only this event
                  </Button>
                  <Button variant="danger" className="w-full" isLoading={isDeleting} onClick={() => void runDelete('series')}>
                    Delete all events in series
                  </Button>
                  <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setShowDeleteScopePrompt(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button variant="secondary" className="w-full" onClick={onClose} disabled={isSaving || isDeleting}>
                  Cancel
                </Button>
                {isEditMode ? (
                  <Button
                    variant="danger"
                    className="w-full"
                    isLoading={isDeleting}
                    disabled={isSaving}
                    onClick={() => {
                      if (hasSeries) {
                        setShowDeleteScopePrompt(true)
                        return
                      }

                      void runDelete('single')
                    }}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>

              <Button type="submit" className="w-full" isLoading={isSaving} disabled={isDeleting}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
