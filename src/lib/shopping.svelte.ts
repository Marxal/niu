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
import type { PickerItem } from './list-view'
import { household } from './household.svelte'
import { recordShop } from './learning.svelte'
import { strings } from './strings'
import { supabase } from './supabase'

export interface CatalogueItem {
  id: string
  name: string
  category: string
  /**
   * What to draw. A bare slug from src/lib/icons.ts is the item's own line
   * drawing; a 'kind:value' string is a picture this household picked by hand
   * (see icon-ref.ts). Null means the outlined-letter tile.
   */
  icon: string | null
  /** The item's emoji, used by the Emoji and Inked icon styles. */
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
  note: string | null
  urgent: boolean
  /** Get it if you pass it. The opposite end of the same question as urgent. */
  ifConvenient: boolean
  checkedAt: string | null
  addedAt: string
  addedBy: string
}

/**
 * What the detail sheet can change, in the app's own names. Mapped to column
 * names in `updateItem` — the two diverged when `if_convenient` arrived, and a
 * spread straight into the query would have silently written nothing.
 */
export interface ItemChanges {
  quantity?: number | null
  note?: string | null
  urgent?: boolean
  ifConvenient?: boolean
}

class ShoppingState {
  catalogue = $state<CatalogueItem[]>([])
  items = $state<ListItem[]>([])
  /** Catalogue ids this household has removed from their picker for good. */
  hidden = $state<Set<string>>(new Set())
  /** Icons this household picked by hand, overriding the item's own. */
  iconOverrides = $state<Record<string, string>>({})
  /**
   * Categories this household moved things into, overriding the seed's.
   *
   * Same reason the icons need an override table: most of the catalogue is
   * shared, with `household_id is null`, and one house deciding halloumi belongs
   * under Cheese must not move it for everybody. See 0011_planner_tweaks.sql.
   */
  categoryOverrides = $state<Record<string, string>>({})
  /**
   * How many times each catalogue item has been put on the list, ever.
   * This is what makes the picker's first row get better with use — it is the
   * first piece of the learned ordering NIU.md §4.1 asks for.
   */
  useCounts = $state<Record<string, number>>({})
  /**
   * Which dish (or dishes) put each list row there, keyed by *list item* id.
   * Written only by add_dish_to_list(); see 0009_dish_tags.sql.
   */
  itemDishes = $state<Record<string, string[]>>({})
  loading = $state(false)
  error = $state<string | null>(null)

  /** Catalogue ids currently on the list — what the grid uses to grey a tile. */
  onList = $derived(new Set(this.items.map((item) => item.catalogueItemId)))

  /**
   * The whole catalogue with any hand-picked icon *and* category already
   * applied, so no component has to know overrides exist.
   *
   * Hiding is *not* applied here, and that is the point. A hidden item can
   * still be on the list — "it stays on the list if it is already there" — so
   * the list has to be able to look one up. Round 8 shipped with only the
   * filtered version of this, which is why an icon someone picked showed up in
   * the picker and then reverted to the letter as soon as the item reached the
   * list: the list was reading the raw catalogue, the only copy without the
   * overrides on it.
   */
  withIcons = $derived(
    this.catalogue.map((item) => {
      const icon = this.iconOverrides[item.id]
      const category = this.categoryOverrides[item.id]
      if (!icon && !category) return item
      return {
        ...item,
        ...(icon ? { icon } : {}),
        ...(category ? { category } : {}),
      }
    }),
  )

  /** The same thing keyed by id, for resolving a list row to its tile. */
  byId = $derived(new Map(this.withIcons.map((item) => [item.id, item])))

  /** What the picker offers: everything above, minus what was hidden for good. */
  visibleCatalogue = $derived(this.withIcons.filter((item) => !this.hidden.has(item.id)))

  /**
   * The same thing again in the shape the tile grids want, with this
   * household's use count folded in. Derived here rather than in a screen
   * because two of them now need it — the shopping picker and the ingredient
   * picker inside a dish — and a second copy of this mapping is a second place
   * to forget a field.
   */
  picker = $derived<PickerItem[]>(
    this.visibleCatalogue.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      icon: item.icon,
      emoji: item.emoji,
      sortOrder: item.sortOrder,
      suggestedRank: item.suggestedRank,
      useCount: this.useCounts[item.id] ?? 0,
    })),
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
  note: string | null
  urgent: boolean
  if_convenient: boolean
  checked_at: string | null
  added_at: string
  added_by: string
}

/*
 * The columns the list is read with, in one place because four separate queries
 * used to spell them out and adding a column meant remembering all four.
 *
 * `unit` is deliberately absent. It is still a column — dropping it would throw
 * away whatever anyone typed — but round 6 took the field out of the sheet, so
 * nothing reads or writes it any more.
 */
const LIST_COLUMNS =
  'id, catalogue_item_id, quantity, note, urgent, if_convenient, checked_at, added_at, added_by'

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
    note: row.note,
    urgent: row.urgent,
    // Rows written before the column existed come back without it.
    ifConvenient: row.if_convenient ?? false,
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
  const [
    catalogueResult,
    listResult,
    hiddenResult,
    usageResult,
    iconsResult,
    categoriesResult,
    dishResult,
  ] = await Promise.all([
    supabase
      .from('catalogue_items')
      .select('id, name, category, icon, emoji, sort_order, suggested_rank, household_id')
      .order('sort_order'),
    supabase.from('list_items').select(LIST_COLUMNS).eq('household_id', household.id),
    supabase.from('catalogue_hidden').select('catalogue_item_id'),
    supabase.from('catalogue_usage').select('catalogue_item_id, use_count'),
    supabase.from('catalogue_icons').select('catalogue_item_id, icon'),
    supabase.from('catalogue_categories').select('catalogue_item_id, category'),
    supabase
      .from('list_item_dishes')
      .select('list_item_id, dish_id')
      .eq('household_id', household.id),
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

  // And again: without these the list simply doesn't say which dish wanted what.
  if (!dishResult.error && dishResult.data) {
    shopping.itemDishes = collectItemDishes(dishResult.data as ItemDishRow[])
  }

  // Same again: without overrides every item just shows its own icon.
  if (!iconsResult.error && iconsResult.data) {
    const chosen: Record<string, string> = {}
    for (const row of iconsResult.data as { catalogue_item_id: string; icon: string }[]) {
      chosen[row.catalogue_item_id] = row.icon
    }
    shopping.iconOverrides = chosen
  }

  // And again: without these, everything sits in the category the seed gave it.
  if (!categoriesResult.error && categoriesResult.data) {
    const moved: Record<string, string> = {}
    for (const row of categoriesResult.data as {
      catalogue_item_id: string
      category: string
    }[]) {
      moved[row.catalogue_item_id] = row.category
    }
    shopping.categoryOverrides = moved
  }
}

interface ItemDishRow {
  list_item_id: string
  dish_id: string
}

function collectItemDishes(rows: ItemDishRow[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const row of rows) {
    const list = out[row.list_item_id]
    if (list) list.push(row.dish_id)
    else out[row.list_item_id] = [row.dish_id]
  }
  return out
}

/**
 * Re-reads just what is on the list, leaving the catalogue alone.
 *
 * For the changes that happen server-side and land as several rows at once —
 * tapping a dish, which inserts one row per ingredient. The realtime events for
 * those are on their way and would arrive on their own, but the phone that did
 * the tapping is the one waiting to see four tiles appear, and re-reading three
 * hundred catalogue rows to find out about four list rows is a poor trade on a
 * phone. Fails silently: the events are still coming.
 */
export async function reloadList(): Promise<void> {
  if (!supabase || !household.id) return

  // The dish tags come along, because the thing that most often makes this
  // function run is a dish being tapped — and rows arriving without the tag
  // that explains them would read as "nobody asked for this".
  const [listResult, dishResult] = await Promise.all([
    supabase.from('list_items').select(LIST_COLUMNS).eq('household_id', household.id),
    supabase
      .from('list_item_dishes')
      .select('list_item_id, dish_id')
      .eq('household_id', household.id),
  ])

  if (listResult.error || !listResult.data) return

  shopping.items = (listResult.data as ListRow[]).map(toListItem)

  if (!dishResult.error && dishResult.data) {
    shopping.itemDishes = collectItemDishes(dishResult.data as ItemDishRow[])
  }
}

/* -------------------------------------------------------------------------- */
/* Realtime                                                                    */
/* -------------------------------------------------------------------------- */

let channel: RealtimeChannel | null = null

/**
 * Subscribes to list changes for this household. Returns an unsubscribe fn.
 *
 * Two things guard against a phone quietly going stale, because a websocket is
 * not a promise that you saw everything:
 *
 *  - Android suspends the socket when the screen goes off or the app is in the
 *    background. Anything that happened meanwhile never arrives, so the list is
 *    re-read whenever the app comes back to the foreground.
 *  - A dropped connection resubscribes, and the events during the gap are gone
 *    for good, so a re-read follows every reconnection too.
 *
 * Both call the same `loadShopping()` the app boots with. Cheap, and it means a
 * missed event is self-healing rather than something you have to notice.
 */
export function watchShopping(): () => void {
  if (!supabase || !household.id) return () => {}

  const client = supabase
  let subscribedBefore = false

  const refresh = () => {
    if (document.visibilityState === 'visible') void loadShopping()
  }

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
    // A category someone moved on the other phone rearranges this one's grid, so
    // it re-reads the lot rather than patching — it is a handful of rows and it
    // happens about twice a year.
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'catalogue_categories',
        filter: `household_id=eq.${household.id}`,
      },
      () => void loadShopping(),
    )
    .subscribe((status) => {
      // The first SUBSCRIBED is the one the initial load already covered.
      if (status !== 'SUBSCRIBED') return
      if (subscribedBefore) refresh()
      subscribedBefore = true
    })

  document.addEventListener('visibilitychange', refresh)

  return () => {
    document.removeEventListener('visibilitychange', refresh)
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
    .select(LIST_COLUMNS)
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

/** Saves the optional details — how many, the note, and the two priority tags. */
export async function updateItem(itemId: string, changes: ItemChanges): Promise<void> {
  if (!supabase) return

  // Only the keys actually passed are sent, so setting urgency can't blank a
  // note that someone else typed a second earlier on the other phone.
  const row: Record<string, unknown> = {}
  if ('quantity' in changes) row.quantity = changes.quantity
  if ('note' in changes) row.note = changes.note
  if ('urgent' in changes) row.urgent = changes.urgent
  if ('ifConvenient' in changes) row.if_convenient = changes.ifConvenient
  if (Object.keys(row).length === 0) return

  const previous = shopping.items
  shopping.items = shopping.items.map((item) =>
    item.id === itemId ? { ...item, ...changes } : item,
  )

  const { error } = await supabase.from('list_items').update(row).eq('id', itemId)

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

/**
 * Ends a shop: everything in the trolley is bought, so learn from it and empty
 * it. Returns how many items that was, or 0 if nothing happened.
 *
 * The deleting is not done here. `record_shop()` in the database works out where
 * in this shop each thing was picked up, updates the household's per-item stats
 * and deletes the ticked rows, all in one transaction — because the tick order
 * exists only until those rows are gone, and a delete that succeeded while the
 * learning failed would lose it for good.
 *
 * The rows are removed from local state first anyway, so the trolley empties
 * under the thumb rather than after a round trip, and put back if the call
 * fails.
 */
export async function clearChecked(shopId: string | null): Promise<number> {
  if (!supabase || !household.id) return 0

  const checked = shopping.items.filter((item) => item.checkedAt !== null)
  if (checked.length === 0) return 0

  const previous = shopping.items
  shopping.items = shopping.items.filter((item) => item.checkedAt === null)

  const recorded = await recordShop(shopId)

  if (recorded === null) {
    shopping.items = previous
    shopping.error = strings.shopping.updateFailed
    return 0
  }

  return recorded
}

/**
 * Puts a word into the catalogue, or hands back the one that is already there.
 *
 * Two callers now want this and they want different things afterwards: typing
 * into the shopping search adds the word *and* puts it on the list, while
 * typing into a dish's ingredient picker adds the word and puts it in the dish.
 * Making the word is the shared half, so it lives here on its own and returns
 * the item rather than assuming what happens next.
 *
 * Matching an existing name case-insensitively is not politeness, it is what
 * the unique index in 0002 does — `lower(trim(name))` — so a word that would
 * collide is found here rather than rejected by the database.
 */
export async function createCatalogueWord(
  rawName: string,
  userId: string,
): Promise<CatalogueItem | null> {
  if (!supabase || !household.id) return null

  const name = rawName.trim()
  if (name === '') return null

  shopping.error = null

  const existing = shopping.catalogue.find(
    (item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  )
  if (existing) return existing

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
    return null
  }

  const item = toCatalogueItem(data as CatalogueRow)
  shopping.catalogue = [...shopping.catalogue, item]
  return item
}

/**
 * Adds a word the catalogue doesn't know, then puts it straight on the list.
 * "Typing something the catalogue doesn't know adds it immediately" (§4.1) —
 * so this is one action from the user's point of view, not two.
 */
export async function addNewWord(rawName: string, userId: string): Promise<void> {
  const item = await createCatalogueWord(rawName, userId)
  if (item) await addToList(item.id, userId)
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

/**
 * Moves one item into a different category, for this household only.
 *
 * Exactly the same shape as setItemIcon above and for the same reason: the
 * catalogue is mostly shared, so a household's opinion about where something
 * belongs is stored beside the row rather than written into it.
 *
 * The name is trimmed but otherwise taken as typed. Categories in this app are
 * names, not rows with ids — so "Cupboard" and "cupboard" would be two, which is
 * the picker's job to avoid by offering the existing ones first.
 */
export async function setItemCategory(
  catalogueItemId: string,
  category: string,
  userId: string,
): Promise<void> {
  if (!supabase || !household.id) return

  const name = category.trim()
  if (name === '') return

  const previous = shopping.categoryOverrides
  shopping.categoryOverrides = { ...previous, [catalogueItemId]: name }

  const { error } = await supabase.from('catalogue_categories').upsert(
    {
      household_id: household.id,
      catalogue_item_id: catalogueItemId,
      category: name,
      set_by: userId,
    },
    { onConflict: 'household_id,catalogue_item_id' },
  )

  if (error) {
    shopping.categoryOverrides = previous
    shopping.error = strings.shopping.updateFailed
  }
}

/** Drops the override, so the item goes back where the catalogue had it. */
export async function clearItemCategory(catalogueItemId: string): Promise<void> {
  if (!supabase || !household.id) return

  const previous = shopping.categoryOverrides
  const next = { ...previous }
  delete next[catalogueItemId]
  shopping.categoryOverrides = next

  const { error } = await supabase
    .from('catalogue_categories')
    .delete()
    .eq('household_id', household.id)
    .eq('catalogue_item_id', catalogueItemId)

  if (error) {
    shopping.categoryOverrides = previous
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
  shopping.itemDishes = {}
  shopping.hidden = new Set()
  shopping.useCounts = {}
  shopping.categoryOverrides = {}
  shopping.iconOverrides = {}
  shopping.error = null
  shopping.loading = false
}
