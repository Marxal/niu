/*
 * What a dish is, and the arithmetic around a library of them. Pure functions —
 * no Svelte, no Supabase — so the ordering and the ingredient diffing can be
 * tested rather than eyeballed on a phone.
 *
 * The one idea worth holding on to (NIU.md §4.2): a dish with no ingredients is
 * not a broken dish. It is a name you can plan a meal with, and that is a
 * perfectly ordinary thing to want. Everything here has to stay true with an
 * empty ingredient list — nothing may assume a dish knows what it is made of.
 */

import { matchesSearch, type PickerItem } from './list-view'
import { strings } from './strings'

/** Which part of a meal this is. §4.2's "slot type". */
export type DishSlot = 'protein' | 'carbs' | 'vegetables' | 'other'

/**
 * How much cooking it takes. §4.2 lists four flags — needs cooking, fast cook,
 * slow cook, no cook — but they are one question with three answers: "needs
 * cooking" is exactly "fast or slow". Collapsed on purpose; see 0008_dishes.sql.
 */
export type DishCook = 'none' | 'fast' | 'slow'

export const DISH_SLOTS: readonly DishSlot[] = ['protein', 'carbs', 'vegetables', 'other']
export const DISH_COOKS: readonly DishCook[] = ['none', 'fast', 'slow']

export interface Dish {
  id: string
  name: string
  /** Same format as a catalogue item's icon — see icon-ref.ts. */
  icon: string | null
  slot: DishSlot
  cook: DishCook
  /** Catalogue item ids, in no meaningful order. */
  itemIds: string[]
  /** How many times its tile has been tapped onto the shopping list. */
  timesAdded: number
  lastAddedAt: string | null
}

/** The editable half of a dish, as the sheet holds it before saving. */
export interface DishDraft {
  name: string
  icon: string | null
  slot: DishSlot
  cook: DishCook
  itemIds: string[]
}

export function isDishSlot(value: unknown): value is DishSlot {
  return DISH_SLOTS.includes(value as DishSlot)
}

export function isDishCook(value: unknown): value is DishCook {
  return DISH_COOKS.includes(value as DishCook)
}

/**
 * The library order: what this household cooks most, first.
 *
 * "pick from the library sorted by most-used" (§4.2). Ties break on name rather
 * than on when the dish was invented, so a shelf of never-yet-tapped dishes
 * reads as an alphabetical list instead of an arbitrary one — which is what you
 * want when you are looking for a particular dish rather than a suggestion.
 */
export function sortDishes(dishes: readonly Dish[]): Dish[] {
  return [...dishes].sort(
    (a, b) => b.timesAdded - a.timesAdded || a.name.localeCompare(b.name),
  )
}

/** Dishes whose name matches the search box, in library order. */
export function filterDishes(dishes: readonly Dish[], query: string): Dish[] {
  const trimmed = query.trim()
  if (trimmed === '') return sortDishes(dishes)
  return sortDishes(dishes).filter((dish) => matchesSearch(dish.name, trimmed))
}

/**
 * Dishes as the shopping picker draws them, so the Dishes category is rendered
 * by exactly the same components as every other category (§4.1: "Dishes appear
 * in the catalogue as their own category").
 *
 * `sortOrder` is the position in the library order rather than anything from the
 * catalogue: these tiles never mix with grocery tiles, so the number only has to
 * be consistent within this list. `suggestedRank` is null because the hand-picked
 * "typical stuff" order is about groceries — nobody can guess what this house
 * cooks.
 */
export function dishPicks(dishes: readonly Dish[], category: string): PickerItem[] {
  return sortDishes(dishes).map((dish, index) => ({
    id: dish.id,
    name: dish.name,
    category,
    icon: dish.icon,
    emoji: null,
    sortOrder: index,
    suggestedRank: null,
    useCount: dish.timesAdded,
  }))
}

/** The ingredients of a dish that aren't on the shopping list yet. */
export function missingIngredients(dish: Dish, onList: ReadonlySet<string>): string[] {
  return dish.itemIds.filter((id) => !onList.has(id))
}

/**
 * What has to change to turn one ingredient list into another.
 *
 * The dish editor works on a local copy and saves in one go, so the save has to
 * work out the two sets of rows to write. Doing it as a diff rather than
 * "delete them all, insert the new lot" matters: a wipe-and-rewrite of an
 * unchanged list is a burst of realtime traffic the other phone has to redraw
 * for, and it briefly leaves the dish with no ingredients at all — which the
 * other phone would happily render.
 */
export function diffIngredients(
  before: readonly string[],
  after: readonly string[],
): { toAdd: string[]; toRemove: string[] } {
  const had = new Set(before)
  const wants = new Set(after)

  return {
    toAdd: [...wants].filter((id) => !had.has(id)),
    toRemove: [...had].filter((id) => !wants.has(id)),
  }
}

export const SLOT_LABELS: Record<DishSlot, string> = {
  protein: strings.dishes.slotProtein,
  carbs: strings.dishes.slotCarbs,
  vegetables: strings.dishes.slotVegetables,
  other: strings.dishes.slotOther,
}

export const COOK_LABELS: Record<DishCook, string> = {
  none: strings.dishes.cookNone,
  fast: strings.dishes.cookFast,
  slow: strings.dishes.cookSlow,
}

/**
 * The line under a dish's name in the library: what part of a meal it is, how
 * much cooking it takes, and how many things it needs.
 *
 * The two defaults are left out rather than printed. 'Other' and 'No cook' are
 * what a dish has when nobody has said anything about it, and a line that reads
 * "Other · No cook · 4 things" for every dish in the library is three words of
 * noise around the one fact that varies. Say what was actually decided.
 */
export function describeDish(dish: Dish): string {
  const parts: string[] = []
  if (dish.slot !== 'other') parts.push(SLOT_LABELS[dish.slot])
  if (dish.cook !== 'none') parts.push(COOK_LABELS[dish.cook])
  parts.push(
    dish.itemIds.length === 0
      ? strings.dishes.noItems
      : strings.dishes.itemCount(dish.itemIds.length),
  )
  return parts.join(' · ')
}

/** True when the draft is worth saving. A dish with no name is not a dish. */
export function isSaveable(draft: DishDraft): boolean {
  return draft.name.trim() !== ''
}
