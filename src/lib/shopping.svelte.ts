/*
 * The shopping list and the catalogue it is tapped from.
 *
 * Shape of the thing: `catalogue` is the ~360 tiles you tap, loaded once per
 * sign-in and rarely changing. `items` is what is on the list right now, kept
 * live over Supabase realtime so both phones agree without anyone refreshing.
 *
 * Two behaviours worth knowing about:
 *
 * 1. Adding is optimistic. Tapping a tile has to feel instant, so the row is
 *    pushed into local state before the server confirms and rolled back if the
 *    insert fails. The unique index on (household_id, catalogue_item_id) is
 *    what makes this safe: a double tap, or both phones tapping at once, can
 *    only ever produce one row, so the rollback path is a genuine failure
 *    rather than a race.
 *
 * 2. Realtime is the source of truth, not the local writes. Every change comes
 *    back through the subscription and overwrites what's here. That means a
 *    change made on the other phone and a change made on this one take exactly
 *    the same path, so there is only one code path to get right.
 *
 * Fail soft throughout: a failed call sets `error` and leaves the last good
 * list on screen. Nothing here throws at the user.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { household } from './household.svelte'
import { strings } from './strings'
import { supabase } from './supabase'

export interface CatalogueItem {
  id: string
  name: string
  category: string
  icon: string | null
  sortOrder: number
  /** Null for the shared seed, set for a word this household invented. */
  householdId: string | null
}

export interface ListItem {
  id: string
  catalogueItemId: string
  quantity: number | null
  unit: string | null
  note: string | null
  urgent: boolean
  checkedAt: string | null
  addedAt: string
  addedBy: string
}

class ShoppingState {
  catalogue = $state<CatalogueItem[]>([])
  items = $state<ListItem[]>([])
  loading = $state(false)
  error = $state<string | null>(null)

  /** Catalogue ids currently on the list — what the grid uses to grey a tile. */
  onList = $derived(new Set(this.items.map((item) => item.catalogueItemId)))
}

export const shopping = new ShoppingState()

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

interface CatalogueRow {
  id: string
  name: string
  category: string
  icon: string | null
  sort_order: number
  household_id: string | null
}

interface ListRow {
  id: string
  catalogue_item_id: string
  quantity: number | null
  unit: string | null
  note: string | null
  urgent: boolean
  checked_at: string | null
  added_at: string
  added_by: string
}

function toCatalogueItem(row: CatalogueRow): CatalogueItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    icon: row.icon,
    sortOrder: row.sort_order,
    householdId: row.household_id,
  }
}

function toListItem(row: ListRow): ListItem {
  return {
    id: row.id,
    catalogueItemId: row.catalogue_item_id,
    quantity: row.quantity,
    unit: row.unit,
    note: row.note,
    urgent: row.urgent,
    checkedAt: row.checked_at,
    addedAt: row.added_at,
    addedBy: row.added_by,
  }
}

/** Loads the catalogue and the current list. Call after the household is known. */
export async function loadShopping(): Promise<void> {
  if (!supabase || !household.id) return

  shopping.loading = true
  shopping.error = null

  // RLS already limits the catalogue to the shared seed plus this household's
  // own words, so there is no filter to write here — the database does it.
  const [catalogueResult, listResult] = await Promise.all([
    supabase
      .from('catalogue_items')
      .select('id, name, category, icon, sort_order, household_id')
      .order('sort_order'),
    supabase
      .from('list_items')
      .select('id, catalogue_item_id, quantity, unit, note, urgent, checked_at, added_at, added_by')
      .eq('household_id', household.id),
  ])

  shopping.loading = false

  if (catalogueResult.error || listResult.error) {
    shopping.error = strings.shopping.loadFailed
    return
  }

  shopping.catalogue = (catalogueResult.data as CatalogueRow[]).map(toCatalogueItem)
  shopping.items = (listResult.data as ListRow[]).map(toListItem)
}

/* -------------------------------------------------------------------------- */
/* Realtime                                                                    */
/* -------------------------------------------------------------------------- */

let channel: RealtimeChannel | null = null

/** Subscribes to list changes for this household. Returns an unsubscribe fn. */
export function watchShopping(): () => void {
  if (!supabase || !household.id) return () => {}

  const client = supabase
  channel = client
    .channel(`list_items:${household.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'list_items',
        filter: `household_id=eq.${household.id}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = toListItem(payload.new as ListRow)
          // The optimistic add may already have put this here.
          if (!shopping.items.some((item) => item.id === row.id)) {
            shopping.items = [...shopping.items, row]
          }
        } else if (payload.eventType === 'UPDATE') {
          const row = toListItem(payload.new as ListRow)
          shopping.items = shopping.items.map((item) => (item.id === row.id ? row : item))
        } else if (payload.eventType === 'DELETE') {
          const gone = (payload.old as { id?: string }).id
          shopping.items = shopping.items.filter((item) => item.id !== gone)
        }
      },
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
/* Changing the list                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Puts a catalogue item on the list. Tapping something already on the list is a
 * no-op, per NIU.md §4.1 — enforced by the database, not just here.
 */
export async function addToList(catalogueItemId: string, userId: string): Promise<void> {
  if (!supabase || !household.id) return
  if (shopping.onList.has(catalogueItemId)) return

  shopping.error = null

  const { data, error } = await supabase
    .from('list_items')
    .insert({
      household_id: household.id,
      catalogue_item_id: catalogueItemId,
      added_by: userId,
    })
    .select('id, catalogue_item_id, quantity, unit, note, urgent, checked_at, added_at, added_by')
    .maybeSingle()

  if (error || !data) {
    shopping.error = strings.shopping.addFailed
    return
  }

  const row = toListItem(data as ListRow)
  if (!shopping.items.some((item) => item.id === row.id)) {
    shopping.items = [...shopping.items, row]
  }
}

/** Ticks an item off, or puts it back. Records who, for the future shop-order learning. */
export async function toggleChecked(itemId: string, userId: string): Promise<void> {
  if (!supabase) return

  const current = shopping.items.find((item) => item.id === itemId)
  if (!current) return

  const nowChecked = current.checkedAt === null
  const checkedAt = nowChecked ? new Date().toISOString() : null

  // Optimistic: the tile has to grey out under the thumb immediately.
  const previous = shopping.items
  shopping.items = shopping.items.map((item) =>
    item.id === itemId ? { ...item, checkedAt } : item,
  )

  const { error } = await supabase
    .from('list_items')
    .update({ checked_at: checkedAt, checked_by: nowChecked ? userId : null })
    .eq('id', itemId)

  if (error) {
    shopping.items = previous
    shopping.error = strings.shopping.updateFailed
  }
}

/** Saves the optional details — quantity, unit, note, urgency. */
export async function updateItem(
  itemId: string,
  changes: { quantity?: number | null; unit?: string | null; note?: string | null; urgent?: boolean },
): Promise<void> {
  if (!supabase) return

  const previous = shopping.items
  shopping.items = shopping.items.map((item) =>
    item.id === itemId ? { ...item, ...changes } : item,
  )

  const { error } = await supabase.from('list_items').update(changes).eq('id', itemId)

  if (error) {
    shopping.items = previous
    shopping.error = strings.shopping.updateFailed
  }
}

/** Takes a single item off the list entirely. */
export async function removeFromList(itemId: string): Promise<void> {
  if (!supabase) return

  const previous = shopping.items
  shopping.items = shopping.items.filter((item) => item.id !== itemId)

  const { error } = await supabase.from('list_items').delete().eq('id', itemId)

  if (error) {
    shopping.items = previous
    shopping.error = strings.shopping.updateFailed
  }
}

/** Empties the trolley — removes everything already ticked off. */
export async function clearChecked(): Promise<void> {
  if (!supabase || !household.id) return

  const checkedIds = shopping.items.filter((i) => i.checkedAt !== null).map((i) => i.id)
  if (checkedIds.length === 0) return

  const previous = shopping.items
  shopping.items = shopping.items.filter((item) => item.checkedAt === null)

  const { error } = await supabase.from('list_items').delete().in('id', checkedIds)

  if (error) {
    shopping.items = previous
    shopping.error = strings.shopping.updateFailed
  }
}

/**
 * Adds a word the catalogue doesn't know, then puts it straight on the list.
 * "Typing something the catalogue doesn't know adds it immediately" (§4.1) —
 * so this is one action from the user's point of view, not two.
 */
export async function addNewWord(rawName: string, userId: string): Promise<void> {
  if (!supabase || !household.id) return

  const name = rawName.trim()
  if (name === '') return

  shopping.error = null

  // If the catalogue already knows it, just add it — no duplicate word.
  const existing = shopping.catalogue.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  )
  if (existing) {
    await addToList(existing.id, userId)
    return
  }

  const { data, error } = await supabase
    .from('catalogue_items')
    .insert({
      household_id: household.id,
      name,
      category: strings.shopping.ourWordsCategory,
      icon: null, // null means the UI draws a first-letter tile
      created_by: userId,
      sort_order: 99_000, // after every seeded category
    })
    .select('id, name, category, icon, sort_order, household_id')
    .maybeSingle()

  if (error || !data) {
    shopping.error = strings.shopping.addFailed
    return
  }

  const item = toCatalogueItem(data as CatalogueRow)
  shopping.catalogue = [...shopping.catalogue, item]
  await addToList(item.id, userId)
}

/** Clears everything on sign-out so nothing carries into the next account. */
export function clearShopping(): void {
  shopping.catalogue = []
  shopping.items = []
  shopping.error = null
  shopping.loading = false
}
