/*
 * How the shopping list and the catalogue get arranged on screen. Pure
 * functions — no Svelte, no Supabase — so the ordering rules can be tested
 * rather than eyeballed on a phone.
 *
 * This is where the "default sort while shopping" from NIU.md §4.1 will
 * eventually plug in. Right now `SortMode` has the hand-picked shop order and
 * the two alternatives that don't need any history to work. The learned order,
 * which needs tick-off data that doesn't exist yet, becomes another mode here
 * once there is something to learn from — which is why this takes the sort mode
 * as an argument rather than hard-coding one.
 */

export interface DisplayItem {
  id: string
  catalogueItemId: string
  name: string
  category: string
  icon: string | null
  sortOrder: number
  quantity: number | null
  unit: string | null
  note: string | null
  urgent: boolean
  checkedAt: string | null
  addedAt: string
  addedBy: string
}

export type SortMode = 'shop-order' | 'recent' | 'category'

/** A group of items under a heading, as rendered. */
export interface Group {
  key: string
  items: DisplayItem[]
}

/**
 * The tile shown when an item has no emoji: its first letter.
 * "a generated first-letter tile as its icon" (§4.1).
 *
 * Uses Intl-aware uppercasing and takes the first *character* rather than the
 * first byte, so an accented or non-Latin first letter survives.
 */
export function initialFor(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') return '?'
  return [...trimmed][0]!.toLocaleUpperCase()
}

/**
 * Splits the list into what's still to buy and what's in the trolley.
 * "the tile greys out and drops into an 'in the trolley' section below" (§4.1).
 */
export function splitByChecked(items: readonly DisplayItem[]): {
  toBuy: DisplayItem[]
  inTrolley: DisplayItem[]
} {
  return {
    toBuy: items.filter((item) => item.checkedAt === null),
    inTrolley: items.filter((item) => item.checkedAt !== null),
  }
}

/** Orders the still-to-buy items according to the chosen mode. */
export function sortItems(items: readonly DisplayItem[], mode: SortMode): DisplayItem[] {
  const sorted = [...items]

  switch (mode) {
    case 'recent':
      // Newest first — what you just added is what you're still thinking about.
      sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      break
    case 'category':
    case 'shop-order':
      // Both currently follow the catalogue's own order, which *is* the
      // hand-picked walk-the-shop order. They diverge once the learned order
      // exists: 'shop-order' will use it, 'category' will stay as-is.
      sorted.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      break
  }

  return sorted
}

/**
 * Urgent items float to the top of whatever order is in play — an urgency flag
 * that didn't change position wouldn't be doing anything.
 */
export function floatUrgent(items: readonly DisplayItem[]): DisplayItem[] {
  return [...items].sort((a, b) => Number(b.urgent) - Number(a.urgent))
}

/** Groups items under their category heading, keeping the given order. */
export function groupByCategory(items: readonly DisplayItem[]): Group[] {
  const groups: Group[] = []
  const index = new Map<string, Group>()

  for (const item of items) {
    let group = index.get(item.category)
    if (!group) {
      group = { key: item.category, items: [] }
      index.set(item.category, group)
      groups.push(group)
    }
    group.items.push(item)
  }

  return groups
}

/**
 * Case- and accent-insensitive substring match, for the catalogue search box.
 * Normalising means typing "cafe" still finds "café".
 */
export function matchesSearch(name: string, query: string): boolean {
  const normalise = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .trim()

  const q = normalise(query)
  if (q === '') return true
  return normalise(name).includes(q)
}
