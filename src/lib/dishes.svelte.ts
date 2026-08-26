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
  isDishSlot,
  isSaveable,
} from './dishes'
import { household } from './household.svelte'
import { reloadList } from './shopping.svelte'
import { strings } from './strings'
import { supabase } from './supabase'

interface DishRow {
  id: string
  name: string
  icon: string | null
  slot: string
  cook: string
  times_added: number
  last_added_at: string | null
}

interface DishItemRow {
  dish_id: string
  catalogue_item_id: string
}

const DISH_COLUMNS = 'id, name, icon, slot, cook, times_added, last_added_at'

/**
 * A row plus its ingredients. The two enum columns are checked rather than
 * trusted: they are constrained in the database, but a value written by a newer
 * version of the app than this one would otherwise flow straight into a type
 * that says it can't exist.
 */
function toDish(row: DishRow, itemIds: string[]): Dish {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    slot: isDishSlot(row.slot) ? row.slot : 'other',
    cook: isDishCook(row.cook) ? row.cook : 'none',
    itemIds,
    timesAdded: row.times_added,
    lastAddedAt: row.last_added_at,
  }
}

class DishesState {
  all = $state<Dish[]>([])
  loading = $state(false)
  error = $state<string | null>(null)

  /** Fast lookup for the shopping screen, which resolves a tap to a dish. */
  byId = $derived(new Map(this.all.map((dish) => [dish.id, dish])))
}

export const dishes = new DishesState()

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

/** Reads the library and what each dish is made of. */
export async function loadDishes(): Promise<void> {
  if (!supabase || !household.id) return

  dishes.loading = true

  const [dishResult, itemResult] = await Promise.all([
    supabase.from('dishes').select(DISH_COLUMNS).eq('household_id', household.id),
    supabase.from('dish_items').select('dish_id, catalogue_item_id').eq('household_id', household.id),
  ])

  dishes.loading = false

  if (dishResult.error || !dishResult.data) {
    dishes.error = strings.dishes.loadFailed
    return
  }

  // A failed ingredient read is not a failed load: the names are still worth
  // showing, and every dish simply looks like one with nothing in it yet.
  const ingredients = new Map<string, string[]>()
  if (!itemResult.error && itemResult.data) {
    for (const row of itemResult.data as DishItemRow[]) {
      const list = ingredients.get(row.dish_id)
      if (list) list.push(row.catalogue_item_id)
      else ingredients.set(row.dish_id, [row.catalogue_item_id])
    }
  }

  dishes.error = null
  dishes.all = (dishResult.data as DishRow[]).map((row) =>
    toDish(row, ingredients.get(row.id) ?? []),
  )
}

let channel: RealtimeChannel | null = null

/**
 * Keeps the library in step with the other phone.
 *
 * Both tables re-read the lot on any change, the same as shops.svelte.ts does:
 * dishes change a handful of times a month, the whole library is a few dozen
 * rows, and patching an ingredient list per event is three code paths where one
 * will do.
 */
export function watchDishes(): () => void {
  if (!supabase || !household.id) return () => {}

  const client = supabase
  const filter = `household_id=eq.${household.id}`

  channel = client
    .channel(`dishes:${household.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes', filter }, () => {
      void loadDishes()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_items', filter }, () => {
      void loadDishes()
    })
    .subscribe()

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
    slot: draft.slot,
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

  const { toAdd, toRemove } = diffIngredients(existing?.itemIds ?? [], draft.itemIds)

  if (toAdd.length > 0) {
    const { error } = await supabase.from('dish_items').insert(
      toAdd.map((catalogueItemId) => ({
        dish_id: dishId,
        catalogue_item_id: catalogueItemId,
        household_id: household.id,
      })),
    )
    if (error) {
      dishes.error = strings.dishes.saveFailed
      await loadDishes()
      return false
    }
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('dish_items')
      .delete()
      .eq('dish_id', dishId)
      .in('catalogue_item_id', toRemove)
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
  dishes.error = null
  dishes.loading = false
}
