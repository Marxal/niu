/*
 * The other direction: "we have this — what can we make?"
 *
 * NIU.md §4.2 lists three ways the plan and the list connect. Plan → shop and
 * shop → plan were always in; the third, stock → plan, is filed in §5 under
 * stock inference with a warning that it needs months of data and must never
 * block anything earlier. **This module is deliberately not that.** It never
 * guesses what is in the house, and it never models how long anything lasts.
 *
 * It answers a much smaller question that needs no history at all:
 *
 *   how much of this dish have you either got on the list right now,
 *   or bought in the last few days?
 *
 * Both halves are already in the app. The list is in memory; `last_bought_at`
 * per item has been written by record_shop() since round 7. So this is set
 * arithmetic over data we already have, and it can say something useful on the
 * first day rather than after a winter of shopping.
 *
 * Why both halves are needed, and not just the list: on the day you shop, the
 * list is the answer. The morning after, the list is empty and the food is in
 * the fridge — which is precisely when someone opens the planner. Either half
 * alone has a hole exactly where the feature is supposed to be useful.
 *
 * Pure: no Svelte, no Supabase, no clock of its own — `now` is always passed in.
 */

import type { Dish } from './dishes'
import type { BuyingStat } from './suggest'

/**
 * How long after buying something it still counts as "you have this".
 *
 * Five days, and it is a flat number on purpose. A shelf-life model per item is
 * exactly the stock inference §5 defers, and a wrong one is worse than none: it
 * would quietly claim you have the fish you bought a fortnight ago. Five days
 * covers the days after a weekly shop, which is when this is asked, and it is
 * one number to change when there is real data to change it from.
 */
export const FRESH_DAYS = 5

/** Where an ingredient is, as far as this module can honestly tell. */
export type Held = 'list' | 'bought'

/**
 * What the household has to hand, as two sets of catalogue item ids.
 *
 * Two sets rather than one, because the app says *why* it thinks you have
 * something — "on your list" and "you bought this" are different claims and a
 * user can check either one.
 */
export interface Pantry {
  onList: ReadonlySet<string>
  boughtRecently: ReadonlySet<string>
}

export const EMPTY_PANTRY: Pantry = { onList: new Set(), boughtRecently: new Set() }

/**
 * Builds the two sets from what the app already holds.
 *
 * `onList` includes things in the trolley as well as things still to buy: both
 * mean the food is coming home tonight, and a dish whose ingredients you have
 * already ticked off is more makeable, not less.
 */
export function pantryFrom(
  listItemIds: readonly string[],
  stats: Readonly<Record<string, BuyingStat>>,
  now: Date = new Date(),
  freshDays: number = FRESH_DAYS,
): Pantry {
  const boughtRecently = new Set<string>()
  const cutoff = now.getTime() - freshDays * 86_400_000

  for (const [itemId, stat] of Object.entries(stats)) {
    if (!stat.lastBoughtAt) continue
    const bought = Date.parse(stat.lastBoughtAt)
    // A timestamp we can't read is not evidence of anything.
    if (Number.isNaN(bought)) continue
    if (bought >= cutoff) boughtRecently.add(itemId)
  }

  return { onList: new Set(listItemIds), boughtRecently }
}

/** Where one ingredient stands, or null if it is nowhere. */
export function heldAs(itemId: string, pantry: Pantry): Held | null {
  if (pantry.onList.has(itemId)) return 'list'
  if (pantry.boughtRecently.has(itemId)) return 'bought'
  return null
}

/** A dish, scored against what's to hand. */
export interface Makeable {
  dish: Dish
  /** How many of its ingredients are on the list or recently bought. */
  have: number
  /** How many it has in total. Never zero — see rankMakeable. */
  total: number
  /** Catalogue ids it still needs. */
  missing: string[]
  /** 0–1. `have / total`, precomputed because it is sorted on. */
  coverage: number
}

/**
 * Below this, a dish isn't worth offering as "you could make this".
 *
 * Half. A dish you have one ingredient of out of six is not a suggestion, it is
 * a shopping trip, and a strip full of those is one nobody reads twice. The
 * picker uses a lower bar than the strip does — see `rankMakeable`'s `floor`.
 */
export const MAKEABLE_FLOOR = 0.5

/**
 * Dishes you could plausibly make, best first.
 *
 * Dishes with no ingredients are left out entirely, and that is not a snub:
 * §4.2 is firm that a dish with an empty ingredient list is a real dish, but it
 * is one this question cannot be asked of. Nothing is known about it, so
 * claiming you can or cannot make it would be making something up. It stays
 * exactly where it belongs — in the picker's ordinary library list.
 *
 * The order: most complete first; then fewest things missing, so of two dishes
 * both 3/4 done the one needing a shorter trip wins; then how often this
 * household plans it; then the name, so the list never reshuffles between two
 * identical scores.
 */
export function rankMakeable(
  dishes: readonly Dish[],
  pantry: Pantry,
  floor: number = MAKEABLE_FLOOR,
): Makeable[] {
  const scored: Makeable[] = []

  for (const dish of dishes) {
    const total = dish.itemIds.length
    if (total === 0) continue

    const missing = dish.itemIds.filter((id) => heldAs(id, pantry) === null)
    const have = total - missing.length
    const coverage = have / total

    if (coverage < floor) continue
    scored.push({ dish, have, total, missing, coverage })
  }

  return scored.sort(
    (a, b) =>
      b.coverage - a.coverage ||
      a.missing.length - b.missing.length ||
      b.dish.timesPlanned - a.dish.timesPlanned ||
      a.dish.name.localeCompare(b.dish.name),
  )
}

/**
 * The same scoring for one dish, whatever its coverage — what the picker shows
 * beside every row rather than only beside the good ones.
 *
 * Null for a dish with no ingredients, which is the caller's cue to say nothing
 * rather than to say "0 of 0".
 */
export function scoreDish(dish: Dish, pantry: Pantry): Makeable | null {
  if (dish.itemIds.length === 0) return null
  const [ranked] = rankMakeable([dish], pantry, 0)
  return ranked ?? null
}
