import { describe, expect, it } from 'vitest'
import {
  MIN_KNOWN_ITEMS,
  REGULAR_BUYS,
  REGULAR_GAP_DAYS,
  USUAL_AT,
  listReadiness,
  proposeShop,
} from './list-magic'
import { DUE_AT, type BuyingStat } from './suggest'

const NOW = new Date(2026, 8, 12, 9, 0, 0).getTime() // 12 Sep 2026, 9am

function daysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString()
}

/** A rhythm: bought `times` times, `ago` days back, every `gap` days. */
function stat(times: number, ago: number, gap: number | null): BuyingStat {
  return { timesBought: times, lastBoughtAt: daysAgo(ago), avgGapDays: gap }
}

const NONE = new Set<string>()

describe('listReadiness', () => {
  it('is not ready with nothing', () => {
    const readiness = listReadiness({}, NOW)
    expect(readiness.ready).toBe(false)
    expect(readiness.known).toBe(0)
    expect(readiness.short).toBe(MIN_KNOWN_ITEMS)
  })

  it('only counts items with a rhythm', () => {
    const stats: Record<string, BuyingStat> = {
      // No second purchase yet, so no gap to be late against.
      once: { timesBought: 1, lastBoughtAt: daysAgo(3), avgGapDays: null },
      never: { timesBought: 0, lastBoughtAt: null, avgGapDays: null },
      milk: stat(6, 5, 7),
    }
    expect(listReadiness(stats, NOW).known).toBe(1)
  })

  it('is ready at the bar and says so', () => {
    const stats: Record<string, BuyingStat> = {}
    for (let i = 0; i < MIN_KNOWN_ITEMS; i += 1) stats[`i${i}`] = stat(4, 3, 7)
    const readiness = listReadiness(stats, NOW)
    expect(readiness.ready).toBe(true)
    expect(readiness.short).toBe(0)
  })
})

describe('proposeShop', () => {
  it('proposes nothing from nothing', () => {
    expect(proposeShop({}, NONE, NONE, NOW)).toEqual([])
  })

  it('calls something past its usual gap due', () => {
    // Bought 8 days ago, usually every 7: overdue.
    const shop = proposeShop({ milk: stat(6, 8, 7) }, NONE, NONE, NOW)
    expect(shop).toHaveLength(1)
    expect(shop[0]?.reason).toBe('due')
    expect(shop[0]?.ratio).toBeGreaterThan(1)
  })

  it('uses the same "due" bar as the suggestions strip', () => {
    // Exactly at 80% of a 10-day gap.
    const shop = proposeShop({ milk: stat(6, DUE_AT * 10, 10) }, NONE, NONE, NOW)
    expect(shop[0]?.reason).toBe('due')
  })

  it('adds a regular that is only halfway through its cycle', () => {
    // Bought 4 days ago, usually every 7. Not due — but it is the weekly shop.
    const shop = proposeShop({ milk: stat(REGULAR_BUYS, 4, 7) }, NONE, NONE, NOW)
    expect(shop).toHaveLength(1)
    expect(shop[0]?.reason).toBe('usual')
  })

  it('leaves a regular alone before halfway', () => {
    const shop = proposeShop({ milk: stat(REGULAR_BUYS, 2, 7) }, NONE, NONE, NOW)
    expect(shop).toEqual([])
  })

  it('will not call something a usual without enough purchases behind it', () => {
    const shop = proposeShop({ milk: stat(REGULAR_BUYS - 1, 4, 7) }, NONE, NONE, NOW)
    expect(shop).toEqual([])
  })

  it('will not call something you buy rarely a usual', () => {
    // Halfway through a 30-day gap is a fortnight ago. Not a reason to buy it.
    const gap = REGULAR_GAP_DAYS + 20
    const shop = proposeShop({ rice: stat(8, gap * USUAL_AT, gap) }, NONE, NONE, NOW)
    expect(shop).toEqual([])
  })

  it('still calls that rare thing due once it actually is', () => {
    const gap = REGULAR_GAP_DAYS + 20
    const shop = proposeShop({ rice: stat(8, gap, gap) }, NONE, NONE, NOW)
    expect(shop[0]?.reason).toBe('due')
  })

  it('skips what is already on the list', () => {
    expect(proposeShop({ milk: stat(6, 9, 7) }, new Set(['milk']), NONE, NOW)).toEqual([])
  })

  it('skips what has been muted by hand', () => {
    expect(proposeShop({ milk: stat(6, 9, 7) }, NONE, new Set(['milk']), NOW)).toEqual([])
  })

  it('puts every due thing above every usual, whatever the ratios', () => {
    const shop = proposeShop(
      {
        // Only just due.
        bread: stat(6, DUE_AT * 7, 7),
        // Well past halfway, but not due.
        milk: stat(6, 0.79 * 7, 7),
      },
      NONE,
      NONE,
      NOW,
    )
    expect(shop.map((entry) => entry.itemId)).toEqual(['bread', 'milk'])
  })

  it('orders each band by how overdue it is', () => {
    const shop = proposeShop(
      { a: stat(6, 8, 7), b: stat(6, 21, 7), c: stat(6, 14, 7) },
      NONE,
      NONE,
      NOW,
    )
    expect(shop.map((entry) => entry.itemId)).toEqual(['b', 'c', 'a'])
  })

  it('honours the limit', () => {
    const stats: Record<string, BuyingStat> = {}
    for (let i = 0; i < 12; i += 1) stats[`i${i}`] = stat(6, 9, 7)
    expect(proposeShop(stats, NONE, NONE, NOW, 5)).toHaveLength(5)
  })

  it('gives the same order twice for the same numbers', () => {
    const stats: Record<string, BuyingStat> = {
      a: stat(6, 9, 7),
      b: stat(6, 9, 7),
      c: stat(6, 9, 7),
    }
    expect(proposeShop(stats, NONE, NONE, NOW)).toEqual(proposeShop(stats, NONE, NONE, NOW))
  })
})
