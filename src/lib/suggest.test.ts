import { describe, expect, it } from 'vitest'
import { type BuyingStat, DUE_AT, dueNow, overdueRatio } from './suggest'

const NOW = new Date('2026-08-26T09:00:00.000Z').getTime()
const DAY = 86_400_000

function daysAgo(days: number): string {
  return new Date(NOW - days * DAY).toISOString()
}

function stat(overrides: Partial<BuyingStat> = {}): BuyingStat {
  return { timesBought: 6, lastBoughtAt: daysAgo(7), avgGapDays: 7, ...overrides }
}

describe('overdueRatio', () => {
  it('is 1 when exactly the usual gap has passed', () => {
    expect(overdueRatio(stat(), NOW)).toBeCloseTo(1)
  })

  it('grows as the item gets later', () => {
    expect(overdueRatio(stat({ lastBoughtAt: daysAgo(14) }), NOW)).toBeCloseTo(2)
    expect(overdueRatio(stat({ lastBoughtAt: daysAgo(3.5) }), NOW)).toBeCloseTo(0.5)
  })

  it('says nothing about an item bought only once', () => {
    expect(overdueRatio(stat({ timesBought: 1 }), NOW)).toBeNull()
  })

  it('says nothing when there is no rhythm yet', () => {
    expect(overdueRatio(stat({ avgGapDays: null }), NOW)).toBeNull()
    expect(overdueRatio(stat({ lastBoughtAt: null }), NOW)).toBeNull()
    expect(overdueRatio(undefined, NOW)).toBeNull()
  })

  it('refuses to divide by a nonsense gap', () => {
    expect(overdueRatio(stat({ avgGapDays: 0 }), NOW)).toBeNull()
    expect(overdueRatio(stat({ avgGapDays: -3 }), NOW)).toBeNull()
  })

  it('ignores a purchase dated in the future rather than reporting a negative', () => {
    expect(overdueRatio(stat({ lastBoughtAt: daysAgo(-2) }), NOW)).toBeNull()
  })

  it('ignores an unparseable date instead of throwing', () => {
    expect(overdueRatio(stat({ lastBoughtAt: 'not a date' }), NOW)).toBeNull()
  })
})

describe('dueNow', () => {
  const catalogue = [{ id: 'milk' }, { id: 'bread' }, { id: 'bleach' }, { id: 'saffron' }]

  it('suggests the things whose usual gap has nearly passed, latest first', () => {
    const stats = {
      milk: stat({ lastBoughtAt: daysAgo(9) }), // 1.29 of the usual gap
      bread: stat({ lastBoughtAt: daysAgo(21), avgGapDays: 7 }), // 3.0
      bleach: stat({ lastBoughtAt: daysAgo(2) }), // 0.29 — not yet
    }
    expect(dueNow(catalogue, stats, new Set(), NOW).map((i) => i.id)).toEqual(['bread', 'milk'])
  })

  it('starts mentioning something a little before it is actually due', () => {
    // Just past four-fifths of a seven-day rhythm: mentioned, though not due.
    const stats = { milk: stat({ lastBoughtAt: daysAgo(7 * DUE_AT + 0.05) }) }
    expect(dueNow(catalogue, stats, new Set(), NOW).map((i) => i.id)).toEqual(['milk'])

    const earlier = { milk: stat({ lastBoughtAt: daysAgo(7 * DUE_AT - 0.05) }) }
    expect(dueNow(catalogue, earlier, new Set(), NOW)).toEqual([])
  })

  it('leaves out anything already on the list', () => {
    const stats = { milk: stat({ lastBoughtAt: daysAgo(30) }) }
    expect(dueNow(catalogue, stats, new Set(['milk']), NOW)).toEqual([])
  })

  it('leaves out anything the household has muted', () => {
    const stats = { milk: stat({ lastBoughtAt: daysAgo(30) }) }
    expect(dueNow(catalogue, stats, new Set(), NOW, 6, new Set(['milk']))).toEqual([])
  })

  it('mutes one thing without silencing the rest', () => {
    const stats = {
      milk: stat({ lastBoughtAt: daysAgo(30) }),
      bread: stat({ lastBoughtAt: daysAgo(40) }),
    }
    expect(
      dueNow(catalogue, stats, new Set(), NOW, 6, new Set(['bread'])).map((i) => i.id),
    ).toEqual(['milk'])
  })

  it('says nothing at all for a household with no history', () => {
    expect(dueNow(catalogue, {}, new Set(), NOW)).toEqual([])
  })

  it('keeps the strip short', () => {
    const stats: Record<string, BuyingStat> = {}
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `item-${i}` }))
    for (const item of many) stats[item.id] = stat({ lastBoughtAt: daysAgo(30) })

    expect(dueNow(many, stats, new Set(), NOW)).toHaveLength(6)
    expect(dueNow(many, stats, new Set(), NOW, 3)).toHaveLength(3)
  })
})
