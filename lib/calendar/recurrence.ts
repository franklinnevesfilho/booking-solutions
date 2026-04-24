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

/**
 * Build a biweekly (every 2 weeks) RRULE string.
 * byweekday: 0=Mon … 6=Sun
 */
export function buildBiweeklyRRule(byweekday: number[]): string {
  const weekdays = byweekday.map((day) => {
    const weekday = WEEKDAY_MAP[day]
    if (!weekday) throw new Error(`Invalid weekday index: ${day}`)
    return weekday
  })
  return new RRule({
    freq: RRule.WEEKLY,
    interval: 2,
    byweekday: weekdays,
  }).toString()
}

/**
 * Build a monthly RRULE string.
 * interval: every N months (default 1)
 * bymonthday: day of month 1–28 (default: derived from dtstart by the caller)
 */
export function buildMonthlyRRule(interval = 1, bymonthday?: number): string {
  const options: ConstructorParameters<typeof RRule>[0] = {
    freq: RRule.MONTHLY,
    interval,
  }
  if (bymonthday !== undefined) {
    options.bymonthday = bymonthday
  }
  return new RRule(options).toString()
}

/**
 * General-purpose RRULE builder.
 * freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
 * interval: every N units (default 1)
 * byweekday: 0=Mon…6=Sun (only for WEEKLY)
 * bymonthday: 1–28 (only for MONTHLY)
 * until: end date (mutually exclusive with count)
 * count: max occurrences (mutually exclusive with until)
 */
export function buildCustomRRule(options: {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval?: number
  byweekday?: number[]
  bymonthday?: number
  until?: Date
  count?: number
}): string {
  const freqMap = {
    DAILY: RRule.DAILY,
    WEEKLY: RRule.WEEKLY,
    MONTHLY: RRule.MONTHLY,
  } as const

  const rruleOptions: ConstructorParameters<typeof RRule>[0] = {
    freq: freqMap[options.freq],
    interval: options.interval ?? 1,
  }

  if (options.byweekday && options.byweekday.length > 0) {
    rruleOptions.byweekday = options.byweekday.map((day) => {
      const weekday = WEEKDAY_MAP[day]
      if (!weekday) throw new Error(`Invalid weekday index: ${day}`)
      return weekday
    })
  }

  if (options.bymonthday !== undefined) {
    rruleOptions.bymonthday = options.bymonthday
  }

  if (options.until) {
    rruleOptions.until = options.until
  } else if (options.count) {
    rruleOptions.count = options.count
  }

  return new RRule(rruleOptions).toString()
}

/**
 * Generate future occurrences for rule mutation (Option A: delete-future-and-rematerialize).
 * Returns occurrences with start_time >= fromDate up to horizonWeeks weeks ahead.
 * durationMs: duration of each occurrence in milliseconds.
 */
export function getFutureOccurrencesFrom(
  rruleString: string,
  dtstart: Date,
  durationMs: number,
  fromDate: Date,
  horizonWeeks = DEFAULT_HORIZON_WEEKS,
): Array<{ start_time: Date; end_time: Date }> {
  if (durationMs <= 0) {
    throw new Error('Invalid duration')
  }

  const cappedWeeks = Math.min(Math.max(1, horizonWeeks), MAX_HORIZON_WEEKS)
  const horizonEnd = new Date(fromDate.getTime() + cappedWeeks * 7 * 24 * 60 * 60 * 1000)

  const parsed = RRule.fromString(rruleString)
  const rule = new RRule({
    ...parsed.origOptions,
    dtstart,
  })

  const starts = rule.between(fromDate, horizonEnd, true)

  return starts.map((start) => ({
    start_time: start,
    end_time: new Date(start.getTime() + durationMs),
  }))
}