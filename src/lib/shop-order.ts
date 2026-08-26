/*
 * The order you walk the shop, learned from the order you tick things off.
 *
 * NIU.md §4.1 asks for the list to sort itself into the order the shop is
 * actually walked, per shop, learned from tick-off order. The database does the
 * learning (see 0007_shops_and_learning.sql): every finished shop averages each
 * item's position into a number between 0 and 1 — a fraction of the way through
 * the shop rather than a place in a queue, so shops of different sizes can be
 * averaged together at all.
 *
 * This module does the other half: turning those numbers, which cover only what
 * has been bought before, into an order for a list that also contains things
 * nobody has ever bought.
 *
 * Three rules, applied per item, and the whole design is in the fallbacks:
 *
 *  1. **What we know about this item.** Its own learned position, trusted more
 *     the more shops it is based on — fully after three. One shop is an anecdote:
 *     you might have doubled back for the milk.
 *
 *  2. **What we know about its neighbours.** A first-time item inherits the
 *     average position of the things in its category that *have* been learned, at
 *     half weight. If the tinned food turns out to be at the back of this shop,
 *     a tin nobody has bought before is probably at the back too. This is the
 *     rule that makes a new item land somewhere sensible instead of wherever the
 *     seed order guessed.
 *
 *  3. **The hand-picked order**, which is what everything falls back to and what
 *     a brand-new household sees. Produce first, freezer and household last.
 *
 * Every position is blended with the seed order rather than replacing it, so the
 * list never lurches: it drifts from the guess towards what actually happens.
 *
 * Pure functions, no Svelte and no Supabase, because this is arithmetic with
 * several fallbacks and eyeballing it on a phone would not tell you whether it
 * was right.
 */

/** What the database has learned about one item in one shop. */
export interface AislePosition {
  /** 0 = the first thing picked up, 1 = the last. */
  avgPosition: number
  /** How many finished shops that average is based on. */
  samples: number
}

/** The minimum an item needs to order a list. */
export interface Placeable {
  catalogueItemId: string
  category: string
  /** Position in the hand-picked catalogue order. */
  sortOrder: number
}

/** Shops after which an item's own learned position is trusted completely. */
export const TRUSTED_AFTER = 3

/** How far to trust a category's average for an item never bought here. */
export const CATEGORY_TRUST = 0.5

/**
 * Where the seed order thinks each item goes, as a 0–1 position.
 *
 * Spread across the list rather than derived from `sortOrder` directly: those
 * numbers are catalogue row positions running into the tens of thousands for
 * invented words, and dividing by the largest of them would squash the whole
 * shop into the first inch.
 */
function seedPositions<T extends Placeable>(items: readonly T[]): Map<string, number> {
  const ordered = [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.catalogueItemId.localeCompare(b.catalogueItemId),
  )

  const positions = new Map<string, number>()
  ordered.forEach((item, index) => {
    // (index + 1) / (n + 1) keeps every value strictly inside 0–1, so a seed
    // position can never claim to be more certainly first than a learned one.
    positions.set(item.catalogueItemId, (index + 1) / (ordered.length + 1))
  })
  return positions
}

/**
 * The average learned position of each category, weighted by how many shops
 * each item's average is based on. Only categories with something learned in
 * them appear.
 */
function categoryPositions<T extends Placeable>(
  items: readonly T[],
  learned: Readonly<Record<string, AislePosition>>,
): Map<string, number> {
  const totals = new Map<string, { weighted: number; weight: number }>()

  for (const item of items) {
    const fact = learned[item.catalogueItemId]
    if (!fact || fact.samples <= 0) continue

    const running = totals.get(item.category) ?? { weighted: 0, weight: 0 }
    running.weighted += fact.avgPosition * fact.samples
    running.weight += fact.samples
    totals.set(item.category, running)
  }

  const means = new Map<string, number>()
  for (const [category, { weighted, weight }] of totals) {
    if (weight > 0) means.set(category, weighted / weight)
  }
  return means
}

/**
 * Where each item should sit in this shop, as a 0–1 position. Exported mostly so
 * the rules above can be tested one at a time.
 */
export function shopPositions<T extends Placeable>(
  items: readonly T[],
  learned: Readonly<Record<string, AislePosition>>,
): Map<string, number> {
  const seed = seedPositions(items)
  const categories = categoryPositions(items, learned)
  const positions = new Map<string, number>()

  for (const item of items) {
    const seedPos = seed.get(item.catalogueItemId) ?? 0.5
    const fact = learned[item.catalogueItemId]

    if (fact && fact.samples > 0) {
      const trust = Math.min(1, fact.samples / TRUSTED_AFTER)
      positions.set(item.catalogueItemId, trust * fact.avgPosition + (1 - trust) * seedPos)
      continue
    }

    const neighbours = categories.get(item.category)
    if (neighbours !== undefined) {
      positions.set(
        item.catalogueItemId,
        CATEGORY_TRUST * neighbours + (1 - CATEGORY_TRUST) * seedPos,
      )
      continue
    }

    positions.set(item.catalogueItemId, seedPos)
  }

  return positions
}

/**
 * The list in the order this shop is walked. Ties fall back to the seed order,
 * so the result is stable rather than depending on which way round two items
 * happened to arrive.
 */
export function sortByLearnedOrder<T extends Placeable>(
  items: readonly T[],
  learned: Readonly<Record<string, AislePosition>>,
): T[] {
  const positions = shopPositions(items, learned)

  return [...items].sort((a, b) => {
    const byPosition =
      (positions.get(a.catalogueItemId) ?? 0.5) - (positions.get(b.catalogueItemId) ?? 0.5)
    if (byPosition !== 0) return byPosition
    return a.sortOrder - b.sortOrder || a.catalogueItemId.localeCompare(b.catalogueItemId)
  })
}
