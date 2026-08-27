/*
 * "Shop for this week": what a stretch of the plan wants, and what of that is
 * still missing from the shopping list.
 *
 * The database does the writing — add_plan_to_list() in 0010_meal_plan.sql, one
 * round trip, `on conflict do nothing`. This module exists for the half the
 * database can't do: telling you what is *about* to happen before you tap.
 *
 * That preview matters more here than it did for a dish tile. Tapping Lasagne
 * adds four things and you can see all four. Tapping "shop for this week" can
 * add twenty, from seven days you may not have looked at since Sunday — and
 * "the user always taps" (§4.1, §4.2) is a weaker promise if the user can't see
 * what they are agreeing to.
 *
 * Pure: no Svelte, no Supabase.
 */

import type { Dish } from './dishes'
import { entriesBetween, type PlanEntry } from './plan'

/** One thing the plan wants, and who wants it. */
export interface Need {
  itemId: string
  /**
   * The dishes that asked for it, by name, in alphabetical order. Empty when
   * the only reason it is wanted is that somebody planned the item directly.
   */
  dishNames: string[]
  /** True when it is already on the list, in the trolley or not. */
  onList: boolean
}

export interface PlanNeeds {
  /** Everything the range wants, whether or not it is already on the list. */
  all: Need[]
  /** The subset not on the list yet — what tapping the button would add. */
  missing: Need[]
  /**
   * Entries the range holds that could never contribute: eating out, leftovers,
   * and dishes with no ingredient list. Counted so the empty state can say
   * *why* there is nothing to buy rather than looking broken.
   */
  silent: number
}

/**
 * What the plan between two days needs.
 *
 * Mirrors add_plan_to_list() exactly, and the two have to stay in step: 'dish'
 * entries contribute their ingredients, 'item' entries contribute themselves,
 * and 'leftovers' and 'out' contribute nothing. If one of them ever learns a
 * fifth kind, the other has to learn it the same day.
 */
export function planNeeds(
  entries: readonly PlanEntry[],
  from: string,
  to: string,
  dishesById: ReadonlyMap<string, Dish>,
  onList: ReadonlySet<string>,
): PlanNeeds {
  // Keyed by catalogue id so two dishes wanting tomatoes produce one need with
  // two names on it, which is the same shape round 9 gave the list's own badges.
  const wanted = new Map<string, Set<string>>()
  let silent = 0

  for (const entry of entriesBetween(entries, from, to)) {
    if (entry.kind === 'item' && entry.itemId) {
      if (!wanted.has(entry.itemId)) wanted.set(entry.itemId, new Set())
      continue
    }

    if (entry.kind !== 'dish' || !entry.dishId) {
      silent += 1
      continue
    }

    const dish = dishesById.get(entry.dishId)
    // A dish that has been deleted on the other phone, or one that is just a
    // name: both are entries this button can do nothing with.
    if (!dish || dish.itemIds.length === 0) {
      silent += 1
      continue
    }

    for (const itemId of dish.itemIds) {
      const names = wanted.get(itemId)
      if (names) names.add(dish.name)
      else wanted.set(itemId, new Set([dish.name]))
    }
  }

  const all: Need[] = [...wanted].map(([itemId, names]) => ({
    itemId,
    dishNames: [...names].sort((a, b) => a.localeCompare(b)),
    onList: onList.has(itemId),
  }))

  return { all, missing: all.filter((need) => !need.onList), silent }
}
