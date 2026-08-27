import { describe, expect, it } from 'vitest'
import {
  type PlanEntry,
  addDays,
  dateKey,
  dayName,
  daysBetween,
  entriesBetween,
  entriesIn,
  isEntryKind,
  isMeal,
  mealRhythm,
  nextPosition,
  parseKey,
  shortDate,
  shortDayName,
  sortEntries,
  startOfWeek,
  weekDays,
  weekName,
} from './plan'

function entry(overrides: Partial<PlanEntry> = {}): PlanEntry {
  return {
    id: 'e1',
    date: '2026-09-01',
    meal: 'dinner',
    position: 0,
    kind: 'dish',
    dishId: 'lasagne',
    itemId: null,
    note: null,
    createdAt: '2026-08-30T10:00:00.000Z',
    ...overrides,
  }
}

describe('dateKey and parseKey', () => {
  it('round-trips a local date without drifting a day', () => {
    // The bug this guards: new Date('2026-09-01') is UTC midnight, which is the
    // 31st of August in Gothenburg for most of the year.
    const key = '2026-09-01'
    expect(dateKey(parseKey(key))).toBe(key)
  })

  it('pads single-digit months and days', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('falls back to today rather than an Invalid Date', () => {
    const today = dateKey(new Date())
    expect(dateKey(parseKey('nonsense'))).toBe(today)
    expect(dateKey(parseKey(''))).toBe(today)
    expect(dateKey(parseKey('2026-9-1'))).toBe(today)
  })
})

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('crosses a year end', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('knows February 2028 has 29 days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
  })

  it('and that 2026 does not', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('daysBetween', () => {
  it('counts forwards and backwards', () => {
    expect(daysBetween('2026-09-01', '2026-09-04')).toBe(3)
    expect(daysBetween('2026-09-04', '2026-09-01')).toBe(-3)
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0)
  })

  it('survives the clock changes', () => {
    // Europe/Stockholm springs forward on 29 March 2026 and back on 25 October.
    // Those days are 23 and 25 hours long; truncating would make one of them 0.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
  })
})

describe('startOfWeek', () => {
  it('finds the Monday, from any day of the week', () => {
    // 2026-09-01 is a Tuesday.
    expect(startOfWeek('2026-09-01')).toBe('2026-08-31')
    expect(startOfWeek('2026-08-31')).toBe('2026-08-31')
    // Sunday belongs to the week that started six days earlier, not the next one.
    expect(startOfWeek('2026-09-06')).toBe('2026-08-31')
    expect(startOfWeek('2026-09-07')).toBe('2026-09-07')
  })
})

describe('weekDays', () => {
  it('gives seven consecutive days', () => {
    expect(weekDays('2026-08-31')).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ])
  })
})

describe('naming a day', () => {
  it('prefers the three relative words', () => {
    expect(dayName('2026-09-01', '2026-09-01')).toBe('Today')
    expect(dayName('2026-09-02', '2026-09-01')).toBe('Tomorrow')
    expect(dayName('2026-08-31', '2026-09-01')).toBe('Yesterday')
  })

  it('falls back to the weekday further out', () => {
    expect(dayName('2026-09-03', '2026-09-01')).toBe('Thursday')
    expect(dayName('2026-09-06', '2026-09-01')).toBe('Sunday')
  })

  it('has a short form for the week view', () => {
    expect(shortDayName('2026-09-01')).toBe('Tue')
    expect(shortDate('2026-09-01')).toBe('1 Sep')
  })
})

describe('weekName', () => {
  it('names the three weeks you can reach in one tap', () => {
    expect(weekName('2026-08-31', '2026-09-01')).toBe('This week')
    expect(weekName('2026-09-07', '2026-09-01')).toBe('Next week')
    expect(weekName('2026-08-24', '2026-09-01')).toBe('Last week')
  })

  it('gives a date range beyond that, saying the month once when it can', () => {
    expect(weekName('2026-09-14', '2026-09-01')).toBe('14–20 Sep')
    expect(weekName('2026-09-28', '2026-09-01')).toBe('28 Sep – 4 Oct')
  })
})

describe('sortEntries', () => {
  it('orders by day, then by when the meal happens, then by position', () => {
    const entries = [
      entry({ id: 'c', date: '2026-09-02', meal: 'lunch' }),
      entry({ id: 'b', date: '2026-09-01', meal: 'dinner', position: 1 }),
      entry({ id: 'a', date: '2026-09-01', meal: 'dinner', position: 0 }),
      entry({ id: 'z', date: '2026-09-01', meal: 'breakfast' }),
    ]
    expect(sortEntries(entries).map((e) => e.id)).toEqual(['z', 'a', 'b', 'c'])
  })

  it('breaks a tied position on when it was written', () => {
    const entries = [
      entry({ id: 'late', position: 0, createdAt: '2026-08-30T12:00:00.000Z' }),
      entry({ id: 'early', position: 0, createdAt: '2026-08-30T09:00:00.000Z' }),
    ]
    expect(sortEntries(entries).map((e) => e.id)).toEqual(['early', 'late'])
  })

  it('does not mutate what it was given', () => {
    const entries = [entry({ id: 'b', position: 1 }), entry({ id: 'a', position: 0 })]
    sortEntries(entries)
    expect(entries.map((e) => e.id)).toEqual(['b', 'a'])
  })
})

describe('entriesIn and entriesBetween', () => {
  const week = [
    entry({ id: 'mon', date: '2026-08-31' }),
    entry({ id: 'tue-l', date: '2026-09-01', meal: 'lunch' }),
    entry({ id: 'tue-d', date: '2026-09-01', meal: 'dinner' }),
    entry({ id: 'sun', date: '2026-09-06' }),
  ]

  it('picks out one meal on one day', () => {
    expect(entriesIn(week, { date: '2026-09-01', meal: 'dinner' }).map((e) => e.id)).toEqual([
      'tue-d',
    ])
  })

  it('is empty for a meal with nothing in it', () => {
    expect(entriesIn(week, { date: '2026-09-03', meal: 'dinner' })).toEqual([])
  })

  it('takes a range inclusive at both ends', () => {
    expect(entriesBetween(week, '2026-08-31', '2026-09-01').map((e) => e.id)).toEqual([
      'mon',
      'tue-l',
      'tue-d',
    ])
    expect(entriesBetween(week, '2026-09-06', '2026-09-06').map((e) => e.id)).toEqual(['sun'])
  })
})

describe('nextPosition', () => {
  it('lands after everything already in that meal', () => {
    const entries = [entry({ id: 'a', position: 0 }), entry({ id: 'b', position: 3 })]
    expect(nextPosition(entries, { date: '2026-09-01', meal: 'dinner' })).toBe(4)
  })

  it('starts at zero in an empty meal', () => {
    expect(nextPosition([], { date: '2026-09-01', meal: 'lunch' })).toBe(0)
  })

  it('ignores other meals and other days', () => {
    const entries = [
      entry({ id: 'other-meal', meal: 'lunch', position: 9 }),
      entry({ id: 'other-day', date: '2026-09-02', position: 9 }),
    ]
    expect(nextPosition(entries, { date: '2026-09-01', meal: 'dinner' })).toBe(0)
  })
})

describe('mealRhythm', () => {
  it('reads two nights running as one cook and one repeat', () => {
    const rhythm = mealRhythm([
      entry({ id: 'mon', date: '2026-08-31' }),
      entry({ id: 'tue', date: '2026-09-01' }),
    ])
    expect(rhythm.get('mon')).toBe('cook')
    expect(rhythm.get('tue')).toBe('repeat')
  })

  it('reads a week apart as two cooks', () => {
    const rhythm = mealRhythm([
      entry({ id: 'mon', date: '2026-08-31' }),
      entry({ id: 'next-mon', date: '2026-09-07' }),
    ])
    expect(rhythm.get('mon')).toBe('cook')
    expect(rhythm.get('next-mon')).toBe('cook')
  })

  it('carries the rhythm through a third night', () => {
    const rhythm = mealRhythm([
      entry({ id: 'mon', date: '2026-08-31' }),
      entry({ id: 'tue', date: '2026-09-01', kind: 'leftovers' }),
      entry({ id: 'wed', date: '2026-09-02' }),
    ])
    expect([rhythm.get('mon'), rhythm.get('tue'), rhythm.get('wed')]).toEqual([
      'cook',
      'repeat',
      'repeat',
    ])
  })

  it('counts twice in one day as a repeat', () => {
    const rhythm = mealRhythm([
      entry({ id: 'lunch', meal: 'lunch' }),
      entry({ id: 'dinner', meal: 'dinner' }),
    ])
    expect(rhythm.get('lunch')).toBe('cook')
    expect(rhythm.get('dinner')).toBe('repeat')
  })

  it('keeps two different dishes apart', () => {
    const rhythm = mealRhythm([
      entry({ id: 'a', date: '2026-08-31', dishId: 'lasagne' }),
      entry({ id: 'b', date: '2026-09-01', dishId: 'tacos' }),
    ])
    expect(rhythm.get('a')).toBe('cook')
    expect(rhythm.get('b')).toBe('cook')
  })

  it('always calls an explicit leftovers entry a repeat, even with nothing before it', () => {
    const rhythm = mealRhythm([entry({ id: 'x', kind: 'leftovers', dishId: null })])
    expect(rhythm.get('x')).toBe('repeat')
  })

  it('says nothing about plain items or eating out', () => {
    const rhythm = mealRhythm([
      entry({ id: 'brocc', kind: 'item', dishId: null, itemId: 'broccoli' }),
      entry({ id: 'out', kind: 'out', dishId: null }),
    ])
    expect(rhythm.has('brocc')).toBe(false)
    expect(rhythm.has('out')).toBe(false)
  })

  it('works off chronology, not the order it was handed', () => {
    const rhythm = mealRhythm([
      entry({ id: 'tue', date: '2026-09-01' }),
      entry({ id: 'mon', date: '2026-08-31' }),
    ])
    expect(rhythm.get('mon')).toBe('cook')
    expect(rhythm.get('tue')).toBe('repeat')
  })
})

describe('the guards', () => {
  it('recognise the values the database can hold, and nothing else', () => {
    expect(isMeal('dinner')).toBe(true)
    expect(isMeal('brunch')).toBe(false)
    expect(isEntryKind('leftovers')).toBe(true)
    expect(isEntryKind('snack')).toBe(false)
    expect(isEntryKind(null)).toBe(false)
  })
})
