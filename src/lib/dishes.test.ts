import { describe, expect, it } from 'vitest'
import {
  type Dish,
  COOK_LABELS,
  describeDish,
  dishBadges,
  diffIngredients,
  dishPicks,
  filterDishes,
  isSaveable,
  missingIngredients,
  sortDishes,
} from './dishes'

function dish(overrides: Partial<Dish> = {}): Dish {
  return {
    id: 'd1',
    name: 'Lasagne',
    icon: null,
    cook: 'slow',
    tagIds: [],
    itemIds: [],
    timesAdded: 0,
    lastAddedAt: null,
    timesPlanned: 0,
    lastPlannedAt: null,
    ...overrides,
  }
}

describe('sortDishes', () => {
  it('puts what the household cooks most at the front', () => {
    const sorted = sortDishes([
      dish({ id: 'a', name: 'Paella', timesAdded: 2 }),
      dish({ id: 'b', name: 'Tacos', timesAdded: 9 }),
      dish({ id: 'c', name: 'Omelette', timesAdded: 5 }),
    ])

    expect(sorted.map((d) => d.name)).toEqual(['Tacos', 'Omelette', 'Paella'])
  })

  it('falls back to alphabetical, so a fresh library reads as a list', () => {
    const sorted = sortDishes([
      dish({ id: 'a', name: 'Tacos' }),
      dish({ id: 'b', name: 'Omelette' }),
      dish({ id: 'c', name: 'Paella' }),
    ])

    expect(sorted.map((d) => d.name)).toEqual(['Omelette', 'Paella', 'Tacos'])
  })

  it('leaves the array it was given alone', () => {
    const original = [dish({ id: 'a', name: 'Tacos' }), dish({ id: 'b', name: 'Omelette' })]
    sortDishes(original)
    expect(original.map((d) => d.name)).toEqual(['Tacos', 'Omelette'])
  })
})

describe('filterDishes', () => {
  const library = [
    dish({ id: 'a', name: 'Lasagne' }),
    dish({ id: 'b', name: 'Truita de patates' }),
    dish({ id: 'c', name: 'Köttbullar' }),
  ]

  // Sorted, but not asserted here: where an accented capital lands depends on
  // the runtime's locale, and sortDishes is tested above on plain names.
  it('is the whole library for an empty query', () => {
    expect(filterDishes(library, '   ').map((d) => d.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('matches on part of a name', () => {
    expect(filterDishes(library, 'sag').map((d) => d.id)).toEqual(['a'])
  })

  it('ignores accents, so a Swedish dish is findable on a plain keyboard', () => {
    expect(filterDishes(library, 'kott').map((d) => d.id)).toEqual(['c'])
  })

  it('comes back empty rather than throwing when nothing matches', () => {
    expect(filterDishes(library, 'sushi')).toEqual([])
  })
})

describe('dishPicks', () => {
  it('numbers the tiles by library order, not by anything in the catalogue', () => {
    const picks = dishPicks(
      [
        dish({ id: 'a', name: 'Paella', timesAdded: 1 }),
        dish({ id: 'b', name: 'Tacos', timesAdded: 4 }),
      ],
      'Dishes',
    )

    expect(picks.map((p) => [p.id, p.sortOrder])).toEqual([
      ['b', 0],
      ['a', 1],
    ])
    expect(picks.every((p) => p.category === 'Dishes')).toBe(true)
    expect(picks.every((p) => p.suggestedRank === null)).toBe(true)
  })

  it('carries the dish icon through untouched', () => {
    const picks = dishPicks([dish({ icon: 'emoji:🍕' })], 'Dishes')
    expect(picks[0]?.icon).toBe('emoji:🍕')
  })
})

describe('missingIngredients', () => {
  it('is everything, for a dish nothing of which is on the list', () => {
    expect(missingIngredients(dish({ itemIds: ['x', 'y'] }), new Set())).toEqual(['x', 'y'])
  })

  it('drops what is already there', () => {
    expect(missingIngredients(dish({ itemIds: ['x', 'y'] }), new Set(['x']))).toEqual(['y'])
  })

  it('is empty for a dish with no ingredients — not an error', () => {
    expect(missingIngredients(dish(), new Set(['x']))).toEqual([])
  })
})

describe('diffIngredients', () => {
  it('finds what to add and what to take away', () => {
    expect(diffIngredients(['a', 'b'], ['b', 'c'])).toEqual({ toAdd: ['c'], toRemove: ['a'] })
  })

  it('asks for no writes at all when nothing changed', () => {
    expect(diffIngredients(['a', 'b'], ['b', 'a'])).toEqual({ toAdd: [], toRemove: [] })
  })

  it('handles a first ingredient list, and an emptied one', () => {
    expect(diffIngredients([], ['a'])).toEqual({ toAdd: ['a'], toRemove: [] })
    expect(diffIngredients(['a'], [])).toEqual({ toAdd: [], toRemove: ['a'] })
  })

  it('is not confused by a duplicate in either list', () => {
    expect(diffIngredients(['a', 'a'], ['a', 'b', 'b'])).toEqual({ toAdd: ['b'], toRemove: [] })
  })
})

describe('describeDish', () => {
  it('says what was decided, and how many things it needs', () => {
    const line = describeDish(dish({ cook: 'slow', itemIds: ['a', 'b'] }))
    expect(line).toBe(`${COOK_LABELS.slow} · 2 things`)
  })

  it('leaves out the default nobody chose', () => {
    expect(describeDish(dish({ cook: 'none', itemIds: ['a'] }))).toBe('1 thing')
  })

  it('still says something about a dish that is only a name', () => {
    expect(describeDish(dish({ cook: 'none' }))).not.toBe('')
  })

  it('never spells out the tags — they are drawn as chips beside it', () => {
    const tagged = describeDish(dish({ tagIds: ['t1', 't2'], cook: 'none', itemIds: ['a'] }))
    expect(tagged).toBe(describeDish(dish({ tagIds: [], cook: 'none', itemIds: ['a'] })))
  })
})

describe('isSaveable', () => {
  const draft = { icon: null, cook: 'none' as const, tagIds: [], itemIds: [] }

  it('needs a name', () => {
    expect(isSaveable({ ...draft, name: 'Lasagne' })).toBe(true)
    expect(isSaveable({ ...draft, name: '' })).toBe(false)
    expect(isSaveable({ ...draft, name: '   ' })).toBe(false)
  })

  it('does not need ingredients — a dish can just be a name (§4.2)', () => {
    expect(isSaveable({ ...draft, name: 'Eating out' })).toBe(true)
  })
})

describe('dishBadges', () => {
  const tags = [
    { id: 'protein', name: 'Protein', colour: 'clay' as const, position: 0 },
    { id: 'carbs', name: 'Carbs', colour: 'amber' as const, position: 1 },
  ]
  const library = [
    dish({ id: 'lasagne', name: 'Lasagne', tagIds: ['carbs', 'protein'] }),
    dish({ id: 'salad', name: 'Big salad', tagIds: [] }),
  ]

  it('takes the colour from the dish’s first tag, in tag order', () => {
    const badges = dishBadges({ row1: ['lasagne'] }, library, tags)
    // The links say carbs first; the household's order says protein first.
    expect(badges.get('row1')?.[0]?.colour).toBe('clay')
  })

  it('falls back to the default colour for a dish with no tags', () => {
    const badges = dishBadges({ row1: ['salad'] }, library, tags)
    expect(badges.get('row1')?.[0]?.colour).toBe('stone')
  })

  it('carries both dishes when two of them want the same thing', () => {
    const badges = dishBadges({ row1: ['lasagne', 'salad'] }, library, tags)
    expect(badges.get('row1')?.map((b) => b.name)).toEqual(['Big salad', 'Lasagne'])
  })

  it('skips a dish that has been deleted rather than drawing it nameless', () => {
    const badges = dishBadges({ row1: ['gone'] }, library, tags)
    expect(badges.has('row1')).toBe(false)
  })

  it('has nothing to say about a row nobody’s dish asked for', () => {
    expect(dishBadges({}, library, tags).size).toBe(0)
  })
})
