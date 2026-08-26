import { describe, expect, it } from 'vitest'
import {
  type DisplayItem,
  type PickerItem,
  categoriesInOrder,
  categoryPicks,
  suggestedPicks,
  floatUrgent,
  groupByCategory,
  initialFor,
  matchesSearch,
  sortItems,
  splitByChecked,
} from './list-view'

function item(overrides: Partial<DisplayItem> & { name: string }): DisplayItem {
  return {
    id: overrides.name,
    catalogueItemId: `cat-${overrides.name}`,
    category: 'Pantry',
    icon: null,
    emoji: null,
    sortOrder: 0,
    quantity: null,
    unit: null,
    note: null,
    urgent: false,
    checkedAt: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    addedBy: 'user-1',
    ...overrides,
  }
}

describe('initialFor', () => {
  it('takes the first letter, uppercased', () => {
    expect(initialFor('milk')).toBe('M')
    expect(initialFor('  eggs')).toBe('E')
  })

  it('handles accented and non-Latin first letters as one character', () => {
    expect(initialFor('éclair')).toBe('É')
    expect(initialFor('ñoquis')).toBe('Ñ')
  })

  it('falls back rather than returning an empty tile', () => {
    expect(initialFor('')).toBe('?')
    expect(initialFor('   ')).toBe('?')
  })
})

describe('splitByChecked', () => {
  it('separates what is still to buy from what is in the trolley', () => {
    const items = [
      item({ name: 'milk' }),
      item({ name: 'eggs', checkedAt: '2026-01-01T10:00:00.000Z' }),
      item({ name: 'bread' }),
    ]
    const { toBuy, inTrolley } = splitByChecked(items)
    expect(toBuy.map((i) => i.name)).toEqual(['milk', 'bread'])
    expect(inTrolley.map((i) => i.name)).toEqual(['eggs'])
  })

  it('puts the most recently ticked item at the top of the trolley', () => {
    // Whatever you just tapped is what you might have tapped by mistake, so it
    // has to be the easiest one to reach and put back.
    const items = [
      item({ name: 'first', checkedAt: '2026-01-01T10:00:00.000Z' }),
      item({ name: 'third', checkedAt: '2026-01-01T10:20:00.000Z' }),
      item({ name: 'second', checkedAt: '2026-01-01T10:10:00.000Z' }),
    ]
    expect(splitByChecked(items).inTrolley.map((i) => i.name)).toEqual([
      'third',
      'second',
      'first',
    ])
  })

  it('leaves the still-to-buy order alone', () => {
    const items = [item({ name: 'a' }), item({ name: 'b' }), item({ name: 'c' })]
    expect(splitByChecked(items).toBuy.map((i) => i.name)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the array it was given', () => {
    const items = [
      item({ name: 'x', checkedAt: '2026-01-01T10:00:00.000Z' }),
      item({ name: 'y', checkedAt: '2026-01-01T11:00:00.000Z' }),
    ]
    const before = items.map((i) => i.name)
    splitByChecked(items)
    expect(items.map((i) => i.name)).toEqual(before)
  })
})

describe('sortItems', () => {
  const items = [
    item({ name: 'yoghurt', sortOrder: 30, addedAt: '2026-01-03T00:00:00.000Z' }),
    item({ name: 'apples', sortOrder: 10, addedAt: '2026-01-01T00:00:00.000Z' }),
    item({ name: 'bread', sortOrder: 20, addedAt: '2026-01-02T00:00:00.000Z' }),
  ]

  it('shop-order follows the catalogue order, not the alphabet', () => {
    expect(sortItems(items, 'shop-order').map((i) => i.name)).toEqual([
      'apples',
      'bread',
      'yoghurt',
    ])
  })

  it('recent puts the newest addition first', () => {
    expect(sortItems(items, 'recent').map((i) => i.name)).toEqual(['yoghurt', 'bread', 'apples'])
  })

  it('does not mutate the array it was given', () => {
    const original = [...items]
    sortItems(items, 'recent')
    expect(items).toEqual(original)
  })

  it('breaks ties on name so the order is stable, not arbitrary', () => {
    const tied = [
      item({ name: 'pears', sortOrder: 5 }),
      item({ name: 'melon', sortOrder: 5 }),
    ]
    expect(sortItems(tied, 'shop-order').map((i) => i.name)).toEqual(['melon', 'pears'])
  })
})

describe('floatUrgent', () => {
  it('lifts urgent items above the rest', () => {
    const items = [
      item({ name: 'milk' }),
      item({ name: 'nappies', urgent: true }),
      item({ name: 'bread' }),
    ]
    expect(floatUrgent(items).map((i) => i.name)).toEqual(['nappies', 'milk', 'bread'])
  })

  it('keeps the existing order within each group', () => {
    const items = [
      item({ name: 'a', urgent: true }),
      item({ name: 'b' }),
      item({ name: 'c', urgent: true }),
      item({ name: 'd' }),
    ]
    expect(floatUrgent(items).map((i) => i.name)).toEqual(['a', 'c', 'b', 'd'])
  })
})

describe('groupByCategory', () => {
  it('groups while preserving the order items arrived in', () => {
    const items = [
      item({ name: 'apples', category: 'Fruit & vegetables' }),
      item({ name: 'rice', category: 'Pantry' }),
      item({ name: 'pears', category: 'Fruit & vegetables' }),
    ]
    const groups = groupByCategory(items)
    expect(groups.map((g) => g.key)).toEqual(['Fruit & vegetables', 'Pantry'])
    expect(groups[0]!.items.map((i) => i.name)).toEqual(['apples', 'pears'])
  })

  it('returns nothing for an empty list rather than an empty group', () => {
    expect(groupByCategory([])).toEqual([])
  })
})

describe('matchesSearch', () => {
  it('matches case-insensitively on a substring', () => {
    expect(matchesSearch('Olive oil', 'OIL')).toBe(true)
    expect(matchesSearch('Olive oil', 'live')).toBe(true)
    expect(matchesSearch('Olive oil', 'butter')).toBe(false)
  })

  it('ignores accents in both directions', () => {
    expect(matchesSearch('café', 'cafe')).toBe(true)
    expect(matchesSearch('cafe', 'café')).toBe(true)
  })

  it('treats an empty query as matching everything', () => {
    expect(matchesSearch('anything', '')).toBe(true)
    expect(matchesSearch('anything', '   ')).toBe(true)
  })
})

function pick(overrides: Partial<PickerItem> & { id: string }): PickerItem {
  return {
    name: overrides.id,
    category: 'Pantry',
    icon: null,
    emoji: null,
    sortOrder: 0,
    suggestedRank: null,
    useCount: 0,
    ...overrides,
  }
}

describe('suggestedPicks', () => {
  it('falls back to the hand-picked order when nothing has been used', () => {
    const catalogue = [
      pick({ id: 'rice', suggestedRank: 3 }),
      pick({ id: 'milk', suggestedRank: 1 }),
      pick({ id: 'bread', suggestedRank: 2 }),
      pick({ id: 'capers' }),
    ]
    expect(suggestedPicks(catalogue, new Set()).map((i) => i.id)).toEqual([
      'milk',
      'bread',
      'rice',
    ])
  })

  it('puts what the household actually buys above the suggestions', () => {
    const catalogue = [
      pick({ id: 'milk', suggestedRank: 1 }),
      pick({ id: 'bread', suggestedRank: 2 }),
      pick({ id: 'anchovies', useCount: 9 }),
    ]
    // Used beats seeded even when the seeded item is rank 1.
    expect(suggestedPicks(catalogue, new Set()).map((i) => i.id)).toEqual([
      'anchovies',
      'milk',
      'bread',
    ])
  })

  it('orders used items by how often, most first', () => {
    const catalogue = [
      pick({ id: 'a', useCount: 2 }),
      pick({ id: 'b', useCount: 7 }),
      pick({ id: 'c', useCount: 4 }),
    ]
    expect(suggestedPicks(catalogue, new Set()).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('leaves out anything already on the list', () => {
    const catalogue = [
      pick({ id: 'milk', suggestedRank: 1 }),
      pick({ id: 'bread', suggestedRank: 2 }),
    ]
    expect(suggestedPicks(catalogue, new Set(['milk'])).map((i) => i.id)).toEqual(['bread'])
  })

  it('respects the limit', () => {
    const catalogue = Array.from({ length: 30 }, (_, i) =>
      pick({ id: `i${i}`, suggestedRank: i + 1 }),
    )
    expect(suggestedPicks(catalogue, new Set(), 5)).toHaveLength(5)
  })

  it('returns nothing rather than throwing on an empty catalogue', () => {
    expect(suggestedPicks([], new Set())).toEqual([])
  })
})

describe('categoriesInOrder', () => {
  it('orders categories by where their items sit, not alphabetically', () => {
    const catalogue = [
      pick({ id: 'toilet paper', category: 'Household', sortOrder: 8000 }),
      pick({ id: 'apples', category: 'Fruit & vegetables', sortOrder: 0 }),
      pick({ id: 'bread', category: 'Bakery', sortOrder: 1000 }),
    ]
    expect(categoriesInOrder(catalogue)).toEqual([
      'Fruit & vegetables',
      'Bakery',
      'Household',
    ])
  })
})

describe('categoryPicks', () => {
  it('returns one category in grid order', () => {
    const catalogue = [
      pick({ id: 'pears', category: 'Fruit & vegetables', sortOrder: 5 }),
      pick({ id: 'rice', category: 'Pantry', sortOrder: 4000 }),
      pick({ id: 'apples', category: 'Fruit & vegetables', sortOrder: 1 }),
    ]
    expect(categoryPicks(catalogue, 'Fruit & vegetables').map((i) => i.id)).toEqual([
      'apples',
      'pears',
    ])
  })
})
