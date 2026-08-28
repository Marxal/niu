/*
 * "Fill the week" — what this household's weeks actually look like.
 *
 * NIU.md §4.2 has always said auto-suggest a week is wanted, "once there's
 * enough data. The user always approves." Round 10 deliberately did not build
 * it: with no planning history it could only rank by times-added, which is the
 * picker you already have. `times_planned` and a year of `meal_entries` rows
 * later, there is something real to read.
 *
 * ## What it learns, and why it is arithmetic rather than cleverness
 *
 * Three counts per thing you can plan, and nothing else:
 *
 *   slot    how often it turned up on *this weekday, at this meal*. Friday is
 *           taco night is the single strongest pattern a household has, and it
 *           is invisible to anything that only counts totals.
 *   meal    how often it turned up at this meal on any day. Catches the things
 *           that are only ever lunch.
 *   total   how often it was planned at all. The tie-breaker, and the only
 *           signal a brand-new dish has.
 *
 * They are weighted 6 / 2 / 1 and added. That ordering is the whole model, and
 * the reason it can be explained in one line on the sheet ("usually a Tuesday")
 * is the reason it is trustworthy — the same argument suggest.ts makes about
 * the "you usually need…" strip.
 *
 * ## Repeats are copied, not avoided
 *
 * §4.2 is emphatic: "Repeats are normal in this household and must not be
 * discouraged. The app should not avoid recent dishes." So there is no
 * freshness penalty anywhere in here. Two things follow from that:
 *
 *  - Each thing gets a **weekly budget** taken from its own history. Something
 *    planned on average 1.6 times a week may be proposed twice; something
 *    planned once a fortnight may be proposed once.
 *  - A thing this household usually eats two nights running is *proposed* two
 *    nights running, as a leftovers entry on the second night. Leftovers,
 *    rather than a second dish entry, because that is what the second night
 *    actually is and because a leftovers entry never puts anything on the
 *    shopping list (§4.2) — proposing the same dish twice would otherwise read
 *    as two shops.
 *
 * ## It fills gaps; it never overwrites
 *
 * A meal that already has something in it is left completely alone. "Magic"
 * that wiped Thursday's dinner because it thought it knew better would be used
 * exactly once.
 *
 * Pure: no Svelte, no Supabase, no clock of its own. Everything is passed in
 * and everything here is tested.
 */

import type { Meal, PlanEntry } from './plan'
import { addDays, startOfWeek, weekdayIndex } from './dates'

/* -------------------------------------------------------------------------- */
/* How much history is enough                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Weeks that must have something planned in them before the button works.
 *
 * Three, because two weeks cannot tell a habit from a coincidence: anything
 * that happened twice in two weeks looks like a rule. Three weeks is the first
 * point at which "we always" is distinguishable from "we did, twice".
 */
export const MIN_WEEKS = 3

/**
 * And how many entries across those weeks.
 *
 * A household that planned one dinner a week for three weeks has three facts,
 * not a pattern. Twelve is roughly a fortnight of two meals a day — enough that
 * the proposal is drawn from something rather than repeated from nothing.
 */
export const MIN_ENTRIES = 12

/** Weight on "this weekday, this meal". The strongest signal, by a distance. */
const SLOT_WEIGHT = 6
/** Weight on "this meal, any day". */
const MEAL_WEIGHT = 2
/** Weight on "planned at all". The tie-breaker. */
const TOTAL_WEIGHT = 1

/**
 * How often something must have followed itself the next day before the
 * proposal copies the habit.
 *
 * Half. Below that it is something that has happened, not something you do.
 */
const REPEAT_RATE = 0.5

/** A repeat needs the habit to have been seen at all, not just often. */
const MIN_REPEATS = 2

/* -------------------------------------------------------------------------- */
/* What can be planned                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One plannable thing, as a string, so counts live in one flat map.
 *
 * A dish and a catalogue item can share an id in principle — they are separate
 * tables — so the kind is part of the key rather than assumed.
 */
export type TargetKey = string

export function dishKey(dishId: string): TargetKey {
  return `dish:${dishId}`
}

export function itemKey(itemId: string): TargetKey {
  return `item:${itemId}`
}

/** The one key with no id behind it: eating out is a habit like any other. */
export const OUT_KEY: TargetKey = 'out'

/** Reads a key back into something that can be written to the database. */
export function parseTarget(
  key: TargetKey,
): { kind: 'dish'; dishId: string } | { kind: 'item'; itemId: string } | { kind: 'out' } | null {
  if (key === OUT_KEY) return { kind: 'out' }
  if (key.startsWith('dish:')) return { kind: 'dish', dishId: key.slice(5) }
  if (key.startsWith('item:')) return { kind: 'item', itemId: key.slice(5) }
  return null
}

/** The key an entry counts towards, or null if it is not a habit worth learning. */
function keyOf(entry: PlanEntry): TargetKey | null {
  if (entry.kind === 'dish' && entry.dishId) return dishKey(entry.dishId)
  if (entry.kind === 'item' && entry.itemId) return itemKey(entry.itemId)
  if (entry.kind === 'out') return OUT_KEY
  // Leftovers are counted as a repeat of their dish below, never on their own:
  // "leftovers of nothing" is not something anybody plans.
  return null
}

/* -------------------------------------------------------------------------- */
/* The pattern                                                                 */
/* -------------------------------------------------------------------------- */

export interface WeekPattern {
  /** Distinct weeks with at least one entry in them. */
  weeks: number
  /** Entries the counts were built from. */
  entries: number
  /** `${weekday}|${meal}|${key}` → times seen. */
  slots: ReadonlyMap<string, number>
  /** `${meal}|${key}` → times seen. */
  meals: ReadonlyMap<string, number>
  /** key → times seen anywhere. */
  totals: ReadonlyMap<TargetKey, number>
  /** key → times it was followed by itself the next day. */
  repeats: ReadonlyMap<TargetKey, number>
}

export const EMPTY_PATTERN: WeekPattern = {
  weeks: 0,
  entries: 0,
  slots: new Map(),
  meals: new Map(),
  totals: new Map(),
  repeats: new Map(),
}

function slotId(weekday: number, meal: Meal, key: TargetKey): string {
  return `${weekday}|${meal}|${key}`
}

function mealId(meal: Meal, key: TargetKey): string {
  return `${meal}|${key}`
}

function bump(map: Map<string, number>, id: string): void {
  map.set(id, (map.get(id) ?? 0) + 1)
}

/**
 * Reads the counts off a stretch of history.
 *
 * `before` is the week being filled: everything on or after it is ignored. That
 * is not tidiness, it is the difference between learning and copying — a
 * proposal built partly from the week it is proposing would confirm whatever
 * happened to be in it already.
 */
export function readWeekPattern(
  entries: readonly PlanEntry[],
  before: string,
): WeekPattern {
  const slots = new Map<string, number>()
  const meals = new Map<string, number>()
  const totals = new Map<TargetKey, number>()
  const repeats = new Map<TargetKey, number>()
  const weeks = new Set<string>()

  const past = entries.filter((entry) => entry.date < before)

  // Which days each key was planned on, for the repeat count below.
  const days = new Map<TargetKey, Set<string>>()

  for (const entry of past) {
    // Leftovers are not their own habit, but they *are* the second night of the
    // dish they name, so they count towards that dish's repeat rhythm.
    if (entry.kind === 'leftovers') {
      if (entry.dishId) {
        const key = dishKey(entry.dishId)
        const seen = days.get(key) ?? new Set<string>()
        seen.add(entry.date)
        days.set(key, seen)
      }
      continue
    }

    const key = keyOf(entry)
    if (key === null) continue

    weeks.add(startOfWeek(entry.date))
    bump(slots, slotId(weekdayIndex(entry.date), entry.meal, key))
    bump(meals, mealId(entry.meal, key))
    totals.set(key, (totals.get(key) ?? 0) + 1)

    const seen = days.get(key) ?? new Set<string>()
    seen.add(entry.date)
    days.set(key, seen)
  }

  for (const [key, seen] of days) {
    let following = 0
    for (const day of seen) {
      if (seen.has(addDays(day, 1))) following += 1
    }
    if (following > 0) repeats.set(key, following)
  }

  return { weeks: weeks.size, entries: past.length, slots, meals, totals, repeats }
}

/* -------------------------------------------------------------------------- */
/* Whether it can say anything yet                                             */
/* -------------------------------------------------------------------------- */

export interface Readiness {
  ready: boolean
  /** Weeks of history there are. */
  weeks: number
  /** How many more weeks are wanted. Zero once ready. */
  weeksShort: number
  /** How many more entries are wanted. Zero once ready. */
  entriesShort: number
}

/**
 * Both bars have to be cleared, and the message says which one is short.
 *
 * "Not yet" with no number attached is the sort of thing that makes a button
 * look broken. Telling someone it wants one more week is a thing they can act
 * on, and it is true.
 */
export function planReadiness(pattern: WeekPattern): Readiness {
  const weeksShort = Math.max(0, MIN_WEEKS - pattern.weeks)
  const entriesShort = Math.max(0, MIN_ENTRIES - pattern.entries)
  return {
    ready: weeksShort === 0 && entriesShort === 0,
    weeks: pattern.weeks,
    weeksShort,
    entriesShort,
  }
}

/* -------------------------------------------------------------------------- */
/* The proposal                                                                */
/* -------------------------------------------------------------------------- */

/** Why one card is being proposed, in the words the sheet uses. */
export type MagicReason = 'usual-day' | 'usual-meal' | 'often' | 'repeat'

export interface ProposedEntry {
  /** ISO `YYYY-MM-DD`. */
  date: string
  meal: Meal
  kind: 'dish' | 'item' | 'leftovers' | 'out'
  dishId: string | null
  itemId: string | null
  reason: MagicReason
}

export interface ProposeOptions {
  /** The Monday of the week to fill. */
  weekStart: string
  /** The meals this household has days made of. */
  meals: readonly Meal[]
  /** Entries already in the week. Their meals are left untouched. */
  existing: readonly PlanEntry[]
  /** Dish ids that still exist. A dish deleted since is not proposable. */
  dishIds: ReadonlySet<string>
  /** Catalogue ids that still exist and are not hidden. */
  itemIds: ReadonlySet<string>
  /**
   * Days before which nothing is proposed — "today", when filling this week.
   * Nobody plans Monday's lunch on Wednesday (§4.2, and the rule the day view
   * already follows).
   */
  from?: string
}

/**
 * Sightings on one weekday, at one meal, before it counts as "usually a
 * Tuesday".
 *
 * Two. One is a thing that happened; the whole reason the weekday signal is
 * weighted six times the total is that it is meant to catch a habit, and a
 * habit seen once is not one.
 */
const MIN_ANCHOR = 2

/**
 * How many of a thing a week may have, from how many it usually has.
 *
 * Rounded up, so 1.4 lasagnes a week is allowed to be two rather than silently
 * one — the budget is a ceiling on repetition, not a quota to hit, and one that
 * rounded down would flatten exactly the households this is for.
 */
function budgetFor(total: number, weeks: number): number {
  if (weeks <= 0) return 1
  return Math.max(1, Math.ceil(total / weeks))
}

/** Does this household eat this again the next day, more often than not? */
function repeatsItself(pattern: WeekPattern, key: TargetKey): boolean {
  const total = pattern.totals.get(key) ?? 0
  const following = pattern.repeats.get(key) ?? 0
  if (total === 0 || following < MIN_REPEATS) return false
  return following / total >= REPEAT_RATE
}

/**
 * The week being built, and the four rules that keep it honest. Mutable
 * because a proposal is built by placing one card at a time and every later
 * placement depends on the ones before it.
 */
interface Board {
  out: ProposedEntry[]
  /** `${date}|${meal}` that must not be written into. */
  taken: Set<string>
  /** key → how many more of it this week may have. */
  budget: Map<TargetKey, number>
  /** date → keys already on that day. */
  onDay: Map<string, Set<TargetKey>>
}

/**
 * Puts one thing in one meal, and — if this household eats it again the next
 * day — tomorrow's leftovers with it.
 *
 * The second night is a **leftovers** entry rather than a second dish entry,
 * for two reasons. It is what the night actually is (§4.2: "the first
 * appearance of a dish is a cook, an immediately following one is a repeat"),
 * and a leftovers entry never puts anything on the shopping list — proposing
 * the dish twice would read as two shops for one lasagne.
 *
 * The repeat spends budget too, floored at zero. Without that, a household
 * that writes both nights as dish entries would get a third night: their
 * budget is two, the cook spends one, and the leftovers we added for free
 * leaves a slot still open.
 */
function place(
  board: Board,
  pattern: WeekPattern,
  entry: ProposedEntry,
  key: TargetKey,
  options: ProposeOptions,
): void {
  board.out.push(entry)
  board.taken.add(`${entry.date}|${entry.meal}`)
  board.budget.set(key, Math.max(0, (board.budget.get(key) ?? 1) - 1))

  const day = board.onDay.get(entry.date) ?? new Set<TargetKey>()
  day.add(key)
  board.onDay.set(entry.date, day)

  if (entry.kind !== 'dish' || entry.dishId === null) return
  if (!repeatsItself(pattern, key)) return

  const next = addDays(entry.date, 1)
  if (next >= addDays(options.weekStart, 7)) return
  if (options.from !== undefined && next < options.from) return
  if (board.taken.has(`${next}|${entry.meal}`)) return

  board.out.push({
    date: next,
    meal: entry.meal,
    kind: 'leftovers',
    dishId: entry.dishId,
    itemId: null,
    reason: 'repeat',
  })
  board.taken.add(`${next}|${entry.meal}`)
  board.budget.set(key, Math.max(0, (board.budget.get(key) ?? 1) - 1))

  const tomorrow = board.onDay.get(next) ?? new Set<TargetKey>()
  tomorrow.add(key)
  board.onDay.set(next, tomorrow)
}

/** Whether a key can still go in this meal on this day. */
function allowed(board: Board, key: TargetKey, date: string, meal: Meal, options: ProposeOptions): boolean {
  if (board.taken.has(`${date}|${meal}`)) return false
  if ((board.budget.get(key) ?? 0) <= 0) return false
  if (board.onDay.get(date)?.has(key)) return false

  const target = parseTarget(key)
  if (target === null) return false
  if (target.kind === 'dish' && !options.dishIds.has(target.dishId)) return false
  if (target.kind === 'item' && !options.itemIds.has(target.itemId)) return false
  return true
}

/** A proposed entry for a key, without the reason. */
function entryFor(key: TargetKey, date: string, meal: Meal, reason: MagicReason): ProposedEntry | null {
  const target = parseTarget(key)
  if (target === null) return null
  return {
    date,
    meal,
    kind: target.kind,
    dishId: target.kind === 'dish' ? target.dishId : null,
    itemId: target.kind === 'item' ? target.itemId : null,
    reason,
  }
}

/**
 * Builds a week out of the pattern, in two passes.
 *
 * **Anchors first.** Everything with a real weekday habit — seen at least twice
 * on the same weekday at the same meal — claims that day before anything else
 * is placed. This pass is the whole reason the module exists: a single greedy
 * scan down the week gives Friday's tacos to Monday, because Monday is simply
 * the first empty meal it meets, and a proposal that moves taco night is a
 * proposal that gets rejected.
 *
 * **Then fill.** The remaining empty meals take the best thing still available,
 * scored the ordinary way. This is where the things you eat often but not on
 * any particular day end up.
 *
 * Deterministic throughout, and every tie broken on a key rather than left to
 * map order. Two people looking at the same proposal on two phones must see the
 * same week; "give me another one" is something the sheet offers by dropping
 * cards, not something the ranking should do behind anyone's back.
 */
export function proposeWeek(pattern: WeekPattern, options: ProposeOptions): ProposedEntry[] {
  const { weekStart, meals, existing, from } = options
  if (meals.length === 0) return []

  const board: Board = {
    out: [],
    taken: new Set(existing.map((entry) => `${entry.date}|${entry.meal}`)),
    budget: new Map(),
    onDay: new Map(),
  }

  for (const [key, total] of pattern.totals) {
    board.budget.set(key, budgetFor(total, pattern.weeks))
  }

  const mealOrder = new Map(meals.map((meal, index) => [meal, index]))

  /* ---- Pass one: the days that are already spoken for -------------------- */

  interface Anchor {
    key: TargetKey
    weekday: number
    meal: Meal
    count: number
  }

  const anchors: Anchor[] = []
  for (const [id, count] of pattern.slots) {
    if (count < MIN_ANCHOR) continue
    const cut = id.indexOf('|')
    const second = id.indexOf('|', cut + 1)
    const weekday = Number(id.slice(0, cut))
    const meal = id.slice(cut + 1, second) as Meal
    const key = id.slice(second + 1)
    if (!mealOrder.has(meal)) continue
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue
    anchors.push({ key, weekday, meal, count })
  }

  anchors.sort(
    (a, b) =>
      b.count - a.count ||
      a.weekday - b.weekday ||
      (mealOrder.get(a.meal) ?? 0) - (mealOrder.get(b.meal) ?? 0) ||
      a.key.localeCompare(b.key),
  )

  for (const anchor of anchors) {
    const date = addDays(weekStart, anchor.weekday)
    if (from !== undefined && date < from) continue
    if (!allowed(board, anchor.key, date, anchor.meal, options)) continue

    const entry = entryFor(anchor.key, date, anchor.meal, 'usual-day')
    if (entry !== null) place(board, pattern, entry, anchor.key, options)
  }

  /* ---- Pass two: everything else ----------------------------------------- */

  for (let day = 0; day < 7; day += 1) {
    const date = addDays(weekStart, day)
    if (from !== undefined && date < from) continue

    for (const meal of meals) {
      if (board.taken.has(`${date}|${meal}`)) continue

      const pick = bestFor(pattern, board, weekdayIndex(date), date, meal, options)
      if (pick === null) continue

      const entry = entryFor(pick.key, date, meal, pick.reason)
      if (entry !== null) place(board, pattern, entry, pick.key, options)
    }
  }

  // Built out of order by the two passes; handed back in the order it reads.
  return board.out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (mealOrder.get(a.meal) ?? 0) - (mealOrder.get(b.meal) ?? 0),
  )
}

interface Candidate {
  key: TargetKey
  score: number
  reason: MagicReason
}

/** The best thing to put in one empty meal, or null when nothing qualifies. */
function bestFor(
  pattern: WeekPattern,
  board: Board,
  weekday: number,
  date: string,
  meal: Meal,
  options: ProposeOptions,
): Candidate | null {
  let best: Candidate | null = null

  for (const [key, total] of pattern.totals) {
    if (!allowed(board, key, date, meal, options)) continue

    const onDay = pattern.slots.get(slotId(weekday, meal, key)) ?? 0
    const atMeal = pattern.meals.get(mealId(meal, key)) ?? 0
    const score = onDay * SLOT_WEIGHT + atMeal * MEAL_WEIGHT + total * TOTAL_WEIGHT

    const reason: MagicReason = onDay > 0 ? 'usual-day' : atMeal > 0 ? 'usual-meal' : 'often'

    if (best === null || score > best.score || (score === best.score && key < best.key)) {
      best = { key, score, reason }
    }
  }

  return best
}
