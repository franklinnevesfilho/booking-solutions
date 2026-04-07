'use client'

import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { DatesSetArg, EventClickArg } from '@fullcalendar/core'
import { useMemo, useState } from 'react'

import type { AppointmentWithDetails } from '@/types'

import { AppointmentDetailModal } from '@/components/employee/AppointmentDetailModal'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

type EmployeeCalendarProps = {
  initialAppointments: AppointmentWithDetails[]
}

type AppointmentApiShape = {
  id: string
  title: string
  client_id: string | null
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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.innerWidth < 1024
  })

  const events = useMemo(
    () =>
      appointments.map((appointment) => ({
        id: appointment.id,
        title: `${appointment.title}${appointment.client ? ` - ${appointment.client.full_name}` : ''}`,
        start: appointment.start_time,
        end: appointment.end_time,
        classNames: [statusClassMap[appointment.status]],
        extendedProps: {
          appointment,
        },
      })),
    [appointments],
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
        <div className="mb-3 flex min-h-11 items-center justify-end text-sm text-slate-600">
          {isRefreshing ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" />
              Refreshing...
            </span>
          ) : null}
        </div>

        {appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <p className="text-base font-semibold text-slate-900">No appointments scheduled</p>
            <p className="mt-1 text-sm text-slate-600">Check back later.</p>
          </div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView={isMobile ? 'listWeek' : 'timeGridWeek'}
            headerToolbar={{
              left: 'today prev,next',
              center: 'title',
              right: 'timeGridWeek,listWeek',
            }}
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
            viewDidMount={(arg) => {
              const mobile = window.innerWidth < 1024
              setIsMobile(mobile)
              arg.view.calendar.changeView(mobile ? 'listWeek' : 'timeGridWeek')
            }}
            windowResize={(arg) => {
              const mobile = arg.view.calendar.el.clientWidth < 1024
              setIsMobile(mobile)
              arg.view.calendar.changeView(mobile ? 'listWeek' : 'timeGridWeek')
            }}
            eventClassNames="cursor-pointer"
          />
        )}
      </Card>

      <AppointmentDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
      />
    </div>
  )
}
