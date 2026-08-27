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
  note: string | null
  created_at: string
}

const ENTRY_COLUMNS =
  'id, on_date, meal, position, kind, dish_id, catalogue_item_id, note, created_at'

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
    note: row.note,
    createdAt: row.created_at,
  }
}

class PlanState {
  entries = $state<PlanEntry[]>([])
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
      () => void loadPlan(),
    )
    .subscribe()

  return () => {
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
): Promise<boolean> {
  if (!supabase || !household.id) return false

  const columns = targetColumns(target)
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
      created_by: userId,
      ...columns,
    })
    .select(ENTRY_COLUMNS)
    .maybeSingle()

  if (error || !data) {
    plan.entries = previous
    plan.error = strings.plan.saveFailed
    return false
  }

  const saved = toEntry(data as EntryRow)
  plan.error = null
  plan.entries = plan.entries.map((entry) => (entry.id === temporaryId ? saved : entry))
  return true
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
export async function shopForRange(from: string, to: string): Promise<number | null> {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('add_plan_to_list', {
    from_date: from,
    to_date: to,
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
  plan.weekStart = startOfWeek(todayKey())
  plan.error = null
  plan.loading = false
}
