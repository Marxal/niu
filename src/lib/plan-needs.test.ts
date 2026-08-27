import { describe, expect, it } from 'vitest'
import type { Dish } from './dishes'
import type { PlanEntry } from './plan'
import { planNeeds } from './plan-needs'

function dish(id: string, name: string, itemIds: string[]): Dish {
  return {
    id,
    name,
    icon: null,
    cook: 'none',
    tagIds: [],
    itemIds,
    timesAdded: 0,
    lastAddedAt: null,
    timesPlanned: 0,
    lastPlannedAt: null,
  }
}

const LIBRARY = new Map([
  ['lasagne', dish('lasagne', 'Lasagne', ['pasta', 'toms'])],
  ['bruschetta', dish('bruschetta', 'Bruschetta', ['bread', 'toms'])],
  ['name-only', dish('name-only', 'Something', [])],
])

function entry(overrides: Partial<PlanEntry> = {}): PlanEntry {
  return {
    id: 'e1',
    date: '2026-09-01',
    meal: 'dinner',
    position: 0,
    kind: 'dish',
    dishId: 'lasagne',
    itemId: null,
    toCook: false,
    note: null,
    createdAt: '2026-08-30T10:00:00.000Z',
    ...overrides,
  }
}

describe('planNeeds', () => {
  it('collects a dish’s ingredients', () => {
    const needs = planNeeds([entry()], '2026-09-01', '2026-09-07', LIBRARY, new Set())
    expect(needs.all.map((n) => n.itemId).sort()).toEqual(['pasta', 'toms'])
    expect(needs.missing).toHaveLength(2)
  })

  it('merges two dishes wanting the same thing into one need with both names', () => {
    const needs = planNeeds(
      [entry({ id: 'a' }), entry({ id: 'b', date: '2026-09-02', dishId: 'bruschetta' })],
      '2026-09-01',
      '2026-09-07',
      LIBRARY,
      new Set(),
    )
    const toms = needs.all.find((n) => n.itemId === 'toms')
    expect(toms?.dishNames).toEqual(['Bruschetta', 'Lasagne'])
    expect(needs.all).toHaveLength(3)
  })

  it('takes a plain item straight, with nobody’s name on it', () => {
    const needs = planNeeds(
      [entry({ kind: 'item', dishId: null, itemId: 'broccoli' })],
      '2026-09-01',
      '2026-09-07',
      LIBRARY,
      new Set(),
    )
    expect(needs.all).toEqual([{ itemId: 'broccoli', dishNames: [], onList: false }])
  })

  it('never asks you to buy leftovers or a night out', () => {
    const needs = planNeeds(
      [
        entry({ id: 'l', kind: 'leftovers' }),
        entry({ id: 'o', kind: 'out', dishId: null }),
      ],
      '2026-09-01',
      '2026-09-07',
      LIBRARY,
      new Set(),
    )
    expect(needs.all).toEqual([])
    expect(needs.silent).toBe(2)
  })

  it('counts a dish that is just a name as silent rather than as an error', () => {
    const needs = planNeeds(
      [entry({ dishId: 'name-only' })],
      '2026-09-01',
      '2026-09-07',
      LIBRARY,
      new Set(),
    )
    expect(needs.all).toEqual([])
    expect(needs.silent).toBe(1)
  })

  it('does the same for a dish deleted on the other phone', () => {
    const needs = planNeeds(
      [entry({ dishId: 'gone' })],
      '2026-09-01',
      '2026-09-07',
      LIBRARY,
      new Set(),
    )
    expect(needs.all).toEqual([])
    expect(needs.silent).toBe(1)
  })

  it('separates what is already on the list from what would be added', () => {
    const needs = planNeeds(
      [entry()],
      '2026-09-01',
      '2026-09-07',
      LIBRARY,
      new Set(['toms']),
    )
    expect(needs.all).toHaveLength(2)
    expect(needs.missing.map((n) => n.itemId)).toEqual(['pasta'])
    expect(needs.all.find((n) => n.itemId === 'toms')?.onList).toBe(true)
  })

  it('respects the range at both ends', () => {
    const week = [
      entry({ id: 'before', date: '2026-08-30' }),
      entry({ id: 'inside', date: '2026-09-01', dishId: 'bruschetta' }),
      entry({ id: 'after', date: '2026-09-08' }),
    ]
    const needs = planNeeds(week, '2026-09-01', '2026-09-07', LIBRARY, new Set())
    expect(needs.all.map((n) => n.itemId).sort()).toEqual(['bread', 'toms'])
  })
})
