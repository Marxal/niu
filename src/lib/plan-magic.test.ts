import { describe, expect, it } from 'vitest'
import type { Meal, PlanEntry } from './plan'
import {
  EMPTY_PATTERN,
  MIN_ENTRIES,
  MIN_WEEKS,
  OUT_KEY,
  dishKey,
  itemKey,
  parseTarget,
  planReadiness,
  proposeWeek,
  readWeekPattern,
} from './plan-magic'

let counter = 0

function entry(
  date: string,
  meal: Meal,
  kind: PlanEntry['kind'],
  id: string | null = null,
): PlanEntry {
  counter += 1
  return {
    id: `e${counter}`,
    date,
    meal,
    position: 0,
    kind,
    dishId: kind === 'dish' || kind === 'leftovers' ? id : null,
    itemId: kind === 'item' ? id : null,
    toCook: false,
    note: null,
    createdAt: `2026-01-01T00:00:0${counter % 10}Z`,
  }
}

/** Mondays in Aug/Sep 2026: 3, 10, 17, 24 Aug and 31 Aug, 7 Sep. */
const WEEK = '2026-09-07'

describe('target keys', () => {
  it('reads back what it wrote', () => {
    expect(parseTarget(dishKey('abc'))).toEqual({ kind: 'dish', dishId: 'abc' })
    expect(parseTarget(itemKey('xyz'))).toEqual({ kind: 'item', itemId: 'xyz' })
    expect(parseTarget(OUT_KEY)).toEqual({ kind: 'out' })
  })

  it('refuses a key it did not write', () => {
    expect(parseTarget('nonsense')).toBeNull()
  })
})

describe('readWeekPattern', () => {
  it('counts nothing from nothing', () => {
    const pattern = readWeekPattern([], WEEK)
    expect(pattern.weeks).toBe(0)
    expect(pattern.entries).toBe(0)
  })

  it('ignores the week being filled, and everything after it', () => {
    const pattern = readWeekPattern(
      [
        entry('2026-08-31', 'dinner', 'dish', 'lasagne'),
        entry(WEEK, 'dinner', 'dish', 'lasagne'),
        entry('2026-09-14', 'dinner', 'dish', 'lasagne'),
      ],
      WEEK,
    )
    expect(pattern.entries).toBe(1)
    expect(pattern.totals.get(dishKey('lasagne'))).toBe(1)
  })

  it('counts weekday, meal and total separately', () => {
    // Tacos on three Fridays, and once on a Monday lunch.
    const pattern = readWeekPattern(
      [
        entry('2026-08-07', 'dinner', 'dish', 'tacos'),
        entry('2026-08-14', 'dinner', 'dish', 'tacos'),
        entry('2026-08-21', 'dinner', 'dish', 'tacos'),
        entry('2026-08-24', 'lunch', 'dish', 'tacos'),
      ],
      WEEK,
    )
    // Friday is weekday 4, Monday-first.
    expect(pattern.slots.get(`4|dinner|${dishKey('tacos')}`)).toBe(3)
    expect(pattern.meals.get(`dinner|${dishKey('tacos')}`)).toBe(3)
    expect(pattern.meals.get(`lunch|${dishKey('tacos')}`)).toBe(1)
    expect(pattern.totals.get(dishKey('tacos'))).toBe(4)
  })

  it('counts distinct weeks, not days', () => {
    const pattern = readWeekPattern(
      [
        entry('2026-08-03', 'dinner', 'dish', 'a'),
        entry('2026-08-05', 'dinner', 'dish', 'a'),
        entry('2026-08-10', 'dinner', 'dish', 'a'),
      ],
      WEEK,
    )
    expect(pattern.weeks).toBe(2)
    expect(pattern.entries).toBe(3)
  })

  it('learns eating out as a habit of its own', () => {
    const pattern = readWeekPattern([entry('2026-08-07', 'dinner', 'out')], WEEK)
    expect(pattern.totals.get(OUT_KEY)).toBe(1)
  })

  it('does not learn leftovers as their own habit', () => {
    const pattern = readWeekPattern([entry('2026-08-07', 'dinner', 'leftovers', 'stew')], WEEK)
    expect(pattern.totals.size).toBe(0)
    expect(pattern.entries).toBe(1)
  })

  it('counts a leftovers night as a repeat of the dish it names', () => {
    const pattern = readWeekPattern(
      [
        entry('2026-08-03', 'dinner', 'dish', 'stew'),
        entry('2026-08-04', 'dinner', 'leftovers', 'stew'),
      ],
      WEEK,
    )
    expect(pattern.repeats.get(dishKey('stew'))).toBe(1)
  })

  it('counts two dish nights running as a repeat too', () => {
    const pattern = readWeekPattern(
      [
        entry('2026-08-03', 'dinner', 'dish', 'stew'),
        entry('2026-08-04', 'dinner', 'dish', 'stew'),
      ],
      WEEK,
    )
    expect(pattern.repeats.get(dishKey('stew'))).toBe(1)
  })

  it('does not call a week apart a repeat', () => {
    const pattern = readWeekPattern(
      [
        entry('2026-08-03', 'dinner', 'dish', 'stew'),
        entry('2026-08-10', 'dinner', 'dish', 'stew'),
      ],
      WEEK,
    )
    expect(pattern.repeats.has(dishKey('stew'))).toBe(false)
  })
})

describe('planReadiness', () => {
  it('is not ready with nothing', () => {
    const readiness = planReadiness(EMPTY_PATTERN)
    expect(readiness.ready).toBe(false)
    expect(readiness.weeksShort).toBe(MIN_WEEKS)
    expect(readiness.entriesShort).toBe(MIN_ENTRIES)
  })

  it('says how many weeks are missing', () => {
    const entries = ['2026-08-03', '2026-08-10'].flatMap((day) =>
      Array.from({ length: 8 }, (_, i) => entry(day, i % 2 ? 'lunch' : 'dinner', 'dish', `d${i}`)),
    )
    const readiness = planReadiness(readWeekPattern(entries, WEEK))
    expect(readiness.weeks).toBe(2)
    expect(readiness.weeksShort).toBe(1)
    // Sixteen entries clears the entry bar on its own.
    expect(readiness.entriesShort).toBe(0)
    expect(readiness.ready).toBe(false)
  })

  it('wants entries as well as weeks', () => {
    const entries = ['2026-08-03', '2026-08-10', '2026-08-17'].map((day) =>
      entry(day, 'dinner', 'dish', 'soup'),
    )
    const readiness = planReadiness(readWeekPattern(entries, WEEK))
    expect(readiness.weeksShort).toBe(0)
    expect(readiness.entriesShort).toBe(MIN_ENTRIES - 3)
    expect(readiness.ready).toBe(false)
  })

  it('is ready once both bars are cleared', () => {
    const entries = ['2026-08-03', '2026-08-10', '2026-08-17'].flatMap((day) =>
      Array.from({ length: 5 }, (_, i) => entry(day, 'dinner', 'dish', `d${i}`)),
    )
    expect(planReadiness(readWeekPattern(entries, WEEK)).ready).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */

const MEALS: readonly Meal[] = ['lunch', 'dinner']

function options(overrides: Partial<Parameters<typeof proposeWeek>[1]> = {}) {
  return {
    weekStart: WEEK,
    meals: MEALS,
    existing: [] as PlanEntry[],
    dishIds: new Set<string>(['tacos', 'stew', 'soup', 'pasta']),
    itemIds: new Set<string>(['broccoli']),
    ...overrides,
  }
}

describe('proposeWeek', () => {
  it('proposes nothing from an empty pattern', () => {
    expect(proposeWeek(EMPTY_PATTERN, options())).toEqual([])
  })

  it('puts a Friday habit on the Friday', () => {
    const pattern = readWeekPattern(
      [
        entry('2026-08-07', 'dinner', 'dish', 'tacos'),
        entry('2026-08-14', 'dinner', 'dish', 'tacos'),
        entry('2026-08-21', 'dinner', 'dish', 'tacos'),
      ],
      WEEK,
    )
    const week = proposeWeek(pattern, options())
    const tacos = week.filter((e) => e.dishId === 'tacos')
    expect(tacos).toHaveLength(1)
    // 11 Sep 2026 is the Friday of the week starting 7 Sep.
    expect(tacos[0]?.date).toBe('2026-09-11')
    expect(tacos[0]?.meal).toBe('dinner')
    expect(tacos[0]?.reason).toBe('usual-day')
  })

  it('never touches a meal that already has something in it', () => {
    const pattern = readWeekPattern(
      [
        entry('2026-08-07', 'dinner', 'dish', 'tacos'),
        entry('2026-08-14', 'dinner', 'dish', 'tacos'),
        entry('2026-08-21', 'dinner', 'dish', 'tacos'),
      ],
      WEEK,
    )
    const week = proposeWeek(
      pattern,
      options({ existing: [entry('2026-09-11', 'dinner', 'dish', 'pasta')] }),
    )
    expect(week.some((e) => e.date === '2026-09-11' && e.meal === 'dinner')).toBe(false)
  })

  it('keeps a thing to its own weekly budget', () => {
    // Soup once a week for four weeks: one soup in the proposed week.
    const pattern = readWeekPattern(
      ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24'].map((day) =>
        entry(day, 'dinner', 'dish', 'soup'),
      ),
      WEEK,
    )
    const week = proposeWeek(pattern, options())
    expect(week.filter((e) => e.dishId === 'soup')).toHaveLength(1)
  })

  it('allows twice a week when that is what happens', () => {
    // Pasta twice a week, on two different days, for three weeks.
    const pattern = readWeekPattern(
      ['2026-08-03', '2026-08-10', '2026-08-17'].flatMap((day) => [
        entry(day, 'dinner', 'dish', 'pasta'),
        entry(`${day.slice(0, 8)}${String(Number(day.slice(8)) + 3).padStart(2, '0')}`,
          'dinner', 'dish', 'pasta'),
      ]),
      WEEK,
    )
    expect(proposeWeek(pattern, options()).filter((e) => e.dishId === 'pasta')).toHaveLength(2)
  })

  it('copies a cook-then-leftovers rhythm onto the next day', () => {
    // Stew on a Monday and again on the Tuesday, three weeks running.
    const pattern = readWeekPattern(
      ['2026-08-03', '2026-08-10', '2026-08-17'].flatMap((monday) => [
        entry(monday, 'dinner', 'dish', 'stew'),
        entry(`${monday.slice(0, 8)}${String(Number(monday.slice(8)) + 1).padStart(2, '0')}`,
          'dinner', 'leftovers', 'stew'),
      ]),
      WEEK,
    )
    const week = proposeWeek(pattern, options({ meals: ['dinner'] }))
    const stew = week.filter((e) => e.dishId === 'stew')
    expect(stew).toHaveLength(2)
    expect(stew[0]?.kind).toBe('dish')
    expect(stew[1]?.kind).toBe('leftovers')
    expect(stew[1]?.reason).toBe('repeat')
    expect(stew[1]?.date).toBe('2026-09-08')
  })

  it('leaves out a dish that no longer exists', () => {
    const pattern = readWeekPattern(
      ['2026-08-03', '2026-08-10', '2026-08-17'].map((day) =>
        entry(day, 'dinner', 'dish', 'deleted'),
      ),
      WEEK,
    )
    expect(proposeWeek(pattern, options())).toEqual([])
  })

  it('proposes a plain item as an item', () => {
    const pattern = readWeekPattern(
      ['2026-08-03', '2026-08-10'].map((day) => entry(day, 'lunch', 'item', 'broccoli')),
      WEEK,
    )
    const week = proposeWeek(pattern, options({ meals: ['lunch'] }))
    expect(week[0]?.kind).toBe('item')
    expect(week[0]?.itemId).toBe('broccoli')
    expect(week[0]?.dishId).toBeNull()
  })

  it('starts at `from` when one is given', () => {
    const pattern = readWeekPattern(
      ['2026-08-03', '2026-08-10', '2026-08-17'].map((day) =>
        entry(day, 'dinner', 'dish', 'soup'),
      ),
      WEEK,
    )
    const week = proposeWeek(pattern, options({ from: '2026-09-10' }))
    expect(week.every((e) => e.date >= '2026-09-10')).toBe(true)
  })

  it('gives the same week twice for the same history', () => {
    const history = ['2026-08-03', '2026-08-10', '2026-08-17'].flatMap((day) => [
      entry(day, 'lunch', 'dish', 'soup'),
      entry(day, 'dinner', 'dish', 'pasta'),
    ])
    const pattern = readWeekPattern(history, WEEK)
    expect(proposeWeek(pattern, options())).toEqual(proposeWeek(pattern, options()))
  })


  it('does not let an earlier day steal a weekday habit', () => {
    // Tacos are always Friday; soup is planned more often but on no fixed day.
    const pattern = readWeekPattern(
      [
        entry('2026-08-07', 'dinner', 'dish', 'tacos'),
        entry('2026-08-14', 'dinner', 'dish', 'tacos'),
        entry('2026-08-21', 'dinner', 'dish', 'tacos'),
        entry('2026-08-03', 'dinner', 'dish', 'soup'),
        entry('2026-08-05', 'dinner', 'dish', 'soup'),
        entry('2026-08-11', 'dinner', 'dish', 'soup'),
        entry('2026-08-19', 'dinner', 'dish', 'soup'),
        entry('2026-08-25', 'dinner', 'dish', 'soup'),
      ],
      WEEK,
    )
    const week = proposeWeek(pattern, options({ meals: ['dinner'] }))
    expect(week.find((e) => e.dishId === 'tacos')?.date).toBe('2026-09-11')
  })

  it('needs two sightings before a weekday counts as a habit', () => {
    const pattern = readWeekPattern(
      [
        entry('2026-08-07', 'dinner', 'dish', 'tacos'),
        entry('2026-08-03', 'dinner', 'dish', 'tacos'),
        entry('2026-08-10', 'dinner', 'dish', 'tacos'),
      ],
      WEEK,
    )
    // Twice on a Monday beats once on a Friday: Monday is the anchor.
    expect(proposeWeek(pattern, options({ meals: ['dinner'] }))[0]?.date).toBe('2026-09-07')
  })

  it('gives a cook-and-repeat dish two nights, never three', () => {
    // Both nights written as dish entries: two a week, and a repeat rhythm.
    const pattern = readWeekPattern(
      ['2026-08-03', '2026-08-10', '2026-08-17'].flatMap((monday) => [
        entry(monday, 'dinner', 'dish', 'stew'),
        entry(`${monday.slice(0, 8)}${String(Number(monday.slice(8)) + 1).padStart(2, '0')}`,
          'dinner', 'dish', 'stew'),
      ]),
      WEEK,
    )
    const stew = proposeWeek(pattern, options({ meals: ['dinner'] })).filter(
      (e) => e.dishId === 'stew',
    )
    expect(stew).toHaveLength(2)
    expect(stew.map((e) => e.kind)).toEqual(['dish', 'leftovers'])
  })

  it('comes back by day, then by the order meals happen', () => {
    const pattern = readWeekPattern(
      ['2026-08-03', '2026-08-10', '2026-08-17'].flatMap((day) => [
        entry(day, 'dinner', 'dish', 'pasta'),
        entry(day, 'lunch', 'dish', 'soup'),
      ]),
      WEEK,
    )
    const week = proposeWeek(pattern, options())
    expect(week.map((e) => `${e.date} ${e.meal}`)).toEqual([
      '2026-09-07 lunch',
      '2026-09-07 dinner',
    ])
  })

  it('proposes a week the size of the weeks this household actually plans', () => {
    // Two meals a week, three weeks running: two cards, not a full fourteen.
    // The budget is what keeps it honest — it never pads.
    const pattern = readWeekPattern(
      ['2026-08-03', '2026-08-10', '2026-08-17'].flatMap((day) => [
        entry(day, 'lunch', 'dish', 'soup'),
        entry(day, 'dinner', 'dish', 'pasta'),
      ]),
      WEEK,
    )
    expect(proposeWeek(pattern, options())).toHaveLength(2)
  })

  it('proposes nothing when the household has no meals', () => {
    const pattern = readWeekPattern(
      ['2026-08-03', '2026-08-10'].map((day) => entry(day, 'dinner', 'dish', 'soup')),
      WEEK,
    )
    expect(proposeWeek(pattern, options({ meals: [] }))).toEqual([])
  })
})
