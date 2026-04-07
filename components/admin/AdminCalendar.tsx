'use client'

import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core'
import { addHours, formatISO, subMonths, addMonths } from 'date-fns'
import { useMemo, useState } from 'react'

import type { AppointmentWithDetails } from '@/types'

import { AppointmentModal } from '@/components/admin/AppointmentModal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

interface AdminCalendarProps {
  initialAppointments: AppointmentWithDetails[]
}

type AppointmentApiShape = {
  id: string
  title: string
  client_id: string | null
  home_id: string | null
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
  }
}

export function AdminCalendar({ initialAppointments }: AdminCalendarProps) {
  const [appointments, setAppointments] = useState(initialAppointments)
  const [isMobile, setIsMobile] = useState(false)
  const [calendarRange, setCalendarRange] = useState(() => {
    const now = new Date()
    return {
      start: formatISO(subMonths(now, 1)),
      end: formatISO(addMonths(now, 1)),
    }
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  async function refreshAppointments(rangeStart: string, rangeEnd: string) {
    try {
      setIsRefreshing(true)
      setErrorMessage(null)

      const response = await fetch(`/api/appointments?start=${encodeURIComponent(rangeStart)}&end=${encodeURIComponent(rangeEnd)}`)

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
  }

  function handleDatesSet(arg: DatesSetArg) {
    const nextRange = {
      start: arg.start.toISOString(),
      end: arg.end.toISOString(),
    }
    setCalendarRange(nextRange)
    void refreshAppointments(nextRange.start, nextRange.end)
  }

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

      await refreshAppointments(calendarRange.start, calendarRange.end)
    } catch (error) {
      console.error('Failed to reschedule appointment', error)
      arg.revert()
      setErrorMessage('Unable to reschedule appointment. Please try again.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Admin Calendar</h1>
        <Button className="w-full sm:w-auto" onClick={() => openCreateModal()}>
          New Appointment
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-end">
          {isRefreshing ? (
            <div className="inline-flex items-center gap-2 text-sm text-slate-600">
              <Spinner className="h-4 w-4" />
              Refreshing...
            </div>
          ) : null}
        </div>

        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'today prev,next',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek',
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
          windowResize={(arg) => {
            const mobile = arg.view.calendar.el.clientWidth < 1024
            setIsMobile(mobile)
            arg.view.calendar.changeView(mobile ? 'listWeek' : 'timeGridWeek')
          }}
          viewDidMount={(arg) => {
            const mobile = window.innerWidth < 1024
            setIsMobile(mobile)
            if (mobile && arg.view.type !== 'listWeek') {
              arg.view.calendar.changeView('listWeek')
            }
          }}
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
          await refreshAppointments(calendarRange.start, calendarRange.end)
        }}
        onDeleted={async () => {
          await refreshAppointments(calendarRange.start, calendarRange.end)
        }}
      />
    </div>
  )
}
