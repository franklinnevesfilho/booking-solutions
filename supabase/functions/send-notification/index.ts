import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type NotificationType = 'created' | 'updated' | 'cancelled'

type NotificationAppointment = {
  title?: string | null
  start_time?: string | null
  end_time?: string | null
  notes?: string | null
  client?: {
    address?: string | null
  } | null
  home?: {
    label?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
  } | null
  employees?: Array<{
    id: string
    full_name?: string | null
  }>
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDateTimeRange(startIso?: string | null, endIso?: string | null): string {
  if (!startIso || !endIso) {
    return 'Date not provided'
  }

  const start = new Date(startIso)
  const end = new Date(endIso)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Date not provided'
  }

  const dateText = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(start)

  const startTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(start)

  const endTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(end)

  return `${dateText} at ${startTime} – ${endTime}`
}

function getAddressText(appt: NotificationAppointment): string {
  if (appt.home) {
    const parts: string[] = []

    if (appt.home.street?.trim()) {
      parts.push(appt.home.street.trim())
    }

    const cityLine = [appt.home.city, appt.home.state, appt.home.postal_code]
      .filter((v): v is string => Boolean(v?.trim()))
      .join(', ')

    if (cityLine) {
      parts.push(cityLine)
    }

    const addressStr = parts.join(', ')

    if (appt.home.label?.trim()) {
      return `${appt.home.label.trim()} — ${addressStr}`
    }

    return addressStr || 'Address not provided'
  }

  return appt.client?.address?.trim() || 'Address not provided'
}

function buildTemplate(
  type: NotificationType,
  appointment: NotificationAppointment,
  recipientName: string,
): { subject: string; html: string } {
  const safeName = escapeHtml(recipientName || 'there')
  const safeTitle = escapeHtml(appointment.title?.trim() || 'Untitled appointment')
  const safeDateTime = escapeHtml(formatDateTimeRange(appointment.start_time, appointment.end_time))
  const safeAddress = escapeHtml(getAddressText(appointment))

  const coworkerNames = (appointment.employees ?? [])
    .map((employee) => employee.full_name?.trim())
    .filter((name): name is string => Boolean(name))
    .join(', ')

  const safeCoworkers = escapeHtml(coworkerNames || 'None assigned')
  const safeNotes = appointment.notes?.trim() ? escapeHtml(appointment.notes) : null

  const headlineByType: Record<NotificationType, string> = {
    created: 'You have a new appointment',
    updated: 'An appointment has been updated',
    cancelled: 'An appointment has been cancelled',
  }

  const subjectByType: Record<NotificationType, string> = {
    created: `New appointment: ${appointment.title?.trim() || 'Untitled appointment'}`,
    updated: `Appointment updated: ${appointment.title?.trim() || 'Untitled appointment'}`,
    cancelled: `Appointment cancelled: ${appointment.title?.trim() || 'Untitled appointment'}`,
  }

  const html = `
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
                <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">${escapeHtml(headlineByType[type])}</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dcfce7;border-radius:10px;background:#f0fdf4;">
                  <tr>
                    <td style="padding:14px 14px 12px;">
                      <p style="margin:0 0 8px;font-size:14px;line-height:22px;"><strong>Job:</strong> ${safeTitle}</p>
                      <p style="margin:0 0 8px;font-size:14px;line-height:22px;"><strong>Date/time:</strong> ${safeDateTime}</p>
                      <p style="margin:0 0 8px;font-size:14px;line-height:22px;"><strong>Address:</strong> ${safeAddress}</p>
                      <p style="margin:0 0 8px;font-size:14px;line-height:22px;"><strong>Co-workers:</strong> ${safeCoworkers}</p>
                      ${safeNotes ? `<p style="margin:0;font-size:14px;line-height:22px;"><strong>Notes:</strong> ${safeNotes}</p>` : ''}
                    </td>
                  </tr>
                </table>

                <p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#0f172a;">– The CleanSchedule Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`

  return {
    subject: subjectByType[type],
    html,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, appointment } = (await req.json()) as {
      type?: NotificationType
      appointment?: NotificationAppointment
    }

    if (!type || !appointment) {
      return new Response(JSON.stringify({ error: 'Missing type or appointment' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SECRET_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'CleanSchedule <noreply@resend.dev>'

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      return new Response(JSON.stringify({ error: 'Missing required environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const employees: Array<{ id: string; full_name: string }> = appointment.employees ?? []

    if (employees.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sendTasks = employees.map(async (employee) => {
      try {
        const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(employee.id)

        if (userError || !userResult?.user?.email) {
          return
        }

        const email = userResult.user.email
        const recipientName = employee.full_name || 'there'
        const { subject, html } = buildTemplate(type, appointment, recipientName)

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: fromEmail, to: [email], subject, html }),
        })

        if (!res.ok) {
          const body = await res.text()
          console.error(`Failed to send email to ${email}:`, body)
        }
      } catch (err) {
        console.error(`Error sending to employee ${employee.id}:`, err)
      }
    })

    await Promise.allSettled(sendTasks)

    return new Response(JSON.stringify({ sent: employees.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-notification error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})