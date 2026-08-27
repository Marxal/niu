import { describe, expect, it } from 'vitest'
import type { Dish } from './dishes'
import {
  EMPTY_PANTRY,
  FRESH_DAYS,
  MAX_AT_HOME_DAYS,
  UNKNOWN_GAP_DAYS,
  atHomeItems,
  recentlyBought,
  type Pantry,
  heldAs,
  pantryFrom,
  rankMakeable,
  scoreDish,
} from './plannable'
import type { BuyingStat } from './suggest'

function dish(name: string, itemIds: string[], overrides: Partial<Dish> = {}): Dish {
  return {
    id: name.toLowerCase(),
    name,
    icon: null,
    cook: 'none',
    tagIds: [],
    itemIds,
    timesAdded: 0,
    lastAddedAt: null,
    timesPlanned: 0,
    lastPlannedAt: null,
    ...overrides,
  }
}

function stat(lastBoughtAt: string | null): BuyingStat {
  return { timesBought: 1, lastBoughtAt, avgGapDays: null }
}

const NOW = new Date(2026, 8, 10, 12, 0, 0) // 10 Sep 2026, midday, local

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString()
}

function pantry(onList: string[], boughtRecently: string[] = []): Pantry {
  return { onList: new Set(onList), boughtRecently: new Set(boughtRecently) }
}

describe('pantryFrom', () => {
  it('counts what was bought inside the window and not what was bought before it', () => {
    const built = pantryFrom(
      [],
      {
        fresh: stat(daysAgo(1)),
        edge: stat(daysAgo(FRESH_DAYS - 0.1)),
        stale: stat(daysAgo(FRESH_DAYS + 1)),
      },
      NOW,
    )
    expect([...built.boughtRecently].sort()).toEqual(['edge', 'fresh'])
  })

  it('ignores an item never bought, and a timestamp it cannot read', () => {
    const built = pantryFrom(
      [],
      { never: stat(null), broken: stat('not a date') },
      NOW,
    )
    expect(built.boughtRecently.size).toBe(0)
  })

  it('takes the list exactly as given', () => {
    const built = pantryFrom(['pasta', 'toms'], {}, NOW)
    expect(built.onList.has('pasta')).toBe(true)
    expect(built.onList.has('butter')).toBe(false)
  })
})

describe('heldAs', () => {
  it('says where an ingredient is, and prefers the list when it is in both', () => {
    const p = pantry(['toms'], ['toms', 'butter'])
    expect(heldAs('toms', p)).toBe('list')
    expect(heldAs('butter', p)).toBe('bought')
    expect(heldAs('fish', p)).toBe(null)
    expect(heldAs('anything', EMPTY_PANTRY)).toBe(null)
  })
})

describe('rankMakeable', () => {
  const lasagne = dish('Lasagne', ['pasta', 'toms', 'mince'])
  const bruschetta = dish('Bruschetta', ['bread', 'toms'])
  const justAName = dish('Eating out', [])

  it('leaves out a dish with no ingredients, because nothing is known about it', () => {
    const ranked = rankMakeable([justAName], pantry(['anything']), 0)
    expect(ranked).toEqual([])
  })

  it('counts the list and the recent shop together', () => {
    const ranked = rankMakeable([lasagne], pantry(['pasta'], ['toms']), 0)
    expect(ranked[0]?.have).toBe(2)
    expect(ranked[0]?.total).toBe(3)
    expect(ranked[0]?.missing).toEqual(['mince'])
  })

  it('puts the most complete dish first', () => {
    const ranked = rankMakeable([lasagne, bruschetta], pantry(['bread', 'toms', 'pasta']), 0)
    expect(ranked.map((m) => m.dish.name)).toEqual(['Bruschetta', 'Lasagne'])
    expect(ranked[0]?.coverage).toBe(1)
  })

  it('hides anything under the floor', () => {
    // Lasagne is 1 of 3 — a shopping trip, not a suggestion.
    expect(rankMakeable([lasagne], pantry(['pasta']))).toEqual([])
    expect(rankMakeable([lasagne], pantry(['pasta']), 0)).toHaveLength(1)
  })

  it('breaks a tie on the shorter trip, then on what the household plans most', () => {
    const four = dish('Four', ['a', 'b', 'c', 'd'])
    const two = dish('Two', ['a', 'b'])
    // Both are half done, but Two needs one more thing and Four needs two.
    const ranked = rankMakeable([four, two], pantry(['a', 'b']), 0)
    expect(ranked.map((m) => m.dish.name)).toEqual(['Two', 'Four'])

    const rare = dish('Rare', ['a'], { timesPlanned: 1 })
    const often = dish('Often', ['b'], { timesPlanned: 9 })
    const byHabit = rankMakeable([rare, often], pantry(['a', 'b']), 0)
    expect(byHabit.map((m) => m.dish.name)).toEqual(['Often', 'Rare'])
  })

  it('is stable on an exact tie, so the strip does not reshuffle', () => {
    const b = dish('Bravo', ['x'])
    const a = dish('Alpha', ['y'])
    const ranked = rankMakeable([b, a], pantry(['x', 'y']), 0)
    expect(ranked.map((m) => m.dish.name)).toEqual(['Alpha', 'Bravo'])
  })

  it('says nothing at all when the cupboard is bare', () => {
    expect(rankMakeable([lasagne, bruschetta], EMPTY_PANTRY)).toEqual([])
  })
})

describe('scoreDish', () => {
  it('scores one dish whatever its coverage', () => {
    const scored = scoreDish(dish('Lasagne', ['pasta', 'toms', 'mince']), pantry(['pasta']))
    expect(scored?.have).toBe(1)
    expect(scored?.total).toBe(3)
  })

  it('says nothing rather than "0 of 0" for a dish that is just a name', () => {
    expect(scoreDish(dish('Eating out', []), pantry([]))).toBe(null)
  })
})

describe('atHomeItems', () => {
  function stats(entries: Record<string, [number, number | null]>) {
    const out: Record<string, BuyingStat> = {}
    for (const [id, [days, gap]] of Object.entries(entries)) {
      out[id] = { timesBought: 3, lastBoughtAt: daysAgo(days), avgGapDays: gap }
    }
    return out
  }

  it('is sure about anything bought in the last few days', () => {
    const home = atHomeItems(stats({ milk: [1, 7] }), new Set(), NOW)
    expect(home).toEqual([{ itemId: 'milk', confidence: 'sure', daysAgo: 1 }])
  })

  it('double-checks something bought longer ago than that but inside its own rhythm', () => {
    // Bought 9 days ago, and this household buys it about every three weeks.
    const home = atHomeItems(stats({ rice: [9, 21] }), new Set(), NOW)
    expect(home[0]?.confidence).toBe('check')
  })

  it('says nothing about something already overdue by its own rhythm', () => {
    // Bought 9 days ago and bought weekly: it is gone, and the suggestions strip
    // is already saying so.
    expect(atHomeItems(stats({ milk: [9, 7] }), new Set(), NOW)).toEqual([])
  })

  it('falls back to a default rhythm when it has never learnt one', () => {
    expect(atHomeItems(stats({ a: [FRESH_DAYS + 1, null] }), new Set(), NOW)[0]?.confidence).toBe(
      'check',
    )
    expect(atHomeItems(stats({ a: [UNKNOWN_GAP_DAYS, null] }), new Set(), NOW)).toEqual([])
  })

  it('never claims anything past the far edge, however long the rhythm', () => {
    expect(atHomeItems(stats({ salt: [MAX_AT_HOME_DAYS, 200] }), new Set(), NOW)).toEqual([])
    expect(atHomeItems(stats({ salt: [MAX_AT_HOME_DAYS - 1, 200] }), new Set(), NOW)).toHaveLength(1)
  })

  it('leaves out anything back on the shopping list', () => {
    // Putting it back on the list says you have run out, and that is the most
    // recent thing anyone in the house has said about it.
    expect(atHomeItems(stats({ milk: [1, 7] }), new Set(['milk']), NOW)).toEqual([])
  })

  it('ignores what it has never seen bought, or cannot read', () => {
    const odd: Record<string, BuyingStat> = {
      never: { timesBought: 0, lastBoughtAt: null, avgGapDays: null },
      broken: { timesBought: 2, lastBoughtAt: 'not a date', avgGapDays: 7 },
    }
    expect(atHomeItems(odd, new Set(), NOW)).toEqual([])
  })

  it('treats a purchase from a clock running fast as today', () => {
    const future = { x: { timesBought: 1, lastBoughtAt: daysAgo(-1), avgGapDays: null } }
    expect(atHomeItems(future, new Set(), NOW)).toEqual([
      { itemId: 'x', confidence: 'sure', daysAgo: 0 },
    ])
  })

  it('puts the freshest first', () => {
    const home = atHomeItems(stats({ old: [4, 30], fresh: [0, 30] }), new Set(), NOW)
    expect(home.map((h) => h.itemId)).toEqual(['fresh', 'old'])
  })
})

describe('recentlyBought', () => {
  function stats(entries: Record<string, number | null>) {
    const out: Record<string, BuyingStat> = {}
    for (const [id, days] of Object.entries(entries)) {
      out[id] = {
        timesBought: 2,
        lastBoughtAt: days === null ? null : daysAgo(days),
        avgGapDays: null,
      }
    }
    return out
  }

  it('puts the most recent purchase first', () => {
    expect(recentlyBought(stats({ old: 20, newest: 0, middle: 5 }))).toEqual([
      'newest',
      'middle',
      'old',
    ])
  })

  it('keeps things that are already on the list', () => {
    // Unlike atHomeItems: planning broccoli for Tuesday is a fine reason to have
    // broccoli on the list, so nothing is filtered out here.
    expect(recentlyBought(stats({ a: 1 }))).toEqual(['a'])
  })

  it('goes back further than the freshness window, because it is not a claim', () => {
    expect(recentlyBought(stats({ ancient: MAX_AT_HOME_DAYS * 4 }))).toEqual(['ancient'])
  })

  it('ignores what was never bought, or cannot be read', () => {
    const odd: Record<string, BuyingStat> = {
      never: { timesBought: 0, lastBoughtAt: null, avgGapDays: null },
      broken: { timesBought: 1, lastBoughtAt: 'nope', avgGapDays: null },
    }
    expect(recentlyBought(odd)).toEqual([])
  })

  it('caps the list', () => {
    const many: Record<string, number | null> = {}
    for (let i = 0; i < 30; i++) many[`i${i}`] = i
    expect(recentlyBought(stats(many), 4)).toHaveLength(4)
  })

  it('breaks a tie on id so the row does not reshuffle between renders', () => {
    expect(recentlyBought(stats({ b: 3, a: 3 }))).toEqual(['a', 'b'])
  })
})
