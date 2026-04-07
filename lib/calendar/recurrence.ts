import { RRule } from 'rrule'

const DEFAULT_HORIZON_WEEKS = 52
const MAX_HORIZON_WEEKS = 104

const WEEKDAY_MAP = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]

/**
 * Parse an RRULE string and generate N appointment instances from a master.
 * Returns an array of { start_time, end_time } pairs.
 * Materializes from dtstart up to horizonWeeks weeks out (default 52).
 */
export function materializeRecurrence(
  dtstart: Date,
  dtend: Date,
  rruleString: string,
  horizonWeeks = DEFAULT_HORIZON_WEEKS,
): Array<{ start_time: Date; end_time: Date }> {
  const durationMs = dtend.getTime() - dtstart.getTime()

  if (durationMs <= 0) {
    throw new Error('Invalid recurrence master duration')
  }

  const cappedWeeks = Math.min(Math.max(1, horizonWeeks), MAX_HORIZON_WEEKS)
  const horizonEnd = new Date(dtstart.getTime() + cappedWeeks * 7 * 24 * 60 * 60 * 1000)

  const parsed = RRule.fromString(rruleString)
  const options = {
    ...parsed.origOptions,
    dtstart,
  }
  const rule = new RRule(options)

  const starts = rule.between(dtstart, horizonEnd, true)

  return starts.map((start) => ({
    start_time: start,
    end_time: new Date(start.getTime() + durationMs),
  }))
}

/**
 * Build a simple weekly RRULE string.
 * byweekday: 0=Mon … 6=Sun
 */
export function buildWeeklyRRule(byweekday: number[]): string {
  const weekdays = byweekday.map((day) => {
    const weekday = WEEKDAY_MAP[day]

    if (!weekday) {
      throw new Error(`Invalid weekday index: ${day}`)
    }

    return weekday
  })

  return new RRule({
    freq: RRule.WEEKLY,
    interval: 1,
    byweekday: weekdays,
  }).toString()
}

/**
 * Build a daily RRULE string.
 */
export function buildDailyRRule(): string {
  return new RRule({
    freq: RRule.DAILY,
    interval: 1,
  }).toString()
}

/**
 * Check if an RRULE string is valid (parseable without throwing).
 */
export function isValidRRule(rruleString: string): boolean {
  try {
    RRule.fromString(rruleString)
    return true
  } catch {
    return false
  }
}