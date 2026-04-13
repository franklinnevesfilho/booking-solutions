'use client'

import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core'
import { addHours, addMonths, format, formatISO, subDays, subMonths } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AppointmentWithDetails, ClientWithHomes } from '@/types/composed'
import type { Client, ClientHome, Invoice, Job, Profile } from '@/types/models'

import { AppointmentModal } from '@/components/admin/AppointmentModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Spinner } from '@/components/ui/Spinner'

interface AdminMyScheduleCalendarProps {
  initialAppointments: AppointmentWithDetails[]
  clients: ClientWithHomes[]
  employees: Profile[]
  currentUserId: string
}

type AppointmentApiShape = {
  id: string
  title: string
  client_id: string | null
  home_id: string | null
  job_id: string | null
  start_time: string
  end_time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes: string | null
  recurrence_series_id: string | null
  recurrence_rule: string | null
  is_master: boolean
  created_at: string
  updated_at: string
  clients?: Client | null
  home?: ClientHome | null
  invoice?: Invoice | null
  jobs?: Job | null
  appointment_employees?: Array<{
    employee_id: string
    profiles: {
      id: string
      full_name: string
    } | null
  }>
}

const statusClassMap = {
  scheduled: 'fc-event-scheduled',
  completed: 'fc-event-completed',
  cancelled: 'fc-event-cancelled',
}

function toAppointmentWithDetails(row: AppointmentApiShape): AppointmentWithDetails {
  return {
    id: row.id,
    client_id: row.client_id,
    home_id: row.home_id,
    job_id: row.job_id,
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
    home: row.home ?? null,
    invoice: row.invoice ?? null,
    job: row.jobs ?? null,

  }
}

export function AdminMyScheduleCalendar({
  initialAppointments,
  clients,
  employees,
  currentUserId,
}: AdminMyScheduleCalendarProps) {
  const [appointments, setAppointments] = useState(initialAppointments)
  const [isMobile, setIsMobile] = useState(false)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [mobileTitle, setMobileTitle] = useState('')
  const [calendarRange, setCalendarRange] = useState(() => {
    const now = new Date()
    return {
      start: formatISO(subMonths(now, 1)),
      end: formatISO(addMonths(now, 1)),
    }
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [filterClientId, setFilterClientId] = useState<string>('')
  const [filterHomeId, setFilterHomeId] = useState<string>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')

  const filterClientIdRef = useRef(filterClientId)
  const filterHomeIdRef = useRef(filterHomeId)
  const filterDateFromRef = useRef(filterDateFrom)
  const filterDateToRef = useRef(filterDateTo)
  const calendarRef = useRef<FullCalendar | null>(null)

  // Keep refs in sync with state on every render
  filterClientIdRef.current = filterClientId
  filterHomeIdRef.current = filterHomeId
  filterDateFromRef.current = filterDateFrom
  filterDateToRef.current = filterDateTo

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null)
  const [defaultStart, setDefaultStart] = useState<string | undefined>()
  const [defaultEnd, setDefaultEnd] = useState<string | undefined>()

  const events = useMemo(
    () =>
      appointments.map((appointment) => {
        return {
          id: appointment.id,
          title: `${appointment.title}${appointment.client ? ` - ${appointment.client.full_name}` : ''}`,
          start: appointment.start_time,
          end: appointment.end_time,
          classNames: [statusClassMap[appointment.status]],
          extendedProps: {
            appointment,
          },
        }
      }),
    [appointments],
  )

  const availableHomes = useMemo(
    () => (filterClientId ? clients.find((client) => client.id === filterClientId)?.homes ?? [] : []),
    [clients, filterClientId],
  )

  const hasActiveFilters =
    filterClientId !== '' ||
    filterHomeId !== '' ||
    filterDateFrom !== '' ||
    filterDateTo !== ''

  const activeFiltersCount = [filterClientId, filterHomeId, filterDateFrom, filterDateTo].filter(Boolean).length

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)

    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api.changeView(isMobile ? 'listYear' : 'dayGridMonth')
  }, [isMobile])

  const getEffectiveRange = useCallback(
    (rangeStart: string, rangeEnd: string) => {
      const effectiveStart = filterDateFromRef.current ? new Date(filterDateFromRef.current).toISOString() : rangeStart
      const effectiveEnd = filterDateToRef.current ? new Date(`${filterDateToRef.current}T23:59:59`).toISOString() : rangeEnd

      return { start: effectiveStart, end: effectiveEnd }
    },
    [],
  )

  const refreshAppointments = useCallback(
    async (
      rangeStart: string,
      rangeEnd: string,
      opts?: {
        clientId?: string
        homeId?: string
      },
    ) => {
    try {
      setIsRefreshing(true)
      setErrorMessage(null)

      const params = new URLSearchParams()
      params.set('start', rangeStart)
      params.set('end', rangeEnd)
      if (opts?.clientId) params.set('clientId', opts.clientId)
      if (opts?.homeId) params.set('homeId', opts.homeId)
      params.set('employeeId', currentUserId)

      const response = await fetch(`/api/appointments?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to load appointments')
      }

      const payload = (await response.json()) as AppointmentApiShape[]
      setAppointments(payload.map(toAppointmentWithDetails))
    } catch (error) {
      console.error('Failed to refresh appointments', error)
      setErrorMessage('Unable to refresh appointments right now.')
    } finally {
      setIsRefreshing(false)
    }
    },
    [currentUserId],
  )

  const applyFilters = useCallback(() => {
    const effectiveRange = getEffectiveRange(calendarRange.start, calendarRange.end)

    void refreshAppointments(effectiveRange.start, effectiveRange.end, {
      clientId: filterClientId || undefined,
      homeId: filterHomeId || undefined,
    })
  }, [calendarRange.end, calendarRange.start, filterClientId, filterHomeId, getEffectiveRange, refreshAppointments])

  const clearFilters = useCallback(() => {
    setFilterClientId('')
    setFilterHomeId('')
    setFilterDateFrom('')
    setFilterDateTo('')
    void refreshAppointments(calendarRange.start, calendarRange.end)
  }, [calendarRange.end, calendarRange.start, refreshAppointments])

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    const nextRange = {
      start: arg.start.toISOString(),
      end: arg.end.toISOString(),
    }

    const rangeEnd = subDays(arg.end, 1)
    const sameYear = arg.start.getFullYear() === rangeEnd.getFullYear()
    const sameMonth = sameYear && arg.start.getMonth() === rangeEnd.getMonth()

    if (sameMonth) {
      setMobileTitle(`${format(arg.start, 'MMM d')}-${format(rangeEnd, 'd, yyyy')}`)
    } else if (sameYear) {
      setMobileTitle(`${format(arg.start, 'MMM d')} - ${format(rangeEnd, 'MMM d, yyyy')}`)
    } else {
      setMobileTitle(`${format(arg.start, 'MMM d, yyyy')} - ${format(rangeEnd, 'MMM d, yyyy')}`)
    }

    setCalendarRange(nextRange)
    const effectiveRange = getEffectiveRange(nextRange.start, nextRange.end)

    void refreshAppointments(effectiveRange.start, effectiveRange.end, {
      clientId: filterClientIdRef.current || undefined,
      homeId: filterHomeIdRef.current || undefined,
    })
  }, [getEffectiveRange, refreshAppointments])

  function openCreateModal(start?: string, end?: string) {
    setSelectedAppointment(null)
    setDefaultStart(start)
    setDefaultEnd(end)
    setIsModalOpen(true)
  }

  function handleEventClick(arg: EventClickArg) {
    const appointment = arg.event.extendedProps.appointment as AppointmentWithDetails
    setSelectedAppointment(appointment)
    setDefaultStart(undefined)
    setDefaultEnd(undefined)
    setIsModalOpen(true)
  }

  function handleDateSelect(arg: DateSelectArg) {
    if (isMobile) {
      return
    }

    const start = arg.start.toISOString()
    const end = arg.end ? arg.end.toISOString() : addHours(arg.start, 1).toISOString()
    openCreateModal(start, end)
  }

  async function handleEventDrop(arg: EventDropArg) {
    if (isMobile) {
      arg.revert()
      return
    }

    const start = arg.event.start
    const end = arg.event.end

    if (!start || !end) {
      arg.revert()
      return
    }

    try {
      const response = await fetch(`/api/appointments/${arg.event.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to reschedule appointment')
      }

      const effectiveRange = getEffectiveRange(calendarRange.start, calendarRange.end)
      await refreshAppointments(effectiveRange.start, effectiveRange.end, {
        clientId: filterClientId || undefined,
        homeId: filterHomeId || undefined,
      })
    } catch (error) {
      console.error('Failed to reschedule appointment', error)
      arg.revert()
      setErrorMessage('Unable to reschedule appointment. Please try again.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Calendar</h1>
        <Button className="w-full sm:w-auto" onClick={() => openCreateModal()}>
          New Appointment
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <Card className="p-3 sm:p-4">
        {isMobile ? (
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setIsMobileFiltersOpen((open) => !open)}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filters
              {activeFiltersCount > 0 ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                  {activeFiltersCount}
                </span>
              ) : null}
            </button>

            {activeFiltersCount > 0 && !isMobileFiltersOpen ? (
              <button
                onClick={clearFilters}
                className="min-h-11 rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-500 hover:bg-slate-50"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        {isMobile && isMobileFiltersOpen ? (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3">
              <SearchableSelect
                label="Client"
                options={clients.map((c) => ({ id: c.id, label: c.full_name }))}
                value={filterClientId}
                onChange={(id) => {
                  setFilterClientId(id)
                  setFilterHomeId('')
                }}
                placeholder="All clients"
              />

              <SearchableSelect
                label="Home"
                options={availableHomes.map((home) => ({ id: home.id, label: home.label || home.street }))}
                value={filterHomeId}
                onChange={(id) => setFilterHomeId(id)}
                placeholder="All homes"
                disabled={filterClientId === ''}
              />

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Date from</span>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(event) => setFilterDateFrom(event.target.value)}
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Date to</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(event) => setFilterDateTo(event.target.value)}
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>

              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
                  onClick={() => {
                    applyFilters()
                    setIsMobileFiltersOpen(false)
                  }}
                >
                  Apply
                </Button>
                {activeFiltersCount > 0 ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      clearFilters()
                      setIsMobileFiltersOpen(false)
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!isMobile ? (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex max-w-[180px] flex-1 flex-col gap-1">
              <SearchableSelect
                label="Client"
                options={clients.map((c) => ({ id: c.id, label: c.full_name }))}
                value={filterClientId}
                onChange={(id) => {
                  setFilterClientId(id)
                  setFilterHomeId('')
                }}
                placeholder="All clients"
              />
            </div>

            <div className="flex max-w-[180px] flex-1 flex-col gap-1">
              <SearchableSelect
                label="Home"
                options={availableHomes.map((home) => ({ id: home.id, label: home.label || home.street }))}
                value={filterHomeId}
                onChange={(id) => setFilterHomeId(id)}
                placeholder="All homes"
                disabled={filterClientId === ''}
              />
            </div>

            <label className="flex max-w-[160px] flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Date from</span>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(event) => setFilterDateFrom(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="flex max-w-[160px] flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Date to</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(event) => setFilterDateTo(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <div className="flex items-center gap-2">
              <Button onClick={applyFilters}>Apply</Button>
              {hasActiveFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        ) : null}

        <div className="mb-3 flex items-center justify-end">
          {isRefreshing ? (
            <div className="inline-flex items-center gap-2 text-sm text-slate-600">
              <Spinner className="h-4 w-4" />
              Refreshing...
            </div>
          ) : null}
        </div>

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? 'listYear' : 'dayGridMonth'}
          headerToolbar={
            isMobile
              ? false
              : {
                  left: 'today prev,next',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,listWeek,listYear',
                }
          }
          views={{
            listYear: { buttonText: 'All' },
          }}
          nowIndicator
          allDaySlot={false}
          editable={!isMobile}
          selectable={!isMobile}
          selectMirror
          height="auto"
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
          events={events}
          eventClick={handleEventClick}
          select={handleDateSelect}
          eventDrop={(arg) => {
            void handleEventDrop(arg)
          }}
          datesSet={handleDatesSet}
          dayMaxEvents
          eventClassNames="cursor-pointer"
        />
      </Card>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
        defaultStart={defaultStart}
        defaultEnd={defaultEnd}
        onSaved={async () => {
          const effectiveRange = getEffectiveRange(calendarRange.start, calendarRange.end)
          await refreshAppointments(effectiveRange.start, effectiveRange.end, {
            clientId: filterClientId || undefined,
            homeId: filterHomeId || undefined,
          })
        }}
        onDeleted={async () => {
          const effectiveRange = getEffectiveRange(calendarRange.start, calendarRange.end)
          await refreshAppointments(effectiveRange.start, effectiveRange.end, {
            clientId: filterClientId || undefined,
            homeId: filterHomeId || undefined,
          })
        }}
      />
    </div>
  )
}
