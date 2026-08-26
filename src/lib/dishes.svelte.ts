/*
 * The dish library, and the one action that makes it useful from the shopping
 * side: tapping a dish puts everything it needs on the list.
 *
 * Two tables behind one object. `dishes` is the library; `dish_items` says what
 * each one is made of. They are read together and stitched into a single `Dish`
 * with an `itemIds` array, because nothing in the app ever wants one without the
 * other — a dish tile that can't say how many things it will add is not much of
 * a tile.
 *
 * Different from shopping.svelte.ts in one deliberate way: nothing here is
 * optimistic. The shopping list is optimistic because tapping a tile has to feel
 * instant forty times in a row mid-shop. Editing a dish happens roughly once a
 * month, from a sheet you are already looking at, and it writes to two tables at
 * once — so it writes, then re-reads, and what you see is what the database
 * actually holds. The one action that *is* in a hurry, adding a dish to the
 * list, gets its speed from being a single round trip rather than from guessing.
 *
 * Fail soft throughout: a failed call sets `error`, leaves the last good library
 * on screen, and reports failure to the caller so the sheet can stay open with
 * the typing still in it.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  type Dish,
  type DishDraft,
  diffIngredients,
  isDishCook,
  isSaveable,
} from './dishes'
import {
  type DishTag,
  type TagColour,
  diffTags,
  isTagColour,
  nextPosition,
  sortTags,
} from './dish-tags'
import { household } from './household.svelte'
import { reloadList } from './shopping.svelte'
import { strings } from './strings'
import { supabase } from './supabase'

interface DishRow {
  id: string
  name: string
  icon: string | null
  cook: string
  times_added: number
  last_added_at: string | null
}

interface DishItemRow {
  dish_id: string
  catalogue_item_id: string
}

interface TagRow {
  id: string
  name: string
  colour: string
  position: number
}

interface TagLinkRow {
  dish_id: string
  tag_id: string
}

/*
 * `slot` is deliberately absent. The column still exists and still holds what
 * round 8 wrote there, but 0009 carried it into tags and nothing reads it any
 * more — same treatment as list_items.unit in round 6.
 */
const DISH_COLUMNS = 'id, name, icon, cook, times_added, last_added_at'

/**
 * A row plus what hangs off it. The enum columns are checked rather than
 * trusted: they are constrained in the database, but a value written by a newer
 * version of the app than this one would otherwise flow straight into a type
 * that says it can't exist.
 */
function toDish(row: DishRow, itemIds: string[], tagIds: string[]): Dish {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    cook: isDishCook(row.cook) ? row.cook : 'none',
    tagIds,
    itemIds,
    timesAdded: row.times_added,
    lastAddedAt: row.last_added_at,
  }
}

function toTag(row: TagRow): DishTag {
  return {
    id: row.id,
    name: row.name,
    colour: isTagColour(row.colour) ? row.colour : 'stone',
    position: row.position,
  }
}

class DishesState {
  all = $state<Dish[]>([])
  /** The household's "part of a meal" labels, in their own order. */
  tags = $state<DishTag[]>([])
  loading = $state(false)
  error = $state<string | null>(null)

  /** Fast lookup for the shopping screen, which resolves a tap to a dish. */
  byId = $derived(new Map(this.all.map((dish) => [dish.id, dish])))
  tagById = $derived(new Map(this.tags.map((tag) => [tag.id, tag])))
}

export const dishes = new DishesState()

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

/** Collects a join table into a map of parent id → child ids. */
function group<T>(rows: T[], parent: (row: T) => string, child: (row: T) => string) {
  const out = new Map<string, string[]>()
  for (const row of rows) {
    const key = parent(row)
    const list = out.get(key)
    if (list) list.push(child(row))
    else out.set(key, [child(row)])
  }
  return out
}

/** Reads the library, what each dish is made of, and the household's tags. */
export async function loadDishes(): Promise<void> {
  if (!supabase || !household.id) return

  dishes.loading = true

  // Creating on read, the same trick as ensure_default_shop(): there is no
  // separate moment at which a household would "set up meal parts", and an
  // empty chip row would look like something failed rather than like a choice.
  await supabase.rpc('ensure_dish_tags')

  const [dishResult, itemResult, tagResult, linkResult] = await Promise.all([
    supabase.from('dishes').select(DISH_COLUMNS).eq('household_id', household.id),
    supabase
      .from('dish_items')
      .select('dish_id, catalogue_item_id')
      .eq('household_id', household.id),
    supabase
      .from('dish_tags')
      .select('id, name, colour, position')
      .eq('household_id', household.id),
    supabase.from('dish_tag_links').select('dish_id, tag_id').eq('household_id', household.id),
  ])

  dishes.loading = false

  if (dishResult.error || !dishResult.data) {
    dishes.error = strings.dishes.loadFailed
    return
  }

  // A failed ingredient or tag read is not a failed load: the names are still
  // worth showing, and a dish simply looks like one with nothing in it yet.
  const ingredients = itemResult.error
    ? new Map<string, string[]>()
    : group(
        (itemResult.data ?? []) as DishItemRow[],
        (r) => r.dish_id,
        (r) => r.catalogue_item_id,
      )

  const tagLinks = linkResult.error
    ? new Map<string, string[]>()
    : group(
        (linkResult.data ?? []) as TagLinkRow[],
        (r) => r.dish_id,
        (r) => r.tag_id,
      )

  if (!tagResult.error && tagResult.data) {
    dishes.tags = sortTags((tagResult.data as TagRow[]).map(toTag))
  }

  dishes.error = null
  dishes.all = (dishResult.data as DishRow[]).map((row) =>
    toDish(row, ingredients.get(row.id) ?? [], tagLinks.get(row.id) ?? []),
  )
}

let channel: RealtimeChannel | null = null

/**
 * Keeps the library in step with the other phone.
 *
 * All four tables re-read the lot on any change, the same as shops.svelte.ts
 * does: dishes change a handful of times a month, the whole library is a few
 * dozen rows, and patching an ingredient list per event is four code paths
 * where one will do.
 */
const WATCHED = ['dishes', 'dish_items', 'dish_tags', 'dish_tag_links'] as const

export function watchDishes(): () => void {
  if (!supabase || !household.id) return () => {}

  const client = supabase
  const filter = `household_id=eq.${household.id}`

  let subscription = client.channel(`dishes:${household.id}`)
  for (const table of WATCHED) {
    subscription = subscription.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter },
      () => void loadDishes(),
    )
  }

  channel = subscription.subscribe()

  return () => {
    if (channel) {
      void client.removeChannel(channel)
      channel = null
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Changing the library                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Writes a dish — new or edited — and its ingredient list. True if it stuck.
 *
 * The ingredients are written as a diff rather than replaced wholesale: see
 * diffIngredients() in dishes.ts for why. An unchanged list therefore costs no
 * writes at all, which is the common case when someone opens a dish to rename it.
 */
export async function saveDish(
  draft: DishDraft,
  userId: string,
  existing: Dish | null,
): Promise<boolean> {
  if (!supabase || !household.id) return false
  if (!isSaveable(draft)) return false

  const fields = {
    name: draft.name.trim(),
    icon: draft.icon,
    cook: draft.cook,
  }

  let written: string | null = existing?.id ?? null

  if (written === null) {
    const { data, error } = await supabase
      .from('dishes')
      .insert({ household_id: household.id, created_by: userId, ...fields })
      .select('id')
      .maybeSingle()

    if (error || !data) {
      // The unique index on the name is the likely reason, and it is the only
      // one worth a specific message: everything else is "try again".
      dishes.error =
        error?.code === '23505' ? strings.dishes.duplicateName : strings.dishes.saveFailed
      return false
    }
    written = (data as { id: string }).id
  } else {
    const { error } = await supabase.from('dishes').update(fields).eq('id', written)
    if (error) {
      dishes.error =
        error.code === '23505' ? strings.dishes.duplicateName : strings.dishes.saveFailed
      return false
    }
  }

  // Fixed before the ingredient writes below, which are closures: a `let` stays
  // its declared type inside one, and this is a string by the time we get here.
  const dishId = written

  // Fixed before the closures below: `supabase` and `household.id` are both
  // nullable module state, and TypeScript rightly stops trusting a narrowing
  // that a callback could outlive.
  const client = supabase
  const hid = household.id

  const items = diffIngredients(existing?.itemIds ?? [], draft.itemIds)
  const tags = diffTags(existing?.tagIds ?? [], draft.tagIds)

  /*
   * Four possible writes, all of them skipped when nothing in that set moved —
   * which is the common case, since most edits are a rename. Any one failing
   * gives up and re-reads rather than carrying on: the dish is then half-saved
   * on screen exactly as it is half-saved in the database, which is the honest
   * thing to show.
   */
  const writes: (() => PromiseLike<{ error: unknown }>)[] = []

  if (items.toAdd.length > 0) {
    writes.push(() =>
      client.from('dish_items').insert(
        items.toAdd.map((catalogueItemId) => ({
          dish_id: dishId,
          catalogue_item_id: catalogueItemId,
          household_id: hid,
        })),
      ),
    )
  }

  if (items.toRemove.length > 0) {
    writes.push(() =>
      client
        .from('dish_items')
        .delete()
        .eq('dish_id', dishId)
        .in('catalogue_item_id', items.toRemove),
    )
  }

  if (tags.toAdd.length > 0) {
    writes.push(() =>
      client.from('dish_tag_links').insert(
        tags.toAdd.map((tagId) => ({
          dish_id: dishId,
          tag_id: tagId,
          household_id: hid,
        })),
      ),
    )
  }

  if (tags.toRemove.length > 0) {
    writes.push(() =>
      client.from('dish_tag_links').delete().eq('dish_id', dishId).in('tag_id', tags.toRemove),
    )
  }

  for (const write of writes) {
    const { error } = await write()
    if (error) {
      dishes.error = strings.dishes.saveFailed
      await loadDishes()
      return false
    }
  }

  dishes.error = null
  await loadDishes()
  return true
}

/* -------------------------------------------------------------------------- */
/* The tags themselves                                                         */
/* -------------------------------------------------------------------------- */

/** Writes a new "part of a meal". Returns its id so the editor can select it. */
export async function createTag(
  rawName: string,
  colour: TagColour,
  userId: string,
): Promise<string | null> {
  if (!supabase || !household.id) return null

  const name = rawName.trim()
  if (name === '') return null

  const { data, error } = await supabase
    .from('dish_tags')
    .insert({
      household_id: household.id,
      name,
      colour,
      position: nextPosition(dishes.tags),
      created_by: userId,
    })
    .select('id, name, colour, position')
    .maybeSingle()

  if (error || !data) {
    dishes.error =
      error?.code === '23505' ? strings.dishes.tagDuplicate : strings.dishes.saveFailed
    return null
  }

  dishes.error = null
  dishes.tags = sortTags([...dishes.tags, toTag(data as TagRow)])
  return (data as TagRow).id
}

/** Renames or recolours one. */
export async function updateTag(
  tagId: string,
  changes: { name?: string; colour?: TagColour },
): Promise<boolean> {
  if (!supabase) return false

  const row: Record<string, unknown> = {}
  if (changes.name !== undefined) {
    const name = changes.name.trim()
    if (name === '') return false
    row.name = name
  }
  if (changes.colour !== undefined) row.colour = changes.colour
  if (Object.keys(row).length === 0) return true

  const { error } = await supabase.from('dish_tags').update(row).eq('id', tagId)

  if (error) {
    dishes.error =
      error.code === '23505' ? strings.dishes.tagDuplicate : strings.dishes.saveFailed
    return false
  }

  dishes.error = null
  await loadDishes()
  return true
}

/**
 * Throws a tag away. Every dish carrying it loses it, by cascade — which is
 * why the editor asks first: a tag is a label on many dishes, not one.
 */
export async function removeTag(tagId: string): Promise<void> {
  if (!supabase) return

  const previous = dishes.tags
  dishes.tags = dishes.tags.filter((tag) => tag.id !== tagId)

  const { error } = await supabase.from('dish_tags').delete().eq('id', tagId)

  if (error) {
    dishes.tags = previous
    dishes.error = strings.dishes.saveFailed
    return
  }

  await loadDishes()
}

/**
 * Puts one catalogue item into a dish, from outside the dish editor.
 *
 * This is the other direction of the same idea: long-pressing a tile on the
 * shopping tab and saying "that belongs in Lasagne" is often how you find out a
 * dish is missing an ingredient — standing in the shop, not sitting in an
 * editor. Adding one that is already there is a no-op rather than an error,
 * because from the outside it is the same wish either way.
 */
export async function addItemToDish(
  dishId: string,
  catalogueItemId: string,
): Promise<boolean> {
  if (!supabase || !household.id) return false

  const dish = dishes.byId.get(dishId)
  if (dish?.itemIds.includes(catalogueItemId)) return true

  const { error } = await supabase.from('dish_items').insert({
    dish_id: dishId,
    catalogue_item_id: catalogueItemId,
    household_id: household.id,
  })

  if (error) {
    dishes.error = strings.dishes.saveFailed
    return false
  }

  dishes.error = null
  await loadDishes()
  return true
}

/** Throws a dish away. Its ingredient rows go with it, by cascade. */
export async function removeDish(dishId: string): Promise<void> {
  if (!supabase) return

  const previous = dishes.all
  dishes.all = dishes.all.filter((dish) => dish.id !== dishId)

  const { error } = await supabase.from('dishes').delete().eq('id', dishId)

  if (error) {
    dishes.all = previous
    dishes.error = strings.dishes.saveFailed
  }
}

/**
 * Puts everything a dish needs on the shopping list, in one call.
 *
 * Returns how many rows that actually added — the database's count, not a guess,
 * so "three added, one you already had" is the truth. Null means the call
 * failed and nothing changed.
 *
 * The list is re-read afterwards rather than waited for: the realtime insert
 * events are on their way and would arrive on their own, but they arrive when
 * they arrive, and the phone that did the tapping is the one watching for four
 * tiles to appear.
 */
export async function addDishToList(dishId: string): Promise<number | null> {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('add_dish_to_list', { dish: dishId })

  if (error) {
    dishes.error = strings.dishes.addFailed
    return null
  }

  dishes.error = null
  await reloadList()
  return typeof data === 'number' ? data : 0
}

/** Clears everything on sign-out so nothing carries into the next account. */
export function clearDishes(): void {
  dishes.all = []
  dishes.tags = []
  dishes.error = null
  dishes.loading = false
}
