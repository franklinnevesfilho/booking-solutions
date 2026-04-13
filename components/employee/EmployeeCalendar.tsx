'use client'

import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { AppointmentWithDetails } from '@/types'

import { AppointmentDetailModal } from '@/components/employee/AppointmentDetailModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

type EmployeeCalendarProps = {
  initialAppointments: AppointmentWithDetails[]
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
  clients?: {
    id: string
    full_name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    notes?: string | null
    created_at?: string
    updated_at?: string
  } | null
  homes?: {
    id: string
    client_id?: string
    label: string | null
    street: string | null
    city: string | null
    state: string | null
    postal_code: string | null
    country?: string | null
    is_primary: boolean
    created_at?: string
    updated_at?: string
  } | null
  jobs?: {
    id: string
    name: string
    description: string | null
  } | null
  appointment_employees?: Array<{
    employee_id: string
    profiles: {
      id: string
      full_name: string
      phone?: string | null
      role?: 'admin' | 'employee'
      is_active?: boolean
      created_at?: string
      updated_at?: string
    } | null
  }>
}

type EmployeeProfile = NonNullable<NonNullable<AppointmentApiShape['appointment_employees']>[number]['profiles']>

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
          email: row.clients.email ?? null,
          phone: row.clients.phone ?? null,
          address: row.clients.address ?? null,
          notes: row.clients.notes ?? null,
          created_at: row.clients.created_at ?? '',
          updated_at: row.clients.updated_at ?? '',
        }
      : null,
    home: row.homes
      ? {
          id: row.homes.id,
          client_id: row.homes.client_id ?? '',
          label: row.homes.label,
          street: row.homes.street ?? '',
          city: row.homes.city ?? '',
          state: row.homes.state ?? '',
          postal_code: row.homes.postal_code ?? '',
          country: row.homes.country ?? '',
          is_primary: row.homes.is_primary,
          created_at: row.homes.created_at ?? '',
          updated_at: row.homes.updated_at ?? '',
        }
      : null,
    job: row.jobs
      ? ({
          id: row.jobs.id,
          name: row.jobs.name,
          description: row.jobs.description ?? null,
        } as AppointmentWithDetails['job'])
      : null,
    invoice: null,
    employees:
      row.appointment_employees
        ?.map((assignment) => assignment.profiles)
        .filter((profile): profile is EmployeeProfile => profile !== null)
        .map((profile) => ({
          id: profile.id,
          full_name: profile.full_name,
          phone: profile.phone ?? null,
          role: profile.role ?? 'employee',
          is_active: profile.is_active ?? true,
          created_at: profile.created_at ?? '',
          updated_at: profile.updated_at ?? '',
        })) ?? [],
  }
}

export function EmployeeCalendar({ initialAppointments }: EmployeeCalendarProps) {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>(initialAppointments)
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all')
  const [clientQuery, setClientQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const calendarRef = useRef<FullCalendar | null>(null)

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

  const activeFiltersCount = [statusFilter !== 'all' ? 1 : 0, clientQuery !== '' ? 1 : 0].reduce((a, b) => a + b, 0)

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const statusMatch = statusFilter === 'all' || appointment.status === statusFilter
        const clientMatch =
          clientQuery === '' ||
          appointment.client?.full_name?.toLowerCase().includes(clientQuery.toLowerCase())

        return statusMatch && clientMatch
      }),
    [appointments, clientQuery, statusFilter],
  )

  const events = useMemo(
    () =>
      filteredAppointments.map((appointment) => ({
        id: appointment.id,
        title: `${appointment.title}${appointment.client ? ` - ${appointment.client.full_name}` : ''}`,
        start: appointment.start_time,
        end: appointment.end_time,
        classNames: [statusClassMap[appointment.status]],
        extendedProps: {
          appointment,
        },
      })),
    [filteredAppointments],
  )

  async function refreshAppointments(start: string, end: string) {
    try {
      setIsRefreshing(true)
      setErrorMessage(null)

      const response = await fetch(`/api/appointments?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)

      if (!response.ok) {
        throw new Error('Failed to refresh appointments')
      }

      const payload = (await response.json()) as AppointmentApiShape[]
      setAppointments(payload.map(toAppointmentWithDetails))
    } catch (error) {
      console.error('Failed to refresh employee appointments', error)
      setErrorMessage('Unable to refresh appointments right now.')
    } finally {
      setIsRefreshing(false)
    }
  }

  function handleDatesSet(arg: DatesSetArg) {
    const nextRange = {
      start: arg.start.toISOString(),
      end: arg.end.toISOString(),
    }

    void refreshAppointments(nextRange.start, nextRange.end)
  }

  function handleEventClick(arg: EventClickArg) {
    const appointment = arg.event.extendedProps.appointment as AppointmentWithDetails
    setSelectedAppointment(appointment)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Schedule</h1>
        <p className="text-sm text-slate-600">Your assigned cleaning appointments for the coming weeks.</p>
      </header>

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
                onClick={() => {
                  setStatusFilter('all')
                  setClientQuery('')
                }}
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
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | 'scheduled' | 'completed' | 'cancelled')}
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="all">All</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Client</span>
                <input
                  type="text"
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                  placeholder="Search by client..."
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </label>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={() => setIsMobileFiltersOpen(false)}>
                  Apply
                </Button>
                {activeFiltersCount > 0 ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStatusFilter('all')
                      setClientQuery('')
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
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[140px] flex-1 flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | 'scheduled' | 'completed' | 'cancelled')}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="all">All</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="flex min-w-[200px] flex-[2] flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Client</span>
                <input
                  type="text"
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                  placeholder="Search by client..."
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="mb-3 flex min-h-11 items-center justify-end text-sm text-slate-600">
          {isRefreshing ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" />
              Refreshing...
            </span>
          ) : null}
        </div>

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
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
          noEventsContent={
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">
                {appointments.length === 0 ? 'No appointments scheduled. Check back later.' : 'No appointments match your filters.'}
              </p>
            </div>
          }
          nowIndicator
          allDaySlot={false}
          editable={false}
          selectable={false}
          height="auto"
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
          events={events}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          dayMaxEvents
          eventClassNames="cursor-pointer"
        />
      </Card>

      <AppointmentDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
      />
    </div>
  )
}
