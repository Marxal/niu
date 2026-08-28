/*
 * The plan, live: what's on which day, and every way it can be changed.
 *
 * One table behind it (meal_entries, 0010_meal_plan.sql) and one window of it in
 * memory at a time. The window is generous — five weeks around whichever week is
 * on screen — because a household's whole plan is a few hundred rows and paging
 * it precisely would buy nothing but bugs at the boundaries.
 *
 * ## Optimistic, unlike the dish library
 *
 * dishes.svelte.ts writes then re-reads, on the grounds that editing a dish
 * happens once a month from a sheet you are staring at. The planner is the
 * opposite: you fill a week in a burst of taps, and you *drag* things between
 * days. A card that flies back to Monday for 300ms while the server thinks about
 * it is not a card you can drag. So every change here lands locally first and
 * rolls back if the write fails, exactly like the shopping list.
 *
 * Realtime then overwrites all of it, which is what makes the two phones agree:
 * a change made here and a change made on the sofa take the same path home.
 *
 * Fail soft throughout: a failed call sets `error`, puts the plan back the way
 * it was, and leaves the week on screen.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { household } from './household.svelte'
import {
  type EntryKind,
  type Meal,
  type PlanEntry,
  type Slot,
  addDays,
  isEntryKind,
  isMeal,
  nextPosition,
  startOfWeek,
  todayKey,
} from './plan'
import { reloadList } from './shopping.svelte'
import { strings } from './strings'
import { supabase } from './supabase'

interface EntryRow {
  id: string
  on_date: string
  meal: string
  position: number
  kind: string
  dish_id: string | null
  catalogue_item_id: string | null
  to_cook: boolean
  note: string | null
  created_at: string
}

const ENTRY_COLUMNS =
  'id, on_date, meal, position, kind, dish_id, catalogue_item_id, to_cook, note, created_at'

/** How far either side of the shown week to fetch. See the header. */
const WINDOW_BEFORE = 7
const WINDOW_AFTER = 27

/**
 * A row, checked rather than trusted. `meal` and `kind` are constrained in the
 * database, but a value written by a newer version of the app than this one
 * would otherwise flow straight into a type that says it cannot exist — and the
 * rendering would then fall through every branch and draw an empty card.
 */
function toEntry(row: EntryRow): PlanEntry {
  return {
    id: row.id,
    date: row.on_date,
    meal: isMeal(row.meal) ? row.meal : 'dinner',
    position: row.position,
    kind: isEntryKind(row.kind) ? row.kind : 'dish',
    dishId: row.dish_id,
    itemId: row.catalogue_item_id,
    toCook: row.to_cook ?? false,
    note: row.note,
    createdAt: row.created_at,
  }
}

class PlanState {
  entries = $state<PlanEntry[]>([])
  /**
   * A long tail of past weeks, for Fill the week to read a pattern off.
   *
   * Kept apart from `entries` rather than widening that window, because the two
   * are wanted at completely different moments. `entries` is redrawn on every
   * arrow tap and has to stay small; this is fetched once when the planner
   * opens and then left alone, and nothing draws it — plan-magic.ts only counts
   * it. Merging them would make every week step re-read three months.
   */
  history = $state<PlanEntry[]>([])
  /**
   * The week `history` was actually read for.
   *
   * Not decoration: two arrow taps in quick succession put two of these
   * requests in flight, and the network is under no obligation to answer them
   * in order. Without this check the slower, older answer can land last and
   * leave the pattern reading a window that is one week out — which would show
   * up as a Fill the week proposal that is subtly wrong and impossible to
   * explain.
   */
  historyFor = $state<string | null>(null)
  /** The Monday of the week being looked at. Never written to the database. */
  weekStart = $state<string>(startOfWeek(todayKey()))
  loading = $state(false)
  error = $state<string | null>(null)

  byId = $derived(new Map(this.entries.map((entry) => [entry.id, entry])))
}

export const plan = new PlanState()

/** Steps the planner to another week. The load effect follows it. */
export function showWeek(startKey: string): void {
  plan.weekStart = startOfWeek(startKey)
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Reads the window around the week on screen.
 *
 * The old entries are deliberately left in place while this runs. Stepping a
 * week would otherwise blank the planner for the length of a round trip, and a
 * plan that flickers empty every time you tap an arrow reads as a plan that got
 * lost.
 */
export async function loadPlan(): Promise<void> {
  if (!supabase || !household.id) return

  const from = addDays(plan.weekStart, -WINDOW_BEFORE)
  const to = addDays(plan.weekStart, WINDOW_AFTER)

  plan.loading = true

  const { data, error } = await supabase
    .from('meal_entries')
    .select(ENTRY_COLUMNS)
    .eq('household_id', household.id)
    .gte('on_date', from)
    .lte('on_date', to)

  plan.loading = false

  if (error || !data) {
    plan.error = strings.plan.loadFailed
    return
  }

  plan.error = null
  plan.entries = (data as EntryRow[]).map(toEntry)
}

/**
 * How far back Fill the week looks.
 *
 * Twelve weeks. Long enough that a fortnightly habit shows up six times and a
 * weekly one twelve, short enough that what it reads is still how this
 * household eats *now* — a pattern learnt from last winter is not a fact about
 * September. It is also a small query: three months of two meals a day is under
 * two hundred rows.
 */
const HISTORY_DAYS = 84

/**
 * Reads the stretch of past weeks the magic button learns from.
 *
 * Fetched once per week-on-screen rather than on every step, and never
 * blocking: the planner is perfectly usable while this is in flight, and a
 * failure means the button stays quiet rather than that the screen breaks
 * (rule 5, fail soft). It re-reads when the plan changes, because a week you
 * have just filled in is history the moment you step past it.
 */
export async function loadPlanHistory(): Promise<void> {
  if (!supabase || !household.id) return

  const week = plan.weekStart
  const from = addDays(week, -HISTORY_DAYS)

  const { data, error } = await supabase
    .from('meal_entries')
    .select(ENTRY_COLUMNS)
    .eq('household_id', household.id)
    .gte('on_date', from)
    .lt('on_date', week)

  if (error || !data) return

  // The week moved while this was in the air: this answer is about a window
  // nobody is looking at any more, and a newer request is already on its way.
  if (plan.weekStart !== week) return

  plan.history = (data as EntryRow[]).map(toEntry)
  plan.historyFor = week
}

let channel: RealtimeChannel | null = null

/**
 * Keeps the plan in step with the other phone.
 *
 * Re-reads the window on any change rather than patching the one row, the same
 * call shops.svelte.ts and dishes.svelte.ts make: a week is a few dozen rows,
 * and a move is an update that has to land in two places at once.
 */
export function watchPlan(): () => void {
  if (!supabase || !household.id) return () => {}

  const client = supabase

  /*
   * One re-read per burst, not one per row.
   *
   * Realtime sends a message per row, and since round 15 a single tap can write
   * a whole week — Fill the week inserts fourteen rows in one statement and
   * gets fourteen messages back. Undebounced that is twenty-eight round trips
   * and fourteen redraws for one button, on both phones. A short wait collapses
   * the burst into one, and costs a quarter of a second on the single-card case
   * that the optimistic write in planEntry has already drawn anyway.
   */
  let pending: ReturnType<typeof setTimeout> | null = null

  const refresh = () => {
    if (pending !== null) clearTimeout(pending)
    pending = setTimeout(() => {
      pending = null
      void loadPlan()
      // The pattern is read off history, and a week planned on the other phone
      // is part of it the moment it is written.
      void loadPlanHistory()
    }, 250)
  }

  channel = client
    .channel(`plan:${household.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'meal_entries',
        filter: `household_id=eq.${household.id}`,
      },
      () => refresh(),
    )
    .subscribe()

  return () => {
    if (pending !== null) {
      clearTimeout(pending)
      pending = null
    }
    if (channel) {
      void client.removeChannel(channel)
      channel = null
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Changing the plan                                                           */
/* -------------------------------------------------------------------------- */

/** What is being planned: a dish, a plain catalogue item, or a marker. */
export type PlanTarget =
  | { kind: 'dish'; dishId: string }
  | { kind: 'item'; itemId: string }
  | { kind: 'leftovers'; dishId: string | null }
  | { kind: 'out' }

/** Extras that ride along with whatever is being planned. */
export interface PlanOptions {
  /** Mark it "needs cooking" as it goes in. */
  toCook?: boolean
}

function targetColumns(target: PlanTarget): {
  kind: EntryKind
  dish_id: string | null
  catalogue_item_id: string | null
} {
  switch (target.kind) {
    case 'dish':
      return { kind: 'dish', dish_id: target.dishId, catalogue_item_id: null }
    case 'item':
      return { kind: 'item', dish_id: null, catalogue_item_id: target.itemId }
    case 'leftovers':
      return { kind: 'leftovers', dish_id: target.dishId, catalogue_item_id: null }
    case 'out':
      return { kind: 'out', dish_id: null, catalogue_item_id: null }
  }
}

/**
 * Puts something into a meal.
 *
 * Optimistic, with a temporary id that the row from the server replaces. The
 * temporary row is filtered out rather than patched if the write fails, so a
 * card can never be left on screen that isn't in the database — which on a
 * shared plan would be worse than the tap appearing not to work.
 */
export async function planEntry(
  slot: Slot,
  target: PlanTarget,
  userId: string,
  options: PlanOptions = {},
): Promise<string | null> {
  if (!supabase || !household.id) return null

  const columns = targetColumns(target)
  const toCook = options.toCook ?? false
  const position = nextPosition(plan.entries, slot)
  const temporaryId = `pending:${crypto.randomUUID()}`

  const previous = plan.entries
  plan.entries = [
    ...plan.entries,
    {
      id: temporaryId,
      date: slot.date,
      meal: slot.meal,
      position,
      kind: columns.kind,
      dishId: columns.dish_id,
      itemId: columns.catalogue_item_id,
      toCook,
      note: null,
      createdAt: new Date().toISOString(),
    },
  ]

  const { data, error } = await supabase
    .from('meal_entries')
    .insert({
      household_id: household.id,
      on_date: slot.date,
      meal: slot.meal,
      position,
      to_cook: toCook,
      created_by: userId,
      ...columns,
    })
    .select(ENTRY_COLUMNS)
    .maybeSingle()

  if (error || !data) {
    plan.entries = previous
    plan.error = strings.plan.saveFailed
    return null
  }

  const saved = toEntry(data as EntryRow)
  plan.error = null
  plan.entries = plan.entries.map((entry) => (entry.id === temporaryId ? saved : entry))
  return saved.id
}

/** One card of a proposed week, ready to write. */
export interface PlanDraft {
  date: string
  meal: Meal
  target: PlanTarget
}

/**
 * Writes a whole proposed week in one round trip — what Fill the week does once
 * its proposal is approved.
 *
 * One insert rather than a loop of `planEntry`, and for the same reason
 * addManyToList exists on the shopping side: fourteen separate writes arrive on
 * the other phone as fourteen separate realtime messages, so somebody sitting
 * on the sofa watches the week assemble itself card by card. One statement is
 * one moment.
 *
 * Not optimistic, unlike `planEntry`. A single tap that plants one card has to
 * feel instant; a button that fills a week is understood to be doing something,
 * and drawing fourteen temporary cards only to swap every one of them a moment
 * later is a lot of flicker to buy very little. The rows come back from the
 * insert and go straight in.
 *
 * Positions are worked out from what is already in each meal, so a proposal
 * dropped into a week that is half full lands after what is there rather than
 * on top of it.
 *
 * Returns how many were planned, or null if the write failed and nothing
 * changed.
 */
export async function planMany(
  drafts: readonly PlanDraft[],
  userId: string,
): Promise<number | null> {
  if (!supabase || !household.id) return null
  if (drafts.length === 0) return 0

  // Two cards proposed into the same meal must not both claim the same
  // position, so the count is kept here rather than re-read per draft.
  const positions = new Map<string, number>()

  const rows = drafts.map((draft) => {
    const slot = { date: draft.date, meal: draft.meal }
    const key = `${draft.date}|${draft.meal}`
    const position = positions.get(key) ?? nextPosition(plan.entries, slot)
    positions.set(key, position + 1)

    return {
      household_id: household.id,
      on_date: draft.date,
      meal: draft.meal,
      position,
      to_cook: false,
      created_by: userId,
      ...targetColumns(draft.target),
    }
  })

  const { data, error } = await supabase.from('meal_entries').insert(rows).select(ENTRY_COLUMNS)

  if (error || !data) {
    plan.error = strings.plan.saveFailed
    return null
  }

  const saved = (data as EntryRow[]).map(toEntry)
  const known = new Set(plan.entries.map((entry) => entry.id))
  plan.entries = [...plan.entries, ...saved.filter((entry) => !known.has(entry.id))]
  plan.error = null

  return saved.length
}

/**
 * Marks a planned meal as one that needs cooking, or unmarks it.
 *
 * Deliberately a hand-set flag rather than something worked out from the dish
 * (Marçal, round 10.1). The planner already infers the opposite mark — a repeat,
 * from the same dish two nights running — and inferring this one too would leave
 * every card in the week asserting something about cooking. The value of this
 * one is that it is a note you left yourself.
 */
export async function setToCook(entryId: string, toCook: boolean): Promise<void> {
  if (!supabase) return

  const entry = plan.byId.get(entryId)
  if (!entry || entry.toCook === toCook) return

  const previous = plan.entries
  plan.entries = plan.entries.map((row) => (row.id === entryId ? { ...row, toCook } : row))

  const { error } = await supabase
    .from('meal_entries')
    .update({ to_cook: toCook })
    .eq('id', entryId)

  if (error) {
    plan.entries = previous
    plan.error = strings.plan.saveFailed
  }
}

/**
 * Moves an entry to another day or meal — what a drag actually does.
 *
 * Lands locally before the write, because the whole gesture is the card being
 * where the finger left it. A move onto the meal it is already in is dropped
 * here rather than sent: dragging something a few pixels and putting it back is
 * the commonest thing that happens by accident.
 */
export async function moveEntry(entryId: string, slot: Slot): Promise<boolean> {
  if (!supabase) return false

  const entry = plan.byId.get(entryId)
  if (!entry) return false
  if (entry.date === slot.date && entry.meal === slot.meal) return true

  const position = nextPosition(plan.entries, slot)

  const previous = plan.entries
  plan.entries = plan.entries.map((row) =>
    row.id === entryId ? { ...row, date: slot.date, meal: slot.meal, position } : row,
  )

  const { error } = await supabase
    .from('meal_entries')
    .update({ on_date: slot.date, meal: slot.meal, position })
    .eq('id', entryId)

  if (error) {
    plan.entries = previous
    plan.error = strings.plan.saveFailed
    return false
  }

  plan.error = null
  return true
}

/**
 * Turns a planned dish into leftovers of itself, or back.
 *
 * The same card either way — it is the same dish on the same night, and what
 * changed is only whether it is cooked then. That is why this is a toggle on an
 * existing entry rather than a delete and a re-add: a re-add would count as a
 * second planning of the dish and skew the picker's order.
 */
export async function setEntryKind(entryId: string, kind: EntryKind): Promise<boolean> {
  if (!supabase) return false

  const entry = plan.byId.get(entryId)
  if (!entry || entry.kind === kind) return true

  // The database's shape constraint won't have a 'dish' entry without a dish, or
  // a 'leftovers' entry carrying a catalogue item. Refuse here rather than send
  // a row that can only come back as an error.
  if (kind === 'dish' && !entry.dishId) return false
  if (kind === 'item' && !entry.itemId) return false

  const columns =
    kind === 'out'
      ? { kind, dish_id: null, catalogue_item_id: null }
      : kind === 'leftovers'
        ? { kind, dish_id: entry.dishId, catalogue_item_id: null }
        : kind === 'dish'
          ? { kind, dish_id: entry.dishId, catalogue_item_id: null }
          : { kind, dish_id: null, catalogue_item_id: entry.itemId }

  const previous = plan.entries
  plan.entries = plan.entries.map((row) =>
    row.id === entryId
      ? {
          ...row,
          kind,
          dishId: columns.dish_id,
          itemId: columns.catalogue_item_id,
        }
      : row,
  )

  const { error } = await supabase.from('meal_entries').update(columns).eq('id', entryId)

  if (error) {
    plan.entries = previous
    plan.error = strings.plan.saveFailed
    return false
  }

  plan.error = null
  return true
}

/** The free note on an entry — "at Mum's", "the good sauce". */
export async function setEntryNote(entryId: string, note: string): Promise<void> {
  if (!supabase) return

  const trimmed = note.trim().slice(0, 120)
  const value = trimmed === '' ? null : trimmed

  const previous = plan.entries
  plan.entries = plan.entries.map((row) =>
    row.id === entryId ? { ...row, note: value } : row,
  )

  const { error } = await supabase.from('meal_entries').update({ note: value }).eq('id', entryId)

  if (error) {
    plan.entries = previous
    plan.error = strings.plan.saveFailed
  }
}

/** Takes something off the plan. */
export async function unplanEntry(entryId: string): Promise<void> {
  if (!supabase) return

  const previous = plan.entries
  plan.entries = plan.entries.filter((entry) => entry.id !== entryId)

  const { error } = await supabase.from('meal_entries').delete().eq('id', entryId)

  if (error) {
    plan.entries = previous
    plan.error = strings.plan.saveFailed
  }
}

/* -------------------------------------------------------------------------- */
/* Plan → list                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * "Shop for this week": everything the plan wants, onto the list, in one call.
 *
 * Returns how many rows that actually added — the database's count, not a guess
 * — or null if the call failed and nothing changed. The list is re-read
 * afterwards rather than waited for, the same as tapping a dish: the realtime
 * inserts are on their way, but the phone that tapped is the one watching.
 */
export async function shopForRange(
  from: string,
  to: string,
  onlyItems?: readonly string[],
): Promise<number | null> {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('add_plan_to_list', {
    from_date: from,
    to_date: to,
    // Undefined means "everything the plan wants"; an array — even an empty one
    // — means exactly these. See 0011_planner_tweaks.sql.
    only_items: onlyItems === undefined ? null : [...onlyItems],
  })

  if (error) {
    plan.error = strings.plan.shopFailed
    return null
  }

  plan.error = null
  await reloadList()
  return typeof data === 'number' ? data : 0
}

/* -------------------------------------------------------------------------- */
/* Which meals a day has                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Saves the household's choice of meals. A household setting rather than a
 * device one — see 0010_meal_plan.sql for why.
 */
export async function setHouseholdMeals(meals: readonly Meal[]): Promise<boolean> {
  if (!supabase || !household.id) return false
  if (meals.length === 0) return false

  const previous = household.meals
  household.meals = [...meals]

  const { error } = await supabase
    .from('households')
    .update({ planner_meals: meals })
    .eq('id', household.id)

  if (error) {
    household.meals = previous
    plan.error = strings.plan.saveFailed
    return false
  }

  plan.error = null
  return true
}

/** Clears everything on sign-out so nothing carries into the next account. */
export function clearPlan(): void {
  plan.entries = []
  plan.history = []
  plan.historyFor = null
  plan.weekStart = startOfWeek(todayKey())
  plan.error = null
  plan.loading = false
}
