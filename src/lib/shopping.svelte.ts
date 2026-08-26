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
  /** Slug from src/lib/icons.ts, or null for the outlined-letter tile. */
  icon: string | null
  /** The item's emoji, shown only under the Colour icon style. */
  emoji: string | null
  sortOrder: number
  /** Rank in the hand-picked "typical stuff" order. Null for most items. */
  suggestedRank: number | null
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
  /** Catalogue ids this household has removed from their picker for good. */
  hidden = $state<Set<string>>(new Set())
  /** Icons this household picked by hand, overriding the item's own. */
  iconOverrides = $state<Record<string, string>>({})
  /**
   * How many times each catalogue item has been put on the list, ever.
   * This is what makes the picker's first row get better with use — it is the
   * first piece of the learned ordering NIU.md §4.1 asks for.
   */
  useCounts = $state<Record<string, number>>({})
  loading = $state(false)
  error = $state<string | null>(null)

  /** Catalogue ids currently on the list — what the grid uses to grey a tile. */
  onList = $derived(new Set(this.items.map((item) => item.catalogueItemId)))

  /**
   * The catalogue as the UI should draw it: hidden tiles dropped, and any
   * hand-picked icon already applied, so no component has to know overrides
   * exist.
   */
  visibleCatalogue = $derived(
    this.catalogue
      .filter((item) => !this.hidden.has(item.id))
      .map((item) => {
        const chosen = this.iconOverrides[item.id]
        return chosen ? { ...item, icon: chosen } : item
      }),
  )
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
  emoji: string | null
  sort_order: number
  suggested_rank: number | null
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
    emoji: row.emoji,
    sortOrder: row.sort_order,
    suggestedRank: row.suggested_rank,
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
  const [catalogueResult, listResult, hiddenResult, usageResult, iconsResult] =
    await Promise.all([
    supabase
      .from('catalogue_items')
      .select('id, name, category, icon, emoji, sort_order, suggested_rank, household_id')
      .order('sort_order'),
    supabase
      .from('list_items')
      .select('id, catalogue_item_id, quantity, unit, note, urgent, checked_at, added_at, added_by')
      .eq('household_id', household.id),
    supabase.from('catalogue_hidden').select('catalogue_item_id'),
    supabase.from('catalogue_usage').select('catalogue_item_id, use_count'),
    supabase.from('catalogue_icons').select('catalogue_item_id, icon'),
  ])

  shopping.loading = false

  if (catalogueResult.error || listResult.error) {
    shopping.error = strings.shopping.loadFailed
    return
  }

  shopping.catalogue = (catalogueResult.data as CatalogueRow[]).map(toCatalogueItem)
  shopping.items = (listResult.data as ListRow[]).map(toListItem)

  // Hidden tiles fail soft on their own: if that one query fails the picker
  // just shows everything, which is a worse experience but not a broken one.
  if (!hiddenResult.error && hiddenResult.data) {
    shopping.hidden = new Set(
      (hiddenResult.data as { catalogue_item_id: string }[]).map((r) => r.catalogue_item_id),
    )
  }

  // Same: without counts the picker falls back to the hand-picked order, which
  // is exactly what a brand-new household sees anyway.
  if (!usageResult.error && usageResult.data) {
    const counts: Record<string, number> = {}
    for (const row of usageResult.data as { catalogue_item_id: string; use_count: number }[]) {
      counts[row.catalogue_item_id] = row.use_count
    }
    shopping.useCounts = counts
  }

  // Same again: without overrides every item just shows its own icon.
  if (!iconsResult.error && iconsResult.data) {
    const chosen: Record<string, string> = {}
    for (const row of iconsResult.data as { catalogue_item_id: string; icon: string }[]) {
      chosen[row.catalogue_item_id] = row.icon
    }
    shopping.iconOverrides = chosen
  }
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

  // Bump the local count straight away so the picker reorders without waiting,
  // then tell the server. A failed count is not worth surfacing — the item is
  // on the list, which is what the tap was for.
  shopping.useCounts = {
    ...shopping.useCounts,
    [catalogueItemId]: (shopping.useCounts[catalogueItemId] ?? 0) + 1,
  }
  void supabase.rpc('record_catalogue_use', { item_id: catalogueItemId })
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
      icon: null, // null means the UI draws the outlined-initial tile
      created_by: userId,
      sort_order: 99_000, // after every seeded category
    })
    .select('id, name, category, icon, emoji, sort_order, suggested_rank, household_id')
    .maybeSingle()

  if (error || !data) {
    shopping.error = strings.shopping.addFailed
    return
  }

  const item = toCatalogueItem(data as CatalogueRow)
  shopping.catalogue = [...shopping.catalogue, item]
  await addToList(item.id, userId)
}

/**
 * Takes a tile out of this household's picker for good.
 *
 * A hide, not a delete. Most of the catalogue is the shared seed that belongs to
 * no household, and one household must not be able to remove 'anchovies' for
 * everyone — the policies rightly forbid it. A hidden row says "gone, for us",
 * works the same for a seeded tile and an invented word, and destroys nothing.
 */
export async function hideCatalogueItem(catalogueItemId: string, userId: string): Promise<void> {
  if (!supabase || !household.id) return

  const previous = shopping.hidden
  shopping.hidden = new Set([...previous, catalogueItemId])

  const { error } = await supabase.from('catalogue_hidden').insert({
    household_id: household.id,
    catalogue_item_id: catalogueItemId,
    hidden_by: userId,
  })

  if (error) {
    shopping.hidden = previous
    shopping.error = strings.shopping.updateFailed
  }
}

/**
 * Records the icon this household wants for an item.
 *
 * An override row rather than an edit to the item, for the same reason hiding
 * is: most of the catalogue is the shared seed, and one household changing
 * 'anchovies' must not change it for everyone.
 */
export async function setItemIcon(
  catalogueItemId: string,
  icon: string,
  userId: string,
): Promise<void> {
  if (!supabase || !household.id) return

  const previous = shopping.iconOverrides
  shopping.iconOverrides = { ...previous, [catalogueItemId]: icon }

  const { error } = await supabase.from('catalogue_icons').upsert(
    {
      household_id: household.id,
      catalogue_item_id: catalogueItemId,
      icon,
      set_by: userId,
    },
    { onConflict: 'household_id,catalogue_item_id' },
  )

  if (error) {
    shopping.iconOverrides = previous
    shopping.error = strings.shopping.updateFailed
  }
}

/** Drops the override, so the item goes back to its own icon. */
export async function clearItemIcon(catalogueItemId: string): Promise<void> {
  if (!supabase || !household.id) return

  const previous = shopping.iconOverrides
  const next = { ...previous }
  delete next[catalogueItemId]
  shopping.iconOverrides = next

  const { error } = await supabase
    .from('catalogue_icons')
    .delete()
    .eq('household_id', household.id)
    .eq('catalogue_item_id', catalogueItemId)

  if (error) {
    shopping.iconOverrides = previous
    shopping.error = strings.shopping.updateFailed
  }
}

/** Clears everything on sign-out so nothing carries into the next account. */
export function clearShopping(): void {
  shopping.catalogue = []
  shopping.items = []
  shopping.hidden = new Set()
  shopping.useCounts = {}
  shopping.iconOverrides = {}
  shopping.error = null
  shopping.loading = false
}
