import { format } from 'date-fns'

import type { AppointmentWithDetails } from '@/types'

type EmailTemplate = {
  subject: string
  html: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDateRange(appointment: AppointmentWithDetails): string {
  const start = new Date(appointment.start_time)
  const end = new Date(appointment.end_time)

  return `${format(start, 'EEEE, MMMM d')} at ${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`
}

function buildCoWorkerNames(appointment: AppointmentWithDetails): string {
  if (appointment.employees.length === 0) {
    return 'No other co-workers assigned.'
  }

  return appointment.employees.map((employee) => employee.full_name).join(', ')
}

function getAddressText(appointment: AppointmentWithDetails): string {
  if (appointment.home) {
    const parts: string[] = [appointment.home.street]
    const cityLine = [appointment.home.city, appointment.home.state, appointment.home.postal_code]
      .filter(Boolean)
      .join(', ')

    if (cityLine) {
      parts.push(cityLine)
    }

    if (appointment.home.label) {
      return `${appointment.home.label} — ${parts.join(', ')}`
    }

    return parts.join(', ')
  }

  return appointment.client?.address ?? 'Address not provided'
}

function emailHtml({
  greetingName,
  headline,
  appointment,
}: {
  greetingName: string
  headline: string
  appointment: AppointmentWithDetails
}): string {
  const safeName = escapeHtml(greetingName)
  const safeHeadline = escapeHtml(headline)
  const safeTitle = escapeHtml(appointment.title)
  const safeDateRange = escapeHtml(formatDateRange(appointment))
  const safeAddress = escapeHtml(getAddressText(appointment))
  const safeCoworkers = escapeHtml(buildCoWorkerNames(appointment))
  const safeNotes = appointment.notes ? escapeHtml(appointment.notes) : null

  return `
  <div style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="background:#16a34a;padding:18px 20px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.2px;">CleanSchedule</td>
            </tr>
            <tr>
              <td style="padding:22px 20px;">
                <p style="margin:0 0 10px;font-size:16px;line-height:24px;">Hi ${safeName},</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">${safeHeadline}</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dcfce7;border-radius:10px;background:#f0fdf4;">
                  <tr>
                    <td style="padding:14px 14px 12px;">
                      <p style="margin:0 0 8px;font-size:14px;line-height:22px;"><strong>Job:</strong> ${safeTitle}</p>
                      <p style="margin:0 0 8px;font-size:14px;line-height:22px;"><strong>Date & time:</strong> ${safeDateRange}</p>
                      <p style="margin:0 0 8px;font-size:14px;line-height:22px;"><strong>Address:</strong> ${safeAddress}</p>
                      <p style="margin:0 0 8px;font-size:14px;line-height:22px;"><strong>Co-workers:</strong> ${safeCoworkers}</p>
                      ${safeNotes ? `<p style="margin:0;font-size:14px;line-height:22px;"><strong>Notes:</strong> ${safeNotes}</p>` : ''}
                    </td>
                  </tr>
                </table>

                <p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#334155;">Thanks for your great work. Please reach out if anything looks off in this schedule.</p>
                <p style="margin:14px 0 0;font-size:14px;line-height:22px;color:#0f172a;">CleanSchedule Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`
}

export function appointmentCreatedEmail(appointment: AppointmentWithDetails, recipientName: string): EmailTemplate {
  return {
    subject: `New appointment assigned: ${appointment.title}`,
    html: emailHtml({
      greetingName: recipientName,
      headline: 'A new appointment has been added to your schedule.',
      appointment,
    }),
  }
}

export function appointmentUpdatedEmail(appointment: AppointmentWithDetails, recipientName: string): EmailTemplate {
  return {
    subject: `Appointment updated: ${appointment.title}`,
    html: emailHtml({
      greetingName: recipientName,
      headline: 'An appointment on your schedule has been updated.',
      appointment,
    }),
  }
}

export function appointmentCancelledEmail(appointment: AppointmentWithDetails, recipientName: string): EmailTemplate {
  return {
    subject: `Appointment cancelled: ${appointment.title}`,
    html: emailHtml({
      greetingName: recipientName,
      headline: 'An appointment on your schedule has been cancelled.',
      appointment,
    }),
  }
}
