/*
 * The week: what a planned meal is, and the date arithmetic around it.
 *
 * Pure — no Svelte, no Supabase, no DOM — because dates are the classic place a
 * phone app is quietly wrong for one week of the year and nobody notices until
 * it is. Everything here is tested.
 *
 * The one idea to hold on to (Marçal's call, round 10): **a meal is a bag, not a
 * set of slots.** NIU.md §4.2 asks for fixed slots defaulting to protein /
 * carbs / vegetables, but round 9 turned exactly those words into dish *tags* a
 * dish can carry several of at once. So a meal holds any number of entries in
 * the order you put them there, each carrying its own colour from its dish's
 * tags, and "a protein, a carb and a vegetable" is something you can see rather
 * than a shape you have to fill.
 *
 * ## Dates are keys, not Date objects
 *
 * Every day is an ISO `YYYY-MM-DD` string, which is also exactly what Postgres
 * `date` gives back. They compare and sort as strings, they survive a round trip
 * through JSON unchanged, and they carry no time and therefore no timezone.
 *
 * A `Date` is only ever built to do arithmetic with, always from local parts —
 * `new Date(y, m - 1, d)`, never `new Date('2026-09-01')`, which the spec reads
 * as UTC midnight and which is therefore the *previous* day in Gothenburg for
 * most of the year. That single distinction is the whole reason this file exists.
 */

import { strings } from './strings'

/** Which meals a day can have. §4.2: configurable, defaulting to lunch+dinner. */
export type Meal = 'breakfast' | 'lunch' | 'dinner'

/** In the order they happen. Any subset a household chooses keeps this order. */
export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner']

export const DEFAULT_MEALS: readonly Meal[] = ['lunch', 'dinner']

export function isMeal(value: unknown): value is Meal {
  return MEALS.includes(value as Meal)
}

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: strings.plan.mealBreakfast,
  lunch: strings.plan.mealLunch,
  dinner: strings.plan.mealDinner,
}

/**
 * What one entry in a meal is.
 *
 *   dish       cook this
 *   item       a plain catalogue item — "broccoli on Tuesday" (§4.2)
 *   leftovers  eat it again. Never puts anything on the shopping list.
 *   out        eating out. Nothing to cook, nothing to buy.
 */
export type EntryKind = 'dish' | 'item' | 'leftovers' | 'out'

export const ENTRY_KINDS: readonly EntryKind[] = ['dish', 'item', 'leftovers', 'out']

export function isEntryKind(value: unknown): value is EntryKind {
  return ENTRY_KINDS.includes(value as EntryKind)
}

export interface PlanEntry {
  id: string
  /** ISO `YYYY-MM-DD`. */
  date: string
  meal: Meal
  position: number
  kind: EntryKind
  /** Set for 'dish', optionally for 'leftovers', null otherwise. */
  dishId: string | null
  /** Set for 'item', null otherwise. */
  itemId: string | null
  /**
   * Someone has said this one needs cooking (Marçal, round 10.1).
   *
   * Not the same thing as the dish's own `cook` — that says a lasagne is a slow
   * one, which is true forever. This says that *tonight*, somebody has to
   * actually do it. Set by hand, never inferred; see 0011_planner_tweaks.sql.
   */
  toCook: boolean
  note: string | null
  createdAt: string
}

/** Where an entry sits. The unit a drag moves it between. */
export interface Slot {
  date: string
  meal: Meal
}

export function sameSlot(a: Slot, b: Slot): boolean {
  return a.date === b.date && a.meal === b.meal
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

/** A local Date as an ISO day key. Local parts only — see the header. */
export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * A key back to a local Date at midnight.
 *
 * Anything unparseable comes back as today rather than an Invalid Date, because
 * one bad row from the database should not blank the whole planner.
 */
export function parseKey(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return startOfDay(new Date())
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now)
}

/**
 * N days on from a key. Handles month ends, leap years and the two clock
 * changes for free, because Date does — as long as it is built from local parts,
 * which parseKey guarantees.
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
 * Monday because both households this is built for are in Europe. A household
 * that wanted Sunday would change this one number — it is deliberately not a
 * preference, because a week that starts differently on two phones is a week
 * two people cannot talk about.
 */
export function startOfWeek(key: string): string {
  const date = parseKey(key)
  // getDay(): 0 = Sunday. Monday-based offset, so Sunday goes back six days.
  const offset = (date.getDay() + 6) % 7
  return addDays(key, -offset)
}

/** The seven day keys of the week that starts on `startKey`. */
export function weekDays(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startKey, i))
}

/**
 * The days the *day view* should show — which is not always the whole week.
 *
 * In the week you are actually in, it starts at today. Nobody plans Monday's
 * dinner on Wednesday, and two dead days at the top of the screen are two days
 * of scrolling past before reaching the question you opened the app to answer
 * (Marçal, round 10.1).
 *
 * Any other week shows all seven, and that is the same rule rather than an
 * exception to it: a week you have deliberately stepped back to is one you are
 * looking at on purpose, and a past week with its first days missing would be a
 * week with a hole in it. The week *view* always shows seven, because its job is
 * the shape of the whole week.
 */
export function planningDays(startKey: string, today: string): string[] {
  const all = weekDays(startKey)
  const last = all[6] ?? startKey
  if (today < startKey || today > last) return all
  return all.filter((day) => day >= today)
}

/* -------------------------------------------------------------------------- */
/* Reading a date out loud                                                     */
/* -------------------------------------------------------------------------- */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * "Today", "Tomorrow", "Yesterday", or the weekday name.
 *
 * The three relative words are worth the special case: the planner's whole job
 * is answering "what are we eating tonight", and a heading reading "Wednesday"
 * makes you check what day it is first.
 */
export function dayName(key: string, today: string): string {
  const gap = daysBetween(today, key)
  if (gap === 0) return 'Today'
  if (gap === 1) return 'Tomorrow'
  if (gap === -1) return 'Yesterday'
  return WEEKDAYS[parseKey(key).getDay()] ?? key
}

/** Three letters, for the week view where there is no room for a word. */
export function shortDayName(key: string): string {
  return WEEKDAYS_SHORT[parseKey(key).getDay()] ?? key
}

/** "3 Sep" — the date under the day's name. */
export function shortDate(key: string): string {
  const date = parseKey(key)
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`
}

/**
 * What the week stepper says: "This week", "Next week", or a date range.
 *
 * A range rather than a week number, because nobody in this household thinks in
 * week numbers, and "1–7 Sep" is the same length on screen.
 */
export function weekName(startKey: string, today: string): string {
  const gap = daysBetween(startOfWeek(today), startKey)
  if (gap === 0) return 'This week'
  if (gap === 7) return 'Next week'
  if (gap === -7) return 'Last week'

  const end = addDays(startKey, 6)
  const from = parseKey(startKey)
  const to = parseKey(end)
  // Same month: say the month once. "1–7 Sep" rather than "1 Sep – 7 Sep".
  if (from.getMonth() === to.getMonth()) {
    return `${from.getDate()}–${to.getDate()} ${MONTHS_SHORT[from.getMonth()]}`
  }
  return `${shortDate(startKey)} – ${shortDate(end)}`
}

/* -------------------------------------------------------------------------- */
/* Arranging the entries                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Entries in the order they should be drawn: by day, then by meal in the order
 * meals happen, then by the position someone dragged them into.
 *
 * created_at breaks a position tie. Two phones adding to the same meal in the
 * same second can land on the same number — last write wins is the project's
 * stance (§3) and this is what stops that showing up as two cards swapping
 * places on every reload.
 */
export function sortEntries(entries: readonly PlanEntry[]): PlanEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) ||
      a.position - b.position ||
      a.createdAt.localeCompare(b.createdAt),
  )
}

/** Everything planned into one meal on one day, in order. */
export function entriesIn(entries: readonly PlanEntry[], slot: Slot): PlanEntry[] {
  return sortEntries(entries.filter((e) => e.date === slot.date && e.meal === slot.meal))
}

/** Entries falling inside a range of days, inclusive at both ends. */
export function entriesBetween(
  entries: readonly PlanEntry[],
  from: string,
  to: string,
): PlanEntry[] {
  return sortEntries(entries.filter((e) => e.date >= from && e.date <= to))
}

/**
 * The position a new entry should take in a meal: after everything already
 * there. Gaps left by deletions are fine — only the order matters.
 */
export function nextPosition(entries: readonly PlanEntry[], slot: Slot): number {
  return entriesIn(entries, slot).reduce((n, e) => Math.max(n, e.position + 1), 0)
}

/* -------------------------------------------------------------------------- */
/* Cook, then repeat                                                           */
/* -------------------------------------------------------------------------- */

/** Whether an entry is the night you cook something or a night you eat it again. */
export type Rhythm = 'cook' | 'repeat'

/**
 * Which planned dishes are cooks and which are repeats.
 *
 * §4.2 is unusually specific here: "Repeats are normal in this household and
 * must not be discouraged. The app should not avoid recent dishes. It should
 * instead learn the cook-then-repeat rhythm: the first appearance of a dish is a
 * cook, an immediately following one is a repeat."
 *
 * So this is inferred rather than asked for. You do not tick a box saying
 * Tuesday is the second night of Monday's lasagne — you plan lasagne twice and
 * the planner works it out, which is the only version anyone would actually use.
 *
 * "Immediately following" means within a day. Lasagne on Monday and again on
 * Tuesday is one cook; lasagne this Monday and next Monday is two. An explicit
 * leftovers entry is always a repeat — that is what the word means — and it
 * carries the rhythm forward, so a third consecutive night is a repeat too.
 *
 * Only dish-bearing entries appear in the result. A plain item or an eating-out
 * entry has no rhythm to speak of.
 */
export function mealRhythm(entries: readonly PlanEntry[]): Map<string, Rhythm> {
  const out = new Map<string, Rhythm>()
  const lastSeen = new Map<string, string>()

  for (const entry of sortEntries(entries)) {
    if (entry.kind === 'leftovers') {
      out.set(entry.id, 'repeat')
      if (entry.dishId) lastSeen.set(entry.dishId, entry.date)
      continue
    }

    if (entry.kind !== 'dish' || !entry.dishId) continue

    const previous = lastSeen.get(entry.dishId)
    const near = previous !== undefined && daysBetween(previous, entry.date) <= 1
    out.set(entry.id, near ? 'repeat' : 'cook')
    lastSeen.set(entry.dishId, entry.date)
  }

  return out
}
