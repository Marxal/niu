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
 * ## Dates live next door
 *
 * A day is an ISO `YYYY-MM-DD` string and the arithmetic on those strings moved
 * to dates.ts in round 11, when the calendar turned out to need every line of
 * it. The rules are unchanged and they are written down there; what is left
 * here is the part that is about *weeks of meals* rather than about days.
 */

import { addDays, dateRange, daysBetween, startOfWeek, weekDays } from './dates'
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

/*
 * The date arithmetic lives in dates.ts now — the calendar needs every line of
 * it and two copies of "which day is this" is exactly the bug this project
 * cannot afford. It is re-exported rather than moved outright so that the
 * planner's own files keep importing days from the module about days.
 */
export {
  addDays,
  dateKey,
  dayName,
  daysBetween,
  parseKey,
  shortDate,
  shortDayName,
  startOfWeek,
  todayKey,
  weekDays,
} from './dates'

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
  return dateRange(startKey, addDays(startKey, 6))
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
