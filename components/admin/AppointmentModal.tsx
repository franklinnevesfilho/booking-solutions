'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { z } from 'zod'

import type { AppointmentWithDetails, Invoice, Client, ClientHome, Job, Profile } from '@/types'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
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

type RepeatType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
type EndCondition = 'infinite' | 'until' | 'count'
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
  is_master: boolean
  created_at: string
  updated_at: string
  clients?: { id: string; full_name: string } | null
  jobs?: JobOption | null
  invoice?: Invoice | null
  homes?: {
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
    repeatType: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'custom']),
    weeklyDays: z.array(z.number()),
    repeatInterval: z.preprocess(
      (v) => (v === '' || v === undefined ? 1 : Number(v)),
      z.number().int().min(1).default(1),
    ),
    repeatFreq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('WEEKLY'),
    endCondition: z.enum(['infinite', 'until', 'count']).default('infinite'),
    endDate: z.string().optional(),
    endCount: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
      z.number().int().min(1).optional(),
    ),
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

    if (value.doesRepeat) {
      if (value.repeatType === 'weekly' || value.repeatType === 'biweekly') {
        if (value.weeklyDays.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Select at least one day',
            path: ['weeklyDays'],
          })
        }
      }
      if (value.repeatType === 'custom' && value.repeatFreq === 'WEEKLY' && value.weeklyDays.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select at least one day',
          path: ['weeklyDays'],
        })
      }
      if (value.endCondition === 'until' && !value.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date is required',
          path: ['endDate'],
        })
      }
      if (value.endCondition === 'count' && !value.endCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Number of occurrences is required',
          path: ['endCount'],
        })
      }
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
    home: row.homes ?? null,
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
    // Parse RRULE from recurrence_series if present
    const rrule = (currentAppointment as { recurrence_series?: { rrule?: string } }).recurrence_series?.rrule ?? ''
    let parsedRepeatType: RepeatType = 'weekly'
    let parsedRepeatInterval = 1
    let parsedRepeatFreq: 'DAILY' | 'WEEKLY' | 'MONTHLY' = 'WEEKLY'
    let parsedWeeklyDays: number[] = []
    let parsedEndCondition: EndCondition = 'infinite'
    let parsedEndDate = ''
    let parsedEndCount: number | undefined = undefined

    if (rrule) {
      const freqMatch = rrule.match(/FREQ=(\w+)/)
      const intervalMatch = rrule.match(/INTERVAL=(\d+)/)
      const bydayMatch = rrule.match(/BYDAY=([\w,]+)/)
      const untilMatch = rrule.match(/UNTIL=([\dTZ]+)/)
      const countMatch = rrule.match(/COUNT=(\d+)/)

      const freq = (freqMatch?.[1] ?? 'WEEKLY') as 'DAILY' | 'WEEKLY' | 'MONTHLY'
      const interval = parseInt(intervalMatch?.[1] ?? '1', 10)
      const byday = bydayMatch?.[1]?.split(',') ?? []

      parsedRepeatFreq = freq
      parsedRepeatInterval = interval
      parsedWeeklyDays = byday.map((d) => byDayTokens.indexOf(d)).filter((i) => i >= 0)

      if (freq === 'DAILY' && interval === 1) parsedRepeatType = 'daily'
      else if (freq === 'WEEKLY' && interval === 1) parsedRepeatType = 'weekly'
      else if (freq === 'WEEKLY' && interval === 2) parsedRepeatType = 'biweekly'
      else if (freq === 'MONTHLY' && interval === 1) parsedRepeatType = 'monthly'
      else parsedRepeatType = 'custom'

      if (untilMatch?.[1]) {
        parsedEndCondition = 'until'
        // Convert UNTIL YYYYMMDDTHHMMSSZ to datetime-local string
        const raw = untilMatch[1]
        const year = raw.slice(0, 4)
        const month = raw.slice(4, 6)
        const day = raw.slice(6, 8)
        parsedEndDate = `${year}-${month}-${day}T00:00`
      } else if (countMatch?.[1]) {
        parsedEndCondition = 'count'
        parsedEndCount = parseInt(countMatch[1], 10)
      }
    }

    return {
      title: currentAppointment.title,
      job_id: currentAppointment.job_id ?? currentAppointment.job?.id ?? '',
      home_id: currentAppointment.home_id ?? currentAppointment.home?.id ?? '',
      client_id: currentAppointment.client_id ?? currentAppointment.client?.id ?? '',
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
      repeatType: parsedRepeatType,
      repeatInterval: parsedRepeatInterval,
      repeatFreq: parsedRepeatFreq,
      weeklyDays: parsedWeeklyDays,
      endCondition: parsedEndCondition,
      endDate: parsedEndDate,
      endCount: parsedEndCount,
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
    repeatInterval: 1,
    repeatFreq: 'WEEKLY',
    endCondition: 'infinite',
    endDate: '',
    endCount: undefined,
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
  const t = useTranslations('appointments')
  const tCommon = useTranslations('common')
  const modalRef = useRef<HTMLDivElement>(null)
  const employeeDropdownRef = useRef<HTMLDivElement>(null)
  const invoiceAmountLoadedRef = useRef(false)
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
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false)
  const [showRecurrenceEdit, setShowRecurrenceEdit] = useState(false)

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
  const repeatInterval = watch('repeatInterval')
  const repeatFreq = watch('repeatFreq')
  const endCondition = watch('endCondition')
  const watchedEndDate = watch('endDate')
  const watchedEndCount = watch('endCount')
  const editScope = watch('editScope')
  const selectedEmployeeIds = watch('employee_ids')
  const clientId = watch('client_id')
  const watchedJobId = watch('job_id')
  const watchedHomeId = watch('home_id')
  const watchedStatus = watch('status')
  const watchedStart = watch('start_time')
  const watchedEnd = watch('end_time')
  const watchedAmountCharged = watch('amount_charged')
  const watchedDiscountAmount = watch('discount_amount')

  useEffect(() => {
    if (isEditMode) {
      return
    }

    const parsedStart = new Date(watchedStart)
    if (Number.isNaN(parsedStart.getTime())) {
      setValue('title', '', { shouldValidate: false, shouldDirty: false })
      return
    }

    const month = String(parsedStart.getMonth() + 1).padStart(2, '0')
    const day = String(parsedStart.getDate()).padStart(2, '0')
    const dateLabel = `${month}/${day}`
    const selectedClientName = clients.find((client) => client.id === clientId)?.full_name?.trim()
    const generatedTitle = selectedClientName ? `${dateLabel} - ${selectedClientName}` : dateLabel

    setValue('title', generatedTitle, { shouldValidate: false, shouldDirty: false })
  }, [isEditMode, watchedStart, clientId, clients, setValue])

  const weeklyDayError = errors.weeklyDays?.message

  const weekdayLabels = [
    { label: t('weekdayMon'), value: 0 },
    { label: t('weekdayTue'), value: 1 },
    { label: t('weekdayWed'), value: 2 },
    { label: t('weekdayThu'), value: 3 },
    { label: t('weekdayFri'), value: 4 },
    { label: t('weekdaySat'), value: 5 },
    { label: t('weekdaySun'), value: 6 },
  ]

  const recurrenceSection = (
    <div className="space-y-3">
      {/* Frequency selector */}
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Frequency</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([
            { value: 'daily', label: t('daily') },
            { value: 'weekly', label: t('weekly') },
            { value: 'biweekly', label: 'Biweekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'custom', label: 'Custom' },
          ] as const).map(({ value, label }) => (
            <label
              key={value}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer"
            >
              <input
                type="radio"
                value={value}
                checked={repeatType === value}
                onChange={() => setValue('repeatType', value, { shouldValidate: true })}
                className="h-5 w-5 border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Custom interval inputs */}
      {repeatType === 'custom' ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-700 whitespace-nowrap">Every</span>
          <input
            type="number"
            min={1}
            className="h-11 w-20 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            {...register('repeatInterval')}
          />
          <select
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            value={repeatFreq}
            onChange={(e) => setValue('repeatFreq', e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY', { shouldValidate: true })}
          >
            <option value="DAILY">days</option>
            <option value="WEEKLY">weeks</option>
            <option value="MONTHLY">months</option>
          </select>
        </div>
      ) : null}

      {/* Weekday selector for weekly/biweekly/custom-weekly */}
      {(repeatType === 'weekly' || repeatType === 'biweekly' || (repeatType === 'custom' && repeatFreq === 'WEEKLY')) ? (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">{t('repeatOnDays')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {weekdayLabels.map((weekday) => {
              const checked = watch('weeklyDays').includes(weekday.value)
              return (
                <label
                  key={weekday.value}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => handleWeekdayToggle(weekday.value, e.target.checked)}
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

      {/* End condition */}
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Ends</p>
        <div className="space-y-2">
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              value="infinite"
              checked={endCondition === 'infinite'}
              onChange={() => setValue('endCondition', 'infinite', { shouldValidate: true })}
              className="h-5 w-5 border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            No end date
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              value="until"
              checked={endCondition === 'until'}
              onChange={() => setValue('endCondition', 'until', { shouldValidate: true })}
              className="h-5 w-5 border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            End by date
          </label>
          {endCondition === 'until' ? (
            <div className="ml-7">
              <input
                type="date"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                {...register('endDate')}
              />
              {errors.endDate ? <p className="mt-1.5 text-sm text-rose-600">{errors.endDate.message}</p> : null}
            </div>
          ) : null}
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              value="count"
              checked={endCondition === 'count'}
              onChange={() => setValue('endCondition', 'count', { shouldValidate: true })}
              className="h-5 w-5 border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            End after
          </label>
          {endCondition === 'count' ? (
            <div className="ml-7 flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="h-11 w-24 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="N"
                {...register('endCount')}
              />
              <span className="text-sm text-slate-700">occurrences</span>
              {errors.endCount ? <p className="mt-1.5 text-sm text-rose-600">{errors.endCount.message}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  useEffect(() => {
    console.log('[AppointmentModal] reset', {
      invoiceAmountCharged: appointment?.invoice?.amount_charged,
      invoiceAmountLoadedRef: invoiceAmountLoadedRef.current,
      job_id: appointment?.job_id,
    })

    reset(defaultValuesFromProps(appointment, defaultStart, defaultEnd))
    invoiceAmountLoadedRef.current = appointment?.invoice?.amount_charged != null
    setHomes([])
    setErrorMessage(null)
    setShowDeleteScopePrompt(false)
    setShowRecurrenceEdit(false)
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
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name))
        if (appointment?.job && !sorted.some((j) => j.id === appointment.job!.id)) {
          sorted.unshift(appointment.job)
        }
        setJobs(sorted)
      })
      .catch(() => {
        // silently fail; jobs array stays empty
      })
      .finally(() => setIsLoadingJobs(false))
  }, [isOpen, appointment])

  useEffect(() => {
    if (appointment?.job_id && watchedJobId !== appointment.job_id) {
      invoiceAmountLoadedRef.current = false
    }
  }, [watchedJobId, appointment?.job_id])

  useEffect(() => {
    if (!watchedJobId || !watchedStart || !watchedEnd) return
    if (dirtyFields.amount_charged) return
    if (invoiceAmountLoadedRef.current) return

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
        const [clientsResponse, employeesResponse] = await Promise.all([
          fetch('/api/clients'),
          fetch('/api/employees?assignable=true'),
        ])

        if (!clientsResponse.ok || !employeesResponse.ok) {
          throw new Error('Unable to load form options')
        }

        const clientsData = (await clientsResponse.json()) as ClientOption[]
        const employeesData = (await employeesResponse.json()) as EmployeeOption[]

        setClients(clientsData)
        setEmployees(employeesData)
      } catch (error) {
        console.error('Failed to load appointment form options', error)
        setErrorMessage(t('loadError'))
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setEmployeeDropdownOpen(false)
      }
    }

    if (employeeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [employeeDropdownOpen])

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [clients],
  )

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [employees],
  )

  const selectedEmployees = sortedEmployees.filter((employee) => selectedEmployeeIds.includes(employee.id))
  const triggerLabel =
    selectedEmployees.length === 0
      ? t('selectEmployees')
      : selectedEmployees.length <= 2
        ? selectedEmployees.map((employee) => employee.full_name).join(', ')
        : t('employeesSelected', { count: selectedEmployees.length })

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

        // Include recurrence rule mutation when editing series with recurrence edit open
        if (hasSeries && values.editScope === 'series' && showRecurrenceEdit) {
          let rrule: string
          switch (values.repeatType) {
            case 'daily':
              rrule = 'FREQ=DAILY;INTERVAL=1'
              break
            case 'weekly': {
              const byDays = values.weeklyDays.map((day) => byDayTokens[day]).join(',')
              rrule = `FREQ=WEEKLY;INTERVAL=1;BYDAY=${byDays}`
              break
            }
            case 'biweekly': {
              const byDays = values.weeklyDays.map((day) => byDayTokens[day]).join(',')
              rrule = `FREQ=WEEKLY;INTERVAL=2;BYDAY=${byDays}`
              break
            }
            case 'monthly':
              rrule = `FREQ=MONTHLY;INTERVAL=1`
              break
            case 'custom':
            default: {
              let customRRule = `FREQ=${values.repeatFreq};INTERVAL=${values.repeatInterval}`
              if (values.repeatFreq === 'WEEKLY' && values.weeklyDays.length > 0) {
                const byDays = values.weeklyDays.map((day) => byDayTokens[day]).join(',')
                customRRule += `;BYDAY=${byDays}`
              }
              rrule = customRRule
              break
            }
          }
          payload.recurrence_rule = rrule
          payload.recurrence_end_condition = values.endCondition
          if (values.endCondition === 'until' && values.endDate) {
            payload.recurrence_end_date = new Date(values.endDate).toISOString()
          }
          if (values.endCondition === 'count' && values.endCount) {
            payload.recurrence_max_count = values.endCount
          }
        }
      } else if (values.doesRepeat) {
        let rrule: string
        switch (values.repeatType) {
          case 'daily':
            rrule = 'FREQ=DAILY;INTERVAL=1'
            break
          case 'weekly': {
            const byDays = values.weeklyDays.map((day) => byDayTokens[day]).join(',')
            rrule = `FREQ=WEEKLY;INTERVAL=1;BYDAY=${byDays}`
            break
          }
          case 'biweekly': {
            const byDays = values.weeklyDays.map((day) => byDayTokens[day]).join(',')
            rrule = `FREQ=WEEKLY;INTERVAL=2;BYDAY=${byDays}`
            break
          }
          case 'monthly':
            rrule = `FREQ=MONTHLY;INTERVAL=1`
            break
          case 'custom':
          default: {
            let customRRule = `FREQ=${values.repeatFreq};INTERVAL=${values.repeatInterval}`
            if (values.repeatFreq === 'WEEKLY' && values.weeklyDays.length > 0) {
              const byDays = values.weeklyDays.map((day) => byDayTokens[day]).join(',')
              customRRule += `;BYDAY=${byDays}`
            }
            rrule = customRRule
            break
          }
        }
        payload.recurrence_rule = rrule
        payload.recurrence_end_condition = values.endCondition
        if (values.endCondition === 'until' && values.endDate) {
          payload.recurrence_end_date = new Date(values.endDate).toISOString()
        }
        if (values.endCondition === 'count' && values.endCount) {
          payload.recurrence_max_count = values.endCount
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
      setErrorMessage(t('saveError'))
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
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        const responseText = await response.text()
        let responseBody: unknown = responseText

        if (responseText) {
          try {
            responseBody = JSON.parse(responseText)
          } catch {
            responseBody = responseText
          }
        }

        console.error('Delete appointment request failed', {
          appointmentId: appointment.id,
          scope,
          status: response.status,
          statusText: response.statusText,
          responseBody,
        })

        throw new Error(`Failed to delete appointment (${response.status})`)
      }

      onDeleted?.(appointment.id)
      onClose()
    } catch (error) {
      console.error('Failed to delete appointment', error)
      setErrorMessage(t('deleteError'))
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
          <h2 className="text-lg font-semibold text-slate-900">{isEditMode ? t('editTitle') : t('newTitle')}</h2>
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

            {isLoadingOptions || isLoadingJobs ? (
              <div className="flex flex-1 items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm">{t('loadingDetails')}</p>
                </div>
              </div>
            ) : (
              <>
                {isEditMode ? (
                  <Input label={t('titleLabel')} placeholder={t('titlePlaceholder')} error={errors.title?.message} {...register('title')} />
                ) : null}

            <div>
              <label htmlFor="job_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('jobLabel')} <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={jobs.map((job) => ({
                  id: job.id,
                  label: `${job.name} - $${job.default_price_per_hour.toFixed(2)}/hr`,
                }))}
                value={watchedJobId ?? ''}
                onChange={(id) => setValue('job_id', id, { shouldValidate: true })}
                placeholder={t('selectJob')}
                disabled={isLoadingJobs}
              />
              {errors.job_id ? <p className="mt-1.5 text-sm text-rose-600">{errors.job_id.message}</p> : null}
            </div>

            <div>
              <label htmlFor="client_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('clientLabel')}
              </label>
              <SearchableSelect
                options={sortedClients.map((client) => ({ id: client.id, label: client.full_name }))}
                value={clientId ?? ''}
                onChange={(id) => setValue('client_id', id)}
                placeholder={t('clientPlaceholder')}
              />
            </div>

            {clientId ? (
              <div>
                {isLoadingHomes ? (
                  <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                    {t('loadingHomes')}
                  </div>
                ) : homes.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">{t('noHomesOnFile')}</p>
                ) : (
                  <>
                    <label htmlFor="home_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                      {t('homeLabel')}
                      {homes.length > 1 ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {t('homesCount', { count: homes.length })}
                        </span>
                      ) : null}
                    </label>
                    <SearchableSelect
                      options={homes.map((home) => ({
                        id: home.id,
                        label: `${home.label ? `${home.label} - ` : ''}${home.street}${home.city ? `, ${home.city}` : ''}`,
                      }))}
                      value={watchedHomeId ?? ''}
                      onChange={(id) => setValue('home_id', id)}
                      placeholder={t('selectHome')}
                      disabled={homes.length === 1}
                    />
                    {homes.length === 1 ? (
                      <p className="mt-1 text-xs text-slate-500">{t('oneHomeNote')}</p>
                    ) : null}
                    {homes.length > 1 ? (
                      <p className="mt-1 text-xs text-amber-700">
                        {t('multipleHomesNote')}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                type="datetime-local"
                label={t('startLabel')}
                error={errors.start_time?.message}
                {...register('start_time')}
              />
              <Input
                type="datetime-local"
                label={t('endLabel')}
                error={errors.end_time?.message}
                {...register('end_time')}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('employeesLabel')}</label>
              <div ref={employeeDropdownRef} className="relative">
                <button
                  type="button"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-left text-base text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  onClick={() => setEmployeeDropdownOpen((open) => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={employeeDropdownOpen}
                >
                  <span className="block truncate pr-6">{triggerLabel}</span>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500" aria-hidden="true">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>

                {employeeDropdownOpen ? (
                  <div className="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {sortedEmployees.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">{t('noEmployeesFound')}</p>
                    ) : (
                      sortedEmployees.map((employee) => {
                        const checked = selectedEmployeeIds.includes(employee.id)

                        return (
                          <label
                            key={employee.id}
                            className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 ${
                              checked ? 'bg-blue-50' : ''
                            }`}
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
                ) : null}
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('notesLabel')}
              </label>
              <textarea
                id="notes"
                rows={4}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder={t('notesPlaceholder')}
                {...register('notes')}
              />
            </div>

            {isEditMode ? (
              <div>
                <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t('statusLabel')}
                </label>
                <SearchableSelect
                  options={[
                    { id: 'scheduled', label: t('statusScheduled') },
                    { id: 'completed', label: t('statusCompleted') },
                    { id: 'cancelled', label: t('statusCancelled') },
                  ]}
                  value={watchedStatus ?? ''}
                  onChange={(id) => setValue('status', id as 'scheduled' | 'completed' | 'cancelled')}
                  placeholder={t('selectStatus')}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between text-left text-sm font-semibold text-slate-800"
                  onClick={() => setValue('doesRepeat', !doesRepeat, { shouldValidate: true })}
                  aria-expanded={doesRepeat}
                >
                  <span>{t('doesRepeat')}</span>
                  <span>{doesRepeat ? t('yes') : t('no')}</span>
                </button>

                {doesRepeat ? (
                  <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                    {recurrenceSection}
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">{t('pricingTitle')}</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="amount_charged" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t('amountCharged')}
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
                    {t('discount')}
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
                    {t('discountReason')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="discount_reason"
                    type="text"
                    {...register('discount_reason')}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    placeholder={t('discountReasonPlaceholder')}
                  />
                  {errors.discount_reason ? <p className="mt-1.5 text-sm text-rose-600">{errors.discount_reason.message}</p> : null}
                </div>
              ) : null}

              {watchedAmountCharged !== undefined ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{t('netAmount')}</span>
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
                <span className="text-sm text-slate-700">{t('markAsPaid')}</span>
              </label>
            </div>

            {isEditMode && hasSeries ? (
              <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <legend className="px-1 text-sm font-medium text-slate-700">{t('editScope')}</legend>
                <div className="space-y-2">
                  <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      value="single"
                      checked={editScope === 'single'}
                      onChange={() => setValue('editScope', 'single')}
                      className="h-5 w-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    {t('editSingle')}
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      value="series"
                      checked={editScope === 'series'}
                      onChange={() => setValue('editScope', 'series')}
                      className="h-5 w-5 border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    {t('editSeries')}
                  </label>
                </div>
              </fieldset>
            ) : null}

            {isEditMode && hasSeries && editScope === 'series' ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between text-left text-sm font-semibold text-amber-900"
                  onClick={() => setShowRecurrenceEdit((prev) => !prev)}
                  aria-expanded={showRecurrenceEdit}
                >
                  <span>Change recurrence rule</span>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d={showRecurrenceEdit ? 'M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z' : 'M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'} clipRule="evenodd" />
                  </svg>
                </button>
                {showRecurrenceEdit ? (
                  <div className="mt-3 space-y-3 border-t border-amber-200 pt-3">
                    <p className="text-xs text-amber-800">
                      Changing the recurrence rule will delete all future occurrences and recreate them from today. Past occurrences are preserved.
                    </p>
                    {recurrenceSection}
                  </div>
                ) : null}
              </div>
            ) : null}

            {showDeleteScopePrompt ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">{t('deleteRecurring')}</p>
                <p className="mt-1 text-sm text-amber-800">{t('deleteRecurringDesc')}</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button variant="danger" className="w-full" isLoading={isDeleting} onClick={() => void runDelete('single')}>
                    {t('deleteOnlyThis')}
                  </Button>
                  <Button variant="danger" className="w-full" isLoading={isDeleting} onClick={() => void runDelete('series')}>
                    {t('deleteAllInSeries')}
                  </Button>
                  <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setShowDeleteScopePrompt(false)}>
                    {tCommon('cancel')}
                  </Button>
                </div>
              </div>
            ) : null}
              </>
            )}
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button variant="secondary" className="w-full" onClick={onClose} disabled={isSaving || isDeleting}>
                  {tCommon('cancel')}
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
                    {tCommon('delete')}
                  </Button>
                ) : null}
              </div>

              <Button type="submit" className="w-full" isLoading={isSaving} disabled={isDeleting}>
                {tCommon('save')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
