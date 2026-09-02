/*
 * Days, months and times as strings. No Svelte, no Supabase, no DOM.
 *
 * This started life inside plan.ts, where the meal planner needed it. The
 * calendar needs exactly the same arithmetic, so it moved here and plan.ts
 * re-exports it — one copy of the date maths, one set of tests, and no chance
 * of the two screens disagreeing about which day it is.
 *
 * ## The rule the whole file rests on
 *
 * **A day is an ISO `YYYY-MM-DD` string, not a Date.** It is what Postgres
 * `date` hands back, it compares and sorts as a string, it survives JSON
 * unchanged, and it carries no time and therefore no timezone.
 *
 * A `Date` is only ever built to do arithmetic with, and always from local
 * parts — `new Date(y, m - 1, d)`, never `new Date('2026-09-01')`, which the
 * spec reads as UTC midnight and which is therefore the *previous* day in
 * Gothenburg for most of the year. That one distinction is why this file
 * exists instead of a handful of inline `new Date()` calls.
 *
 * ## Times are strings too
 *
 * A time is `HH:MM` (Postgres hands back `HH:MM:SS`, which trims to the same
 * thing). 24-hour, because both countries this household lives between use it,
 * and because "18:30" sorts correctly as text while "6:30 pm" does not.
 */

/* -------------------------------------------------------------------------- */
/* Days                                                                        */
/* -------------------------------------------------------------------------- */

/** A local Date as an ISO day key. Local parts only — see the header. */
export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * A key back to a local Date at midnight.
 *
 * Anything unparseable comes back as today rather than an Invalid Date, because
 * one bad row from the database should not blank a whole screen.
 */
export function parseKey(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return startOfDay(new Date())
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** True if a string is a well-formed day key that names a real day. */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  // Rejects 2026-02-31, which the regex is happy with and Date silently rolls
  // over into March.
  return dateKey(parseKey(value)) === value
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now)
}

/**
 * N days on from a key. Handles month ends, leap years and the two clock
 * changes for free, because Date does — as long as it is built from local
 * parts, which parseKey guarantees.
 */
export function addDays(key: string, days: number): string {
  const date = parseKey(key)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

/**
 * Whole days from a to b, negative if b is earlier.
 *
 * Rounded rather than truncated: the two days a year that are 23 or 25 hours
 * long would otherwise come out as 0.96 and truncate to 0, making "yesterday"
 * read as "today" twice a year.
 */
export function daysBetween(a: string, b: string): number {
  const ms = parseKey(b).getTime() - parseKey(a).getTime()
  return Math.round(ms / 86_400_000)
}

/**
 * The Monday of the week a day falls in.
 *
 * Monday because both countries this household lives between start there. A
 * household that wanted Sunday would change this one number — it is
 * deliberately not a preference, because a week that starts differently on two
 * phones is a week two people cannot talk about.
 */
export function startOfWeek(key: string): string {
  const date = parseKey(key)
  // getDay(): 0 = Sunday. Monday-based offset, so Sunday goes back six days.
  const offset = (date.getDay() + 6) % 7
  return addDays(key, -offset)
}

/**
 * Which day of the week a date is, Monday-first: 0 for Monday, 6 for Sunday.
 *
 * Monday-first for the same reason `startOfWeek` is, and returned as a number
 * rather than a name because the things that need it are counting — "how often
 * is this a Tuesday" is a bucket, not a label.
 */
export function weekdayIndex(key: string): number {
  return (parseKey(key).getDay() + 6) % 7
}

/** The seven day keys of the week that starts on `startKey`. */
export function weekDays(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startKey, i))
}

/**
 * The days of a week worth showing, which in the week you are actually in means
 * from today onwards.
 *
 * The meal planner arrived at this in round 10.1 and the calendar's week view
 * needed exactly the same rule in 11.1, so it lives here and plan.ts calls it
 * `planningDays`. Two dead days at the top of a screen are two screens of
 * scrolling before the question you opened the app to answer.
 *
 * Any other week shows all seven, and that is the same rule rather than an
 * exception to it: a week you have deliberately stepped back to is one you are
 * looking at on purpose, and a past week missing its first days would be a week
 * with a hole in it.
 */
export function weekDaysFrom(startKey: string, today: string): string[] {
  const all = weekDays(startKey)
  const last = all[6] ?? startKey
  if (today < startKey || today > last) return all
  return all.filter((day) => day >= today)
}

/**
 * The ISO-8601 week number a day falls in — the "v.36" a Swedish calendar puts
 * down the side of every month.
 *
 * ISO because it is the numbering both countries this household lives between
 * actually use, and because it is the only definition that agrees with
 * startOfWeek above: weeks run Monday to Sunday, and week 1 is the one holding
 * the first Thursday of the year.
 *
 * That Thursday is the whole algorithm. A week belongs to whichever year owns
 * its Thursday, so 1 January 2027 — a Friday — is week 53 of 2026, and 30
 * December 2024 — a Monday — is already week 1 of 2025. Counting from January
 * the 1st instead gets both of those wrong, which is the bug this function
 * exists to not have.
 */
export function isoWeek(key: string): number {
  const date = parseKey(key)
  // The Thursday of this day's week. Monday-based offset, as in startOfWeek.
  const offset = (date.getDay() + 6) % 7
  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset + 3)

  // The 4th of January is always in week 1, by definition; the Thursday of
  // *its* week is therefore week 1's Thursday.
  const jan4 = new Date(thursday.getFullYear(), 0, 4)
  const jan4Offset = (jan4.getDay() + 6) % 7
  const firstThursday = new Date(jan4.getFullYear(), 0, 4 - jan4Offset + 3)

  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
}

/* -------------------------------------------------------------------------- */
/* Months                                                                      */
/* -------------------------------------------------------------------------- */

/** The `YYYY-MM` a day belongs to. A month key is a day key with the day cut off. */
export function monthKey(dayOrMonth: string): string {
  return dayOrMonth.slice(0, 7)
}

/** The first day of a month, as a day key. */
export function monthStart(month: string): string {
  return `${monthKey(month)}-01`
}

/** N months on from a month key, clamped nowhere — `addMonths('2026-12', 1)` is '2027-01'. */
export function addMonths(month: string, months: number): string {
  const start = parseKey(monthStart(month))
  // Day 1 first, so a 31st never lands the month arithmetic on the wrong month.
  const moved = new Date(start.getFullYear(), start.getMonth() + months, 1)
  return dateKey(moved).slice(0, 7)
}

/** How many days a month has. */
export function daysInMonth(month: string): number {
  const start = parseKey(monthStart(month))
  // Day 0 of the next month is the last day of this one.
  return new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
}

/**
 * Every day cell a month grid should draw, Monday first, including the tail of
 * the previous month and the head of the next one that share those weeks.
 *
 * The number of rows is worked out rather than fixed at six. A fixed six keeps
 * the grid the same height when you swipe between months, which is worth
 * something — but it also draws a whole empty-looking week of the next month in
 * a short one, and on a 412px screen the row it would cost comes straight out
 * of the day list underneath, which is the half you are actually reading.
 */
export function monthGrid(month: string): string[] {
  const first = monthStart(month)
  const start = startOfWeek(first)
  const leading = daysBetween(start, first)
  const rows = Math.ceil((leading + daysInMonth(month)) / 7)
  return Array.from({ length: rows * 7 }, (_, i) => addDays(start, i))
}

/* -------------------------------------------------------------------------- */
/* Reading a date out loud                                                     */
/* -------------------------------------------------------------------------- */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** One letter per column heading, Monday first. Not sliced from the names
 * above — those start on Sunday, and a grid that starts on Monday needs its own
 * order or the headings sit one column out. */
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * "Today", "Tomorrow", "Yesterday", or the weekday name.
 *
 * The three relative words are worth the special case: a calendar's whole job
 * is answering "what is happening now", and a heading reading "Wednesday" makes
 * you check what day it is first.
 */
export function dayName(key: string, today: string): string {
  const gap = daysBetween(today, key)
  if (gap === 0) return 'Today'
  if (gap === 1) return 'Tomorrow'
  if (gap === -1) return 'Yesterday'
  return WEEKDAYS[parseKey(key).getDay()] ?? key
}

/** Three letters, for anywhere there is no room for a word. */
export function shortDayName(key: string): string {
  return WEEKDAYS_SHORT[parseKey(key).getDay()] ?? key
}

/** "3 Sep" — the date under the day's name. */
export function shortDate(key: string): string {
  const date = parseKey(key)
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`
}

/** "3 September" — for a sheet heading, where there is room for the word. */
export function longDate(key: string): string {
  const date = parseKey(key)
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/**
 * What the month stepper says: "September", or "September 2027" once the year
 * stops being the obvious one.
 *
 * Dropping the year in the current year is not decoration — the header is the
 * widest thing on a 412px screen and "September 2026" beside two stepper
 * buttons is tight. Any other year keeps it, because that is precisely when you
 * need it.
 */
export function monthName(month: string, today: string): string {
  const date = parseKey(monthStart(month))
  const name = MONTHS[date.getMonth()] ?? month
  const year = date.getFullYear()
  return year === parseKey(today).getFullYear() ? name : `${name} ${year}`
}

/** "1–7 Sep", or "28 Sep – 4 Oct" when it crosses a month. */
export function dateRange(from: string, to: string): string {
  if (from === to) return shortDate(from)
  const a = parseKey(from)
  const b = parseKey(to)
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[a.getMonth()]}`
  }
  return `${shortDate(from)} – ${shortDate(to)}`
}

/* -------------------------------------------------------------------------- */
/* Times                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A time from the database (`HH:MM:SS`) or from an `<input type="time">`
 * (`HH:MM`), normalised to `HH:MM`. Null for anything that isn't a time —
 * which is also how "all day" arrives, so callers get one falsy answer to
 * check rather than two.
 */
export function toTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}`
}

/** Minutes since midnight, for comparing and sorting. Null in, null out. */
export function minutesOfDay(time: string | null): number | null {
  const clean = toTime(time)
  if (clean === null) return null
  return Number(clean.slice(0, 2)) * 60 + Number(clean.slice(3, 5))
}

/**
 * A day and a wall-clock time as the actual instant they name on this device,
 * minus a number of minutes — an ISO string ready for a `timestamptz` column.
 *
 * Everywhere else a day is a day and a time is a time, deliberately never
 * combined into an instant (see the header). Round 20.1's reminder push is the
 * one exception: `pg_cron` has to compare against a real clock, so *something*
 * has to turn "9am here" into a moment, and doing it here — from local parts,
 * on the device that knows what timezone "here" is — is what keeps that moment
 * correct. Postgres has no idea what timezone a bare date was meant in; see
 * the equivalent note in pensar's own due-reminder migration.
 */
export function localInstant(day: string, time: string, minutesBefore = 0): string {
  const date = parseKey(day)
  const clean = toTime(time) ?? '00:00'
  date.setHours(Number(clean.slice(0, 2)), Number(clean.slice(3, 5)) - minutesBefore, 0, 0)
  return date.toISOString()
}

/**
 * A time shifted forward or back, wrapping at midnight. `days` says how many
 * midnights it crossed — 1 for a start of 23:30 pushed on an hour, 0
 * otherwise — so a caller that also owns a date can carry the date across
 * with it instead of quietly landing the wrong side of midnight.
 */
export function addMinutesToTime(time: string, minutes: number): { time: string; days: number } {
  const clean = toTime(time)
  if (clean === null) return { time, days: 0 }
  const total = Number(clean.slice(0, 2)) * 60 + Number(clean.slice(3, 5)) + minutes
  const days = Math.floor(total / 1440)
  const wrapped = total - days * 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return { time: `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}`, days }
}

/**
 * How a time reads on a card: "18:30", or "18:30 – 20:00" when there's an end.
 * An end alone is impossible — the database refuses it — so this only has the
 * two shapes.
 */
export function timeLabel(start: string | null, end: string | null): string {
  const from = toTime(start)
  if (from === null) return ''
  const to = toTime(end)
  return to === null ? from : `${from} – ${to}`
}
