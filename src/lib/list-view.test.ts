import { describe, expect, it } from 'vitest'
import {
  type DisplayItem,
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
