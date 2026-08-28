/*
 * "Fill the list" — the shop this household would usually be doing about now.
 *
 * The sibling of plan-magic.ts, on the other tab, and a much smaller idea
 * because the data was already there: per-item purchase rhythm, kept since
 * round 7 (NIU.md §5, "stats, not a log").
 *
 * ## How this differs from the "you usually need…" strip
 *
 * suggest.ts answers *what looks due right now* and shows the top six. That is
 * the right answer to a question you ask while standing in the kitchen. This
 * answers a different one: **it is Saturday morning and I am about to do the
 * shop.** So it is the whole thing rather than a sample, and it reaches further
 * down the cycle:
 *
 *   due     past 80% of its usual gap. The strip's own bar, so the two never
 *           disagree about a word as strong as "due".
 *   usual   past halfway, *and* something this household buys regularly enough
 *           for halfway to mean anything. This is the half a weekly shop is
 *           actually made of — the milk you buy every Saturday is only ever
 *           four days old when you buy it again.
 *
 * The second band is why the button earns its place, and it is also the one
 * that could be annoying, so it is gated twice: enough purchases to have a real
 * rhythm, and a rhythm short enough that a weekly shop is the right moment to
 * ask about it. Something you buy every two months is never a "usual".
 *
 * ## Nothing is ever added on its own
 *
 * §5 again: suggestions, never auto-add. Everything here comes back as a list
 * to tick, and the ticking is the user's. Muted items — the ones taken out of
 * "you usually need…" by hand — never appear at all, on either band.
 *
 * Pure: no Svelte, no Supabase, `now` passed in.
 */

import { DUE_AT, type BuyingStat, overdueRatio } from './suggest'

/* -------------------------------------------------------------------------- */
/* How much history is enough                                                  */
/* -------------------------------------------------------------------------- */

/**
 * How many items must have a rhythm before the button does anything.
 *
 * Eight. Below that the "shop" it proposed would be shorter than the strip
 * already showing above it, and a magic button that produces three tiles is a
 * magic button nobody presses twice.
 */
export const MIN_KNOWN_ITEMS = 8

/** How far through its usual gap something has to be to count as a "usual". */
export const USUAL_AT = 0.5

/** Purchases before a gap is trusted enough to build a whole shop on. */
export const REGULAR_BUYS = 4

/**
 * The longest usual gap that still counts as a regular.
 *
 * Ten days: a weekly shop with a week and a half of slack in it. Anything
 * slower and "halfway through" is a fortnight ago, which is not a reason to put
 * something in a trolley today.
 */
export const REGULAR_GAP_DAYS = 10

/* -------------------------------------------------------------------------- */
/* Readiness                                                                   */
/* -------------------------------------------------------------------------- */

export interface ListReadiness {
  ready: boolean
  /** Items with a usable rhythm. */
  known: number
  /** How many more are wanted. Zero once ready. */
  short: number
}

/**
 * Counts the items the app knows a rhythm for.
 *
 * Deliberately not "how many shops have you done" — the app does not keep that
 * number, and this is the one that actually decides whether the proposal can be
 * any good.
 */
export function listReadiness(
  stats: Readonly<Record<string, BuyingStat>>,
  now: number,
): ListReadiness {
  let known = 0
  for (const stat of Object.values(stats)) {
    if (overdueRatio(stat, now) !== null) known += 1
  }
  return { ready: known >= MIN_KNOWN_ITEMS, known, short: Math.max(0, MIN_KNOWN_ITEMS - known) }
}

/* -------------------------------------------------------------------------- */
/* The proposal                                                                */
/* -------------------------------------------------------------------------- */

export type ShopReason = 'due' | 'usual'

export interface ProposedShopItem {
  itemId: string
  reason: ShopReason
  /** 1 means exactly due. Kept so the sheet can order and explain itself. */
  ratio: number
}

/** Is this something bought often enough and regularly enough to be a staple? */
function isRegular(stat: BuyingStat): boolean {
  if (stat.timesBought < REGULAR_BUYS) return false
  if (stat.avgGapDays === null) return false
  return stat.avgGapDays > 0 && stat.avgGapDays <= REGULAR_GAP_DAYS
}

/**
 * The shop, most overdue first.
 *
 * Due before usual regardless of ratio, because they are different claims and
 * interleaving them would make the sheet impossible to read: the top of the
 * list is "you need this", the bottom is "you probably want this too".
 */
export function proposeShop(
  stats: Readonly<Record<string, BuyingStat>>,
  onList: ReadonlySet<string>,
  muted: ReadonlySet<string>,
  now: number,
  limit = 40,
): ProposedShopItem[] {
  const due: ProposedShopItem[] = []
  const usual: ProposedShopItem[] = []

  for (const [itemId, stat] of Object.entries(stats)) {
    if (onList.has(itemId)) continue
    if (muted.has(itemId)) continue

    const ratio = overdueRatio(stat, now)
    if (ratio === null) continue

    if (ratio >= DUE_AT) due.push({ itemId, reason: 'due', ratio })
    else if (ratio >= USUAL_AT && isRegular(stat)) usual.push({ itemId, reason: 'usual', ratio })
  }

  // The id breaks a tie so the same numbers always produce the same order on
  // both phones — the same rule plan-magic.ts follows.
  const byRatio = (a: ProposedShopItem, b: ProposedShopItem) =>
    b.ratio - a.ratio || a.itemId.localeCompare(b.itemId)

  due.sort(byRatio)
  usual.sort(byRatio)

  return [...due, ...usual].slice(0, limit)
}
