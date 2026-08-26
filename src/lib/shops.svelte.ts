/*
 * The shops this household walks around.
 *
 * "One main shop, others can be added. Each learns its own order" (NIU.md
 * §4.1). A shop is barely any data — a name and whether it's the main one — but
 * it is the key everything the app learns about aisle order hangs off, because
 * the order you walk Willys is not the order you walk ICA.
 *
 * Two decisions worth knowing about:
 *
 * 1. **The shops are shared; which one you're standing in is not.** The list of
 *    shops belongs to the household and syncs. The current shop is device-local
 *    (src/lib/prefs.svelte.ts), because two people can quite reasonably be in
 *    two different shops at once, and pushing that choice to the other phone
 *    would reorder someone else's list mid-aisle.
 *
 * 2. **Every household gets one, without asking.** `ensure_default_shop()` in
 *    the database creates "Main shop" the first time and hands back the existing
 *    one every time after — so nobody has to set a shop up before they can use
 *    the app, and two phones opening at once can't produce two main shops.
 *
 * Fail soft: if any of this fails, `shops` stays empty, the app falls back to
 * the hand-picked catalogue order, and nothing on screen breaks.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { household } from './household.svelte'
import { prefs, setShopId } from './prefs.svelte'
import { strings } from './strings'
import { supabase } from './supabase'

export interface Shop {
  id: string
  name: string
  isDefault: boolean
}

interface ShopRow {
  id: string
  name: string
  is_default: boolean
}

const SHOP_COLUMNS = 'id, name, is_default'

function toShop(row: ShopRow): Shop {
  return { id: row.id, name: row.name, isDefault: row.is_default }
}

class ShopsState {
  all = $state<Shop[]>([])
  error = $state<string | null>(null)

  /**
   * The shop this phone is currently sorting for: whatever was chosen here, as
   * long as it still exists, otherwise the household's main shop. Resolving it
   * here rather than in the screen means a shop deleted on the other phone can't
   * leave this one sorting against something that is gone.
   */
  current = $derived.by<Shop | null>(() => {
    const chosen = this.all.find((shop) => shop.id === prefs.shopId)
    if (chosen) return chosen
    return this.all.find((shop) => shop.isDefault) ?? this.all[0] ?? null
  })

  currentId = $derived(this.current?.id ?? null)
}

export const shops = new ShopsState()

/** Loads the household's shops, creating the first one if there isn't one. */
export async function loadShops(): Promise<void> {
  if (!supabase || !household.id) return

  // Creating on read looks odd, but it is the same trick as ensure_household():
  // there is no separate moment at which a household would "set up shops", and
  // an empty list would mean the learned order had nowhere to go.
  await supabase.rpc('ensure_default_shop')

  const { data, error } = await supabase
    .from('shops')
    .select(SHOP_COLUMNS)
    .eq('household_id', household.id)
    .order('is_default', { ascending: false })
    .order('name')

  if (error || !data) {
    shops.error = strings.shops.loadFailed
    return
  }

  shops.error = null
  shops.all = (data as ShopRow[]).map(toShop)
}

let channel: RealtimeChannel | null = null

/** Keeps the shop list in step when the other phone adds or removes one. */
export function watchShops(): () => void {
  if (!supabase || !household.id) return () => {}

  const client = supabase
  channel = client
    .channel(`shops:${household.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shops',
        filter: `household_id=eq.${household.id}`,
      },
      // Shops change about twice a year, so re-reading the handful of rows is
      // simpler and no slower than patching the list per event type.
      () => void loadShops(),
    )
    .subscribe()

  return () => {
    if (channel) {
      void client.removeChannel(channel)
      channel = null
    }
  }
}

/** Adds a shop and makes it the one this phone is sorting for. */
export async function addShop(rawName: string, userId: string): Promise<void> {
  if (!supabase || !household.id) return

  const name = rawName.trim()
  if (name === '') return

  const { data, error } = await supabase
    .from('shops')
    .insert({ household_id: household.id, name, created_by: userId })
    .select(SHOP_COLUMNS)
    .maybeSingle()

  if (error || !data) {
    shops.error = strings.shops.addFailed
    return
  }

  shops.error = null
  const shop = toShop(data as ShopRow)
  if (!shops.all.some((existing) => existing.id === shop.id)) {
    shops.all = [...shops.all, shop]
  }
  setShopId(shop.id)
}

/**
 * Moves the "main shop" flag.
 *
 * Two writes rather than one because only one shop per household may carry the
 * flag — a partial unique index enforces it — so the old one has to let go
 * before the new one can take it.
 */
export async function makeDefaultShop(shopId: string): Promise<void> {
  if (!supabase || !household.id) return

  const previous = shops.all
  shops.all = shops.all.map((shop) => ({ ...shop, isDefault: shop.id === shopId }))

  const clear = await supabase
    .from('shops')
    .update({ is_default: false })
    .eq('household_id', household.id)
    .eq('is_default', true)

  const set = clear.error
    ? clear
    : await supabase.from('shops').update({ is_default: true }).eq('id', shopId)

  if (set.error) {
    shops.all = previous
    shops.error = strings.shops.updateFailed
  }
}

/**
 * Removes a shop, and everything it had learned with it.
 *
 * The last shop can't be removed: the app would have nowhere to record the next
 * shop's order, and `ensure_default_shop()` would simply make another one on the
 * next load, which would look like the delete had silently failed.
 */
export async function removeShop(shopId: string): Promise<void> {
  if (!supabase || shops.all.length <= 1) return

  const previous = shops.all
  shops.all = shops.all.filter((shop) => shop.id !== shopId)

  const { error } = await supabase.from('shops').delete().eq('id', shopId)

  if (error) {
    shops.all = previous
    shops.error = strings.shops.updateFailed
    return
  }

  // If the deleted one was in force here, fall back to whatever is left.
  if (prefs.shopId === shopId) setShopId(null)

  // Deleting the main shop leaves the household without one; the next load
  // creates a replacement rather than leaving the flag on nothing.
  if (previous.find((shop) => shop.id === shopId)?.isDefault) {
    const next = shops.all[0]
    if (next) void makeDefaultShop(next.id)
  }
}

/** Switches which shop this phone sorts for. Device-local, never synced. */
export function chooseShop(shopId: string): void {
  setShopId(shopId)
}

/** Clears everything on sign-out so nothing carries into the next account. */
export function clearShops(): void {
  shops.all = []
  shops.error = null
}
