import { describe, expect, it } from 'vitest'
import {
  type AislePosition,
  type Placeable,
  CATEGORY_TRUST,
  TRUSTED_AFTER,
  shopPositions,
  sortByLearnedOrder,
} from './shop-order'

function item(id: string, category: string, sortOrder: number): Placeable {
  return { catalogueItemId: id, category, sortOrder }
}

function learned(entries: Record<string, [number, number]>): Record<string, AislePosition> {
  const out: Record<string, AislePosition> = {}
  for (const [id, [avgPosition, samples]] of Object.entries(entries)) {
    out[id] = { avgPosition, samples }
  }
  return out
}

/** The seed order, as the module spreads it: (index + 1) / (n + 1). */
function seedPos(index: number, count: number): number {
  return (index + 1) / (count + 1)
}

const catalogue = [
  item('apples', 'Fruit', 10),
  item('carrots', 'Fruit', 20),
  item('milk', 'Dairy', 30),
  item('cheese', 'Dairy', 40),
  item('bleach', 'Household', 50),
]

describe('shopPositions', () => {
  it('falls back to the catalogue order when nothing has been learned', () => {
    const positions = shopPositions(catalogue, {})
    expect([...positions.values()]).toEqual([1, 2, 3, 4, 5].map((n) => n / 6))
  })

  it('barely moves an item after one shop, and trusts it fully after three', () => {
    const once = shopPositions(catalogue, learned({ bleach: [0, 1] }))
    const thrice = shopPositions(catalogue, learned({ bleach: [0, 3] }))

    const seed = seedPos(4, 5) // bleach is last in the seed order
    // One shop is worth a third of the way towards what it claims.
    expect(once.get('bleach')).toBeCloseTo((1 / TRUSTED_AFTER) * 0 + (1 - 1 / TRUSTED_AFTER) * seed)
    expect(thrice.get('bleach')).toBeCloseTo(0)
  })

  it('never trusts an item more than completely, however many shops', () => {
    const positions = shopPositions(catalogue, learned({ bleach: [0, 40] }))
    expect(positions.get('bleach')).toBeCloseTo(0)
  })

  it('lends a first-time item its category’s learned position, at half weight', () => {
    // Dairy turns out to be at the very front of this shop.
    const positions = shopPositions(catalogue, learned({ milk: [0.1, 5] }))

    const seed = seedPos(3, 5) // cheese
    expect(positions.get('cheese')).toBeCloseTo(CATEGORY_TRUST * 0.1 + (1 - CATEGORY_TRUST) * seed)
  })

  it('weights a category’s average by how much each item has been seen', () => {
    // One well-established item at the front, one flimsy claim at the back.
    const positions = shopPositions(
      catalogue,
      learned({ apples: [0.1, 9], carrots: [0.9, 1] }),
    )
    // Fruit's mean is (0.1*9 + 0.9*1) / 10 = 0.18, not the plain 0.5.
    const fruitMean = 0.18
    // Nothing else is in Fruit, so check the mean via a third fruit item.
    const withThird = shopPositions(
      [...catalogue, item('pears', 'Fruit', 15)],
      learned({ apples: [0.1, 9], carrots: [0.9, 1] }),
    )
    const seed = seedPos(1, 6) // pears sorts second of six
    expect(withThird.get('pears')).toBeCloseTo(CATEGORY_TRUST * fruitMean + (1 - CATEGORY_TRUST) * seed)
    expect(positions.get('bleach')).toBeCloseTo(seedPos(4, 5))
  })

  it('leaves a category with nothing learned on the seed order', () => {
    const positions = shopPositions(catalogue, learned({ milk: [0.1, 5] }))
    expect(positions.get('bleach')).toBeCloseTo(seedPos(4, 5))
  })
})

describe('sortByLearnedOrder', () => {
  it('keeps the catalogue order until something is learned', () => {
    expect(sortByLearnedOrder(catalogue, {}).map((i) => i.catalogueItemId)).toEqual([
      'apples',
      'carrots',
      'milk',
      'cheese',
      'bleach',
    ])
  })

  it('walks the shop the way it was actually walked', () => {
    // This shop keeps its cleaning products by the door and its fruit at the back.
    const order = sortByLearnedOrder(
      catalogue,
      learned({ bleach: [0.05, 6], milk: [0.4, 6], cheese: [0.45, 6], apples: [0.9, 6], carrots: [0.95, 6] }),
    )
    expect(order.map((i) => i.catalogueItemId)).toEqual([
      'bleach',
      'milk',
      'cheese',
      'apples',
      'carrots',
    ])
  })

  it('drops a never-bought item in beside the rest of its category', () => {
    // Dairy is at the front here; cheese has never been bought.
    const order = sortByLearnedOrder(
      catalogue,
      learned({ milk: [0.05, 6], apples: [0.9, 6], carrots: [0.95, 6] }),
    )
    // Cheese should have left the tail and followed milk to the front, ahead of
    // the fruit it sits behind in the catalogue.
    expect(order.map((i) => i.catalogueItemId).indexOf('cheese')).toBeLessThan(
      order.map((i) => i.catalogueItemId).indexOf('apples'),
    )
  })

  it('is stable: equal positions keep the catalogue order', () => {
    const tied = learned({ apples: [0.5, 9], carrots: [0.5, 9], milk: [0.5, 9] })
    const forwards = sortByLearnedOrder(catalogue, tied).map((i) => i.catalogueItemId)
    const backwards = sortByLearnedOrder([...catalogue].reverse(), tied).map(
      (i) => i.catalogueItemId,
    )
    expect(forwards).toEqual(backwards)
  })

  it('does not modify the list it was given', () => {
    const original = [...catalogue]
    sortByLearnedOrder(catalogue, learned({ bleach: [0, 5] }))
    expect(catalogue).toEqual(original)
  })
})
