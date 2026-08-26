/*
 * What the app has worked out about this household, loaded for the app to read.
 *
 * Two sets of numbers, kept apart because they answer different questions
 * (NIU.md §5):
 *
 *   stats  how often and how recently each thing gets bought, and roughly how
 *          long it lasts. Feeds the "you usually need…" strip.
 *   aisle  whereabouts in *this* shop each thing gets picked up. Feeds the
 *          order the still-to-buy list is sorted in.
 *
 * Nothing here calculates anything. The database does the learning, in one
 * transaction at the end of each shop (`record_shop()` in
 * 0007_shops_and_learning.sql), and the arithmetic that turns these numbers into
 * an order or a suggestion lives in shop-order.ts and suggest.ts, which are pure
 * and tested. This module is only the wire between them.
 *
 * `aisle` is per shop, so it is reloaded when the shop changes. `stats` are per
 * household and are not.
 *
 * Fail soft: if either query fails the record stays empty, the list falls back
 * to the hand-picked catalogue order and the suggestion strip doesn't appear.
 * Neither is an error worth putting on screen — nothing is lost, the app just
 * knows less than it could.
 */

import type { AislePosition } from './shop-order'
import type { BuyingStat } from './suggest'
import { household } from './household.svelte'
import { supabase } from './supabase'

interface StatRow {
  catalogue_item_id: string
  times_bought: number
  last_bought_at: string | null
  avg_gap_days: number | string | null
}

interface AisleRow {
  catalogue_item_id: string
  avg_position: number | string
  samples: number
}

/**
 * Postgres `numeric` arrives as a string over the wire — it is arbitrary
 * precision, and JSON numbers are not — so every one of them is converted here
 * rather than left to surprise some arithmetic later.
 */
function toNumber(value: number | string | null): number | null {
  if (value === null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

class LearningState {
  /** Keyed by catalogue item id. */
  stats = $state<Record<string, BuyingStat>>({})
  /** Keyed by catalogue item id, for the shop currently in force. */
  aisle = $state<Record<string, AislePosition>>({})
}

export const learning = new LearningState()

/** Loads both sets of numbers. Pass the shop the list is being sorted for. */
export async function loadLearning(shopId: string | null): Promise<void> {
  if (!supabase || !household.id) return

  const [statsResult, aisleResult] = await Promise.all([
    supabase
      .from('item_stats')
      .select('catalogue_item_id, times_bought, last_bought_at, avg_gap_days')
      .eq('household_id', household.id),
    shopId
      ? supabase
          .from('item_shop_order')
          .select('catalogue_item_id, avg_position, samples')
          .eq('shop_id', shopId)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (!statsResult.error && statsResult.data) {
    const stats: Record<string, BuyingStat> = {}
    for (const row of statsResult.data as StatRow[]) {
      stats[row.catalogue_item_id] = {
        timesBought: row.times_bought,
        lastBoughtAt: row.last_bought_at,
        avgGapDays: toNumber(row.avg_gap_days),
      }
    }
    learning.stats = stats
  }

  if (!aisleResult.error && aisleResult.data) {
    const aisle: Record<string, AislePosition> = {}
    for (const row of aisleResult.data as AisleRow[]) {
      const position = toNumber(row.avg_position)
      if (position === null) continue
      aisle[row.catalogue_item_id] = { avgPosition: position, samples: row.samples }
    }
    learning.aisle = aisle
  }
}

/**
 * Ends a shop: learn from what is in the trolley, then empty it.
 *
 * One call, because the two halves must not be able to disagree — a trolley
 * emptied without the learning would throw away the only record of the order it
 * was filled in, and there is no second chance at it. Returns how many items
 * were recorded, or null if the call failed and the trolley is untouched.
 */
export async function recordShop(shopId: string | null): Promise<number | null> {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('record_shop', { shop: shopId })
  if (error) return null

  return typeof data === 'number' ? data : 0
}

/** Clears everything on sign-out so nothing carries into the next account. */
export function clearLearning(): void {
  learning.stats = {}
  learning.aisle = {}
}
