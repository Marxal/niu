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
  emoji: string | null
  sortOrder: number
  quantity: number | null
  note: string | null
  urgent: boolean
  ifConvenient: boolean
  checkedAt: string | null
  addedAt: string
  addedBy: string
}

/**
 * The orderings that need no history to work.
 *
 * The learned shop order is not one of them: it needs numbers from the database
 * and lives in shop-order.ts. What the *user* can choose between is a wider set
 * again — see `SortMode` in prefs.svelte.ts, which is the stored preference.
 */
export type BasicSort = 'catalogue' | 'recent'

/** A catalogue tile as the picker needs it. */
export interface PickerItem {
  id: string
  name: string
  category: string
  icon: string | null
  emoji: string | null
  sortOrder: number
  /** Rank in the hand-picked "typical stuff" order. Null for most items. */
  suggestedRank: number | null
  /** How many times this household has actually put it on the list. */
  useCount: number
}

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
 *
 * The trolley is ordered most-recently-ticked first. That way the thing you
 * just put in the trolley is the first one you see, which is what you want if
 * you tapped the wrong tile and need to put it back — the correction is always
 * at the top, never buried at the end of a long list.
 */
export function splitByChecked(items: readonly DisplayItem[]): {
  toBuy: DisplayItem[]
  inTrolley: DisplayItem[]
} {
  const inTrolley = items
    .filter((item) => item.checkedAt !== null)
    .sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? ''))

  return {
    toBuy: items.filter((item) => item.checkedAt === null),
    inTrolley,
  }
}

/** Orders the still-to-buy items by one of the rules that needs no history. */
export function sortItems(items: readonly DisplayItem[], mode: BasicSort): DisplayItem[] {
  const sorted = [...items]

  switch (mode) {
    case 'recent':
      // Newest first — what you just added is what you're still thinking about.
      sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      break
    case 'catalogue':
      // The hand-picked walk-the-shop order the app starts from, and what "by
      // category" means in practice: the categories are in shop order already.
      sorted.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      break
  }

  return sorted
}

/**
 * Most-bought first — "most frequent" in NIU.md §4.1.
 *
 * Takes the counts as a plain record rather than importing anything, so this
 * file stays free of any knowledge of where the numbers come from. Anything
 * never bought sorts last, in catalogue order, rather than being jumbled
 * together at zero.
 */
export function sortByTimesBought(
  items: readonly DisplayItem[],
  counts: Readonly<Record<string, { timesBought: number }>>,
): DisplayItem[] {
  const times = (item: DisplayItem) => counts[item.catalogueItemId]?.timesBought ?? 0

  return [...items].sort(
    (a, b) => times(b) - times(a) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  )
}

/**
 * The two priority tags, applied to whatever order is in play: urgent floats to
 * the top, "if convenient" sinks to the bottom, everything else keeps the order
 * it arrived in. A flag that didn't change position wouldn't be doing anything.
 *
 * The two are mutually exclusive — the sheet only lets you pick one and the
 * database refuses both — so this is a single rank, not two passes. Array.sort
 * is stable, so items sharing a rank keep the sort that ran before this one.
 */
function rank(item: DisplayItem): number {
  if (item.urgent) return 0
  if (item.ifConvenient) return 2
  return 1
}

export function byPriority(items: readonly DisplayItem[]): DisplayItem[] {
  return [...items].sort((a, b) => rank(a) - rank(b))
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

/**
 * The tiles shown before any category is opened — Bring!'s "Recently Used" row,
 * and the first thing seen on the Shopping tab.
 *
 * Ordering is "what this household actually buys, falling back to what everyone
 * buys". Items the household has used are ranked by use, most-used first; below
 * them come the hand-picked suggestions for a brand-new account that has no
 * history at all. That means the row is useful on day one and gets more useful
 * with every shop, without needing a switch to flip between the two.
 *
 * Anything already on the list is left out: it is showing up above, in the list
 * itself, and a tile you cannot tap is wasted space in the row that should be
 * the fastest to scan.
 */
export function suggestedPicks(
  catalogue: readonly PickerItem[],
  onList: ReadonlySet<string>,
  limit = 12,
): PickerItem[] {
  const available = catalogue.filter((item) => !onList.has(item.id))

  const used = available
    .filter((item) => item.useCount > 0)
    .sort((a, b) => b.useCount - a.useCount || a.sortOrder - b.sortOrder)

  const seeded = available
    .filter((item) => item.useCount === 0 && item.suggestedRank !== null)
    .sort((a, b) => (a.suggestedRank ?? 0) - (b.suggestedRank ?? 0))

  return [...used, ...seeded].slice(0, limit)
}

/** Catalogue items in one category, in grid order, minus anything on the list. */
export function categoryPicks(
  catalogue: readonly PickerItem[],
  category: string,
): PickerItem[] {
  return catalogue
    .filter((item) => item.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Category names in the order their items appear, so the grid order holds. */
export function categoriesInOrder(catalogue: readonly PickerItem[]): string[] {
  const firstSeen = new Map<string, number>()
  for (const item of catalogue) {
    const seen = firstSeen.get(item.category)
    if (seen === undefined || item.sortOrder < seen) {
      firstSeen.set(item.category, item.sortOrder)
    }
  }
  return [...firstSeen.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name)
}
