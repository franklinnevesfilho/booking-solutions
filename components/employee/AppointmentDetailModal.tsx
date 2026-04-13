'use client'

import { format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { AppointmentWithDetails, ClientHome } from '@/types'

import { Badge } from '@/components/ui/Badge'

type AppointmentDetailModalProps = {
  isOpen: boolean
  onClose: () => void
  appointment: AppointmentWithDetails | null
}

export function AppointmentDetailModal({ isOpen, onClose, appointment }: AppointmentDetailModalProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let mounted = true

    async function loadCurrentUser() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (mounted) {
        setCurrentUserId(user?.id ?? null)
      }
    }

    void loadCurrentUser()

    return () => {
      mounted = false
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  const coworkers = useMemo(() => {
    if (!appointment) {
      return []
    }

    return appointment.employees.filter((employee) => employee.id !== currentUserId)
  }, [appointment, currentUserId])

  if (!isOpen || !appointment) {
    return null
  }

  const startDate = new Date(appointment.start_time)
  const endDate = new Date(appointment.end_time)
  const formattedDate = `${format(startDate, 'EEEE, MMMM d')} · ${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close appointment details"
        className="absolute inset-0 bg-slate-900/45"
        onClick={onClose}
      />

      <div className="fixed inset-0 overflow-y-auto p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="appointment-detail-title"
          className="relative flex min-h-screen w-full flex-col bg-white sm:min-h-0 sm:max-w-lg sm:rounded-2xl sm:shadow-xl"
        >
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
            <p id="appointment-detail-title" className="text-base font-semibold text-slate-900">
              Appointment Details
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label="Close details"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">{appointment.title}</h2>
              <Badge status={appointment.status} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date & Time</p>
              <p className="mt-1 text-sm text-slate-700">{formattedDate}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{appointment.client?.full_name ?? 'No client selected'}</p>
              {appointment.client?.phone ? <p className="mt-1 text-sm text-slate-700">Phone: {appointment.client.phone}</p> : null}
              {appointment.client?.email ? <p className="mt-1 text-sm text-slate-700">Email: {appointment.client.email}</p> : null}
              <p className="mt-1 text-sm text-slate-700">
                {appointment.home
                  ? [
                      appointment.home.label,
                      appointment.home.street,
                      [appointment.home.city, appointment.home.state, appointment.home.postal_code].filter(Boolean).join(', '),
                    ]
                      .filter(Boolean)
                      .join(' - ')
                  : appointment.client?.address ?? 'Address not available'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job</p>
              {appointment.job ? (
                <div className="mt-1">
                  <p className="text-sm font-medium text-slate-900">{appointment.job.name}</p>
                  {appointment.job.description && (
                    <p className="mt-0.5 text-sm text-slate-600">{appointment.job.description}</p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-600">No job assigned</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Co-workers Assigned</p>
              {coworkers.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {coworkers.map((employee) => (
                    <li key={employee.id}>{employee.full_name}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-600">No other co-workers assigned.</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{appointment.notes || 'No notes provided.'}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
