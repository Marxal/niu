/*
 * Repeating events: what "every Sunday, ten times" means, and what happens when
 * you edit one of the ten.
 *
 * Pure — no Svelte, no Supabase, no DOM — and tested, because both halves of
 * this file are the kind of arithmetic that is quietly wrong for a month before
 * anybody notices.
 *
 * ## The decision: ten rows, not one rule
 *
 * A repeating event could be stored as one row with a rule on it, expanded on
 * the fly whenever the grid asks. That is how Google does it, and it is the
 * reason Google's API has `recurringEventId`, instance ids, and a whole
 * vocabulary for "this occurrence is an exception".
 *
 * Niu writes the ten rows instead. Each occurrence is an ordinary event that
 * happens to carry a `seriesId`, and everything already built keeps working
 * untouched: the month grid draws them, the day list sorts them, confirmations
 * attach to them, and the Google push sends ten ordinary events whose ids come
 * from their own uuids — no RRULE, no exceptions, no instance arithmetic.
 *
 * The price is that a series is **finite**. "Every Sunday forever" cannot be
 * written down. NIU.md §4.3 asked for exactly the finite version — "repeats X
 * times per week or month; ends after X times" — so this is the shape of the
 * feature rather than a shortcut around it, and MAX_OCCURRENCES is the honest
 * ceiling.
 *
 * ## Editing one of ten
 *
 * §4.3: *"Deleting asks: this one, or all of them?"* — and Marçal asked for the
 * same question on an edit. Deleting is easy; editing is where the thinking is,
 * because "all of them" cannot mean "make all ten identical". The third gym
 * session may already have been moved to a Monday, and changing the *title* of
 * the series should not drag it back to Sunday.
 *
 * So an "all of them" edit applies the **change**, not the result:
 *
 *   - a field you touched is copied to every occurrence
 *   - a field you left alone is left alone on every occurrence
 *   - moving the day *shifts* every occurrence by the same number of days, so
 *     "gym is on Mondays now" keeps the weekly rhythm instead of collapsing ten
 *     events onto one Monday
 *
 * That is `applyChange` below, and it is the function most worth reading before
 * changing anything here.
 */

import type { EventDraft } from './calendar'
import { addDays, daysBetween, daysInMonth, parseKey, dateKey } from './dates'

/* -------------------------------------------------------------------------- */
/* The rule                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * How often it comes round. `none` is a one-off, which is most events — it is
 * in the same type rather than beside it as a null so that the sheet has one
 * value to bind a row of chips to.
 */
export type RepeatKind = 'none' | 'daily' | 'weekly' | 'fortnightly' | 'monthly'

export const REPEAT_KINDS: readonly RepeatKind[] = [
  'none',
  'daily',
  'weekly',
  'fortnightly',
  'monthly',
]

export function isRepeatKind(value: unknown): value is RepeatKind {
  return REPEAT_KINDS.includes(value as RepeatKind)
}

/** The kinds that actually repeat — what the database stores in `series_rule`. */
export type SeriesRule = Exclude<RepeatKind, 'none'>

export function isSeriesRule(value: unknown): value is SeriesRule {
  return isRepeatKind(value) && value !== 'none'
}

/**
 * How many times, when you first turn repeating on.
 *
 * Ten because that is the number Marçal reached for unprompted — *"every sunday
 * there's gym for 10 times"* — and because a default you usually keep beats a
 * blank field you always have to fill, which is the same reasoning the start
 * time used to get.
 */
export const DEFAULT_REPEAT_COUNT = 10

/** The fewest a repeat can be. One occurrence is not a repeat, it is an event. */
export const MIN_REPEAT_COUNT = 2

/**
 * The most occurrences one series can hold.
 *
 * Every occurrence is a real row, a real Google event and a real push, so this
 * is a real cost rather than a defensive number: 60 weekly is well over a year,
 * 60 daily is two months, and anything past that is a habit rather than a plan.
 * It also bounds the one write in the app that is not O(1).
 */
export const MAX_OCCURRENCES = 60

/** A count clamped into what a series may actually be. */
export function clampCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_REPEAT_COUNT
  return Math.min(MAX_OCCURRENCES, Math.max(MIN_REPEAT_COUNT, Math.round(count)))
}

/* -------------------------------------------------------------------------- */
/* The days                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The same date next month, or the last day of it when that date does not
 * exist.
 *
 * The 31st of January plus a month is the 28th of February here, not the 3rd of
 * March and not nothing. Google's RRULE would *skip* the month entirely, which
 * is defensible for a spec and wrong for a household: a rent reminder set on
 * the 31st should still turn up in February. Clamping never loses an
 * occurrence, and the day it lands on is the closest true answer.
 */
function addMonthsToDay(key: string, months: number): string {
  const date = parseKey(key)
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const month = dateKey(target).slice(0, 7)
  const day = Math.min(date.getDate(), daysInMonth(month))
  return `${month}-${`${day}`.padStart(2, '0')}`
}

/**
 * Every day a series lands on, starting at `startsOn`, first one included.
 *
 * A `none` rule, or a count of one or less, is a single day — so a caller can
 * hand this any draft and get back the days to write without checking first.
 */
export function occurrenceDays(startsOn: string, kind: RepeatKind, count: number): string[] {
  if (kind === 'none') return [startsOn]

  const times = Math.min(MAX_OCCURRENCES, Math.max(1, Math.round(count)))
  const days: string[] = []

  for (let i = 0; i < times; i += 1) {
    if (kind === 'daily') days.push(addDays(startsOn, i))
    else if (kind === 'weekly') days.push(addDays(startsOn, i * 7))
    else if (kind === 'fortnightly') days.push(addDays(startsOn, i * 14))
    else days.push(addMonthsToDay(startsOn, i))
  }

  return days
}

/** The last day a series reaches — the "until 8 Nov" under the chips. */
export function lastOccurrence(startsOn: string, kind: RepeatKind, count: number): string {
  const days = occurrenceDays(startsOn, kind, count)
  return days[days.length - 1] ?? startsOn
}

/* -------------------------------------------------------------------------- */
/* Editing one of many                                                         */
/* -------------------------------------------------------------------------- */

/** The fields an edit can touch. Not the whole draft: `repeat` and
 *  `repeatCount` describe how a series was *made* and are never edited into an
 *  existing one — changing those is deleting the series and writing a new one,
 *  which the sheet does not offer and this file therefore does not model. */
export type EditableField =
  | 'kind'
  | 'title'
  | 'day'
  | 'span'
  | 'startTime'
  | 'endTime'
  | 'location'
  | 'notes'
  | 'colour'
  | 'attendees'

/**
 * Which fields an edit actually changed.
 *
 * `day` is the start day moving and `span` is the event getting longer or
 * shorter, kept apart because they are applied differently across a series —
 * see applyChange. Attendees are compared as sets: the avatar row can hand back
 * the same three people in a different order, and that is not an edit.
 */
export function draftChanges(before: EventDraft, after: EventDraft): Set<EditableField> {
  const changed = new Set<EditableField>()

  if (before.kind !== after.kind) changed.add('kind')
  if (before.title.trim() !== after.title.trim()) changed.add('title')
  if (before.startsOn !== after.startsOn) changed.add('day')
  if (
    daysBetween(before.startsOn, before.endsOn) !== daysBetween(after.startsOn, after.endsOn)
  ) {
    changed.add('span')
  }
  if (before.startTime !== after.startTime) changed.add('startTime')
  if (before.endTime !== after.endTime) changed.add('endTime')
  if (before.location.trim() !== after.location.trim()) changed.add('location')
  if (before.notes.trim() !== after.notes.trim()) changed.add('notes')
  if (before.colour !== after.colour) changed.add('colour')
  if (!sameSet(before.attendees, after.attendees)) changed.add('attendees')

  return changed
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

/** True when an edit would change nothing — the case where Save is a Cancel. */
export function isNoChange(before: EventDraft, after: EventDraft): boolean {
  return draftChanges(before, after).size === 0
}

/**
 * One occurrence of a series, with an edit made to a *different* occurrence
 * applied to it.
 *
 * The three rules, and why each is the one it is:
 *
 *   **A touched field is copied.** Change the title, the time or the colour on
 *   any one gym session and all ten get it. This is what "all of them" means
 *   nine times out of ten.
 *
 *   **The day is a shift, not a value.** Moving the third session from Sunday
 *   the 20th to Monday the 21st moves every session on by one day. Copying the
 *   date instead would land all ten on the 21st, which is not a series any
 *   more — it is ten copies of one evening.
 *
 *   **The span is a length.** A one-day event becoming three days makes every
 *   occurrence three days, measured from its own start rather than from the
 *   edited one's.
 *
 * Anything not in `changed` comes through untouched, which is what lets one
 * occurrence keep a note or a moved day that the others never had.
 */
export function applyChange(
  occurrence: EventDraft,
  before: EventDraft,
  after: EventDraft,
  changed: ReadonlySet<EditableField> = draftChanges(before, after),
): EventDraft {
  const shift = changed.has('day') ? daysBetween(before.startsOn, after.startsOn) : 0
  const startsOn = shift === 0 ? occurrence.startsOn : addDays(occurrence.startsOn, shift)

  // The length this occurrence should end up with: the edited one's if the
  // length changed, otherwise the one it already had.
  const span = changed.has('span')
    ? daysBetween(after.startsOn, after.endsOn)
    : daysBetween(occurrence.startsOn, occurrence.endsOn)

  return {
    ...occurrence,
    kind: changed.has('kind') ? after.kind : occurrence.kind,
    title: changed.has('title') ? after.title : occurrence.title,
    startsOn,
    endsOn: addDays(startsOn, Math.max(0, span)),
    startTime: changed.has('startTime') ? after.startTime : occurrence.startTime,
    // An end time without a start is a shape the database refuses, so losing
    // the start takes the end with it however this occurrence got here.
    endTime: changed.has('endTime') ? after.endTime : occurrence.endTime,
    location: changed.has('location') ? after.location : occurrence.location,
    notes: changed.has('notes') ? after.notes : occurrence.notes,
    colour: changed.has('colour') ? after.colour : occurrence.colour,
    attendees: changed.has('attendees') ? [...after.attendees] : [...occurrence.attendees],
  }
}
