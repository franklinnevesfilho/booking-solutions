import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { RRule } from 'https://esm.sh/rrule@2'

const EXTENSION_WEEKS = 8
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const now = new Date()
  const targetHorizon = new Date(now.getTime() + EXTENSION_WEEKS * MS_PER_WEEK)

  // Fetch series that need extension
  const { data: seriesToExtend, error: fetchError } = await supabase
    .from('recurrence_series')
    .select('*')
    .or(
      `end_condition.eq.infinite,` +
      `and(end_condition.eq.until,end_date.gt.${now.toISOString()}),` +
      `end_condition.eq.count`
    )
    .lt('horizon_date', targetHorizon.toISOString())

  if (fetchError) {
    console.error('Failed to fetch series for extension:', fetchError)
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const series = seriesToExtend ?? []
  let extended = 0
  let skipped = 0

  for (const s of series) {
    try {
      // For 'count' series, check current instance count
      let remainingCount: number | null = null
      if (s.end_condition === 'count' && s.max_count !== null) {
        const { count, error: countError } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('recurrence_series_id', s.id)

        if (countError) {
          console.error(`Failed to count instances for series ${s.id}:`, countError)
          skipped++
          continue
        }

        const existing = count ?? 0
        if (existing >= s.max_count) {
          // Push horizon_date far into future so this series isn't re-selected on every run
          await supabase
            .from('recurrence_series')
            .update({ horizon_date: new Date('2099-01-01T00:00:00Z').toISOString() })
            .eq('id', s.id)
          skipped++
          continue
        }
        remainingCount = s.max_count - existing
      }

      // Determine the upper bound for this series
      let upperBound = targetHorizon
      if (s.end_condition === 'until' && s.end_date) {
        const endDate = new Date(s.end_date)
        if (endDate < upperBound) upperBound = endDate
      }

      const fromDate = new Date(s.horizon_date)
      const dtstart = new Date(s.dtstart)

      // Materialize new occurrences from horizon_date to upperBound
      const parsed = RRule.fromString(s.rrule)
      const rule = new RRule({
        ...parsed.origOptions,
        dtstart,
      })

      let newStarts = rule.between(fromDate, upperBound, false) // exclusive of fromDate

      if (newStarts.length === 0) {
        // Update horizon_date even if no new occurrences
        await supabase
          .from('recurrence_series')
          .update({ horizon_date: targetHorizon.toISOString() })
          .eq('id', s.id)
        skipped++
        continue
      }

      // Cap for 'count' series
      if (remainingCount !== null) {
        newStarts = newStarts.slice(0, remainingCount)
      }

      // Get master appointment for metadata + employee assignments
      const { data: masterRows, error: masterError } = await supabase
        .from('appointments')
        .select('id, title, client_id, home_id, job_id, notes, status')
        .eq('recurrence_series_id', s.id)
        .eq('is_master', true)
        .limit(1)

      if (masterError || !masterRows || masterRows.length === 0) {
        console.error(`No master appointment for series ${s.id}:`, masterError)
        skipped++
        continue
      }

      const master = masterRows[0]

      // Get master employee assignments
      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('appointment_employees')
        .select('employee_id')
        .eq('appointment_id', master.id)

      if (assignmentError) {
        console.error(`Failed to fetch assignments for master ${master.id}:`, assignmentError)
        skipped++
        continue
      }

      const employeeIds = (assignmentRows ?? []).map((row: { employee_id: string }) => row.employee_id)

      // Build new appointment rows
      const durationMs = Number(s.duration_ms)
      const newAppointments = newStarts.map((start: Date) => ({
        title: master.title,
        client_id: master.client_id,
        home_id: master.home_id,
        job_id: master.job_id,
        notes: master.notes,
        status: 'scheduled' as const,
        start_time: start.toISOString(),
        end_time: new Date(start.getTime() + durationMs).toISOString(),
        recurrence_series_id: s.id,
        is_master: false,
      }))

      const { data: insertedRows, error: insertError } = await supabase
        .from('appointments')
        .insert(newAppointments)
        .select('id')

      if (insertError) {
        console.error(`Failed to insert new occurrences for series ${s.id}:`, insertError)
        skipped++
        continue
      }

      // Insert employee assignments for new occurrences
      if (employeeIds.length > 0 && insertedRows && insertedRows.length > 0) {
        const newAssignments = insertedRows.flatMap((row: { id: string }) =>
          employeeIds.map((employeeId: string) => ({
            appointment_id: row.id,
            employee_id: employeeId,
          }))
        )

        const { error: newAssignmentError } = await supabase
          .from('appointment_employees')
          .insert(newAssignments)

        if (newAssignmentError) {
          console.error(`Failed to insert assignments for new occurrences of series ${s.id}:`, newAssignmentError)
          // Don't skip — appointments were created, just assignments failed
        }
      }

      // Update horizon_date to the last new occurrence start time
      const lastStart = newStarts[newStarts.length - 1]
      const newHorizon = lastStart > targetHorizon ? lastStart : targetHorizon

      await supabase
        .from('recurrence_series')
        .update({ horizon_date: newHorizon.toISOString() })
        .eq('id', s.id)

      extended++
    } catch (err) {
      console.error(`Unexpected error processing series ${s.id}:`, err)
      skipped++
    }
  }

  const result = { processed: series.length, extended, skipped }
  console.log('Extension job complete:', result)

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
