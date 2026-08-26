/*
 * "You usually need…" — the quiet strip of things that look due.
 *
 * NIU.md §5 is specific about this: suggestions, never auto-add. The app may say
 * it thinks the milk is due; putting it on the list is always a tap. So this
 * module answers one question — *what looks due right now* — and nothing here
 * writes anything.
 *
 * What "due" means, and why it is deliberately dull arithmetic: the database
 * keeps, per item, how many times it has been bought, when it last was, and a
 * rolling average of the gap in days between buying it (§5, "stats, not a log").
 * An item is due when about as long has passed as usually passes. That is the
 * whole model. It needs no training and it explains itself in one line, which
 * matters because the strip has to be *trustworthy*: a suggestion nobody
 * believes is worse than no strip at all.
 *
 * Three guards keep it quiet:
 *
 *  - Two purchases minimum. One purchase is not a rhythm, and the average gap
 *    doesn't exist yet anyway.
 *  - 80% of the usual gap, not 100%. Being told about the milk the morning it
 *    runs out is too late to be useful in a shop.
 *  - Anything already on the list is left out — it is showing up above, and a
 *    suggestion you have already acted on is clutter.
 *
 * Pure functions, no Svelte and no Supabase: this is the kind of rule that is
 * either right or subtly wrong, and a phone can't tell you which.
 */

/** What the database knows about how often one item gets bought. */
export interface BuyingStat {
  timesBought: number
  /** ISO timestamp, or null if it has never been bought. */
  lastBoughtAt: string | null
  /** Rolling average days between purchases, or null before there are two. */
  avgGapDays: number | null
}

/** The minimum an item needs to be suggestable. */
export interface Suggestable {
  id: string
}

/** Purchases needed before the rhythm counts as one. */
export const MIN_PURCHASES = 2

/** How far through the usual gap before something is worth mentioning. */
export const DUE_AT = 0.8

/**
 * How overdue an item is: 1 means exactly due, 2 means twice as long as usual
 * has passed. Null when there is no rhythm to be late against.
 */
export function overdueRatio(stat: BuyingStat | undefined, now: number): number | null {
  if (!stat) return null
  if (stat.timesBought < MIN_PURCHASES) return null
  if (stat.lastBoughtAt === null) return null
  if (stat.avgGapDays === null || stat.avgGapDays <= 0) return null

  const last = new Date(stat.lastBoughtAt).getTime()
  if (Number.isNaN(last)) return null

  const elapsedDays = (now - last) / 86_400_000
  if (elapsedDays < 0) return null

  return elapsedDays / stat.avgGapDays
}

/**
 * The items worth suggesting, most overdue first.
 *
 * `now` is passed in rather than read from the clock so the rule can be tested
 * at a fixed moment.
 */
export function dueNow<T extends Suggestable>(
  catalogue: readonly T[],
  stats: Readonly<Record<string, BuyingStat>>,
  onList: ReadonlySet<string>,
  now: number,
  limit = 6,
): T[] {
  const scored: { item: T; ratio: number }[] = []

  for (const item of catalogue) {
    if (onList.has(item.id)) continue

    const ratio = overdueRatio(stats[item.id], now)
    if (ratio === null || ratio < DUE_AT) continue

    scored.push({ item, ratio })
  }

  scored.sort((a, b) => b.ratio - a.ratio)
  return scored.slice(0, limit).map((entry) => entry.item)
}
