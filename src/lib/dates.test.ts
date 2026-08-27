import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  dateKey,
  dateRange,
  dayName,
  daysBetween,
  daysInMonth,
  isDayKey,
  longDate,
  minutesOfDay,
  monthGrid,
  monthKey,
  monthName,
  monthStart,
  parseKey,
  shortDate,
  shortDayName,
  startOfWeek,
  timeLabel,
  toTime,
  weekDays,
  weekDaysFrom,
} from './dates'

describe('day keys', () => {
  it('formats a local Date without drifting a day', () => {
    // 1 Jan at 23:00 local is still 1 Jan. Going via toISOString would make it
    // the 2nd for anyone east of UTC — the bug this whole module exists to stop.
    expect(dateKey(new Date(2026, 0, 1, 23, 0))).toBe('2026-01-01')
    expect(dateKey(new Date(2026, 8, 3))).toBe('2026-09-03')
  })

  it('round-trips through parseKey', () => {
    for (const key of ['2026-01-01', '2026-02-28', '2026-12-31', '2024-02-29']) {
      expect(dateKey(parseKey(key))).toBe(key)
    }
  })

  it('parses to local midnight, not UTC midnight', () => {
    const date = parseKey('2026-09-03')
    expect(date.getHours()).toBe(0)
    expect(date.getDate()).toBe(3)
    expect(date.getMonth()).toBe(8)
  })

  it('falls back to today rather than an Invalid Date', () => {
    expect(Number.isNaN(parseKey('rubbish').getTime())).toBe(false)
    expect(Number.isNaN(parseKey('').getTime())).toBe(false)
  })

  it('recognises real days and rejects impossible ones', () => {
    expect(isDayKey('2026-09-03')).toBe(true)
    expect(isDayKey('2024-02-29')).toBe(true)
    // Regex-valid, calendar-nonsense. Date rolls it into March.
    expect(isDayKey('2026-02-31')).toBe(false)
    expect(isDayKey('2026-13-01')).toBe(false)
    expect(isDayKey('2026-9-3')).toBe(false)
    expect(isDayKey(20260903)).toBe(false)
  })
})

describe('addDays', () => {
  it('crosses months and years', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('handles the leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('survives the spring clock change', () => {
    // Sweden springs forward on the last Sunday of March. A day built from
    // local parts still lands on the next date; one built from UTC would not.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
  })
})

describe('daysBetween', () => {
  it('counts forwards and backwards', () => {
    expect(daysBetween('2026-09-01', '2026-09-08')).toBe(7)
    expect(daysBetween('2026-09-08', '2026-09-01')).toBe(-7)
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0)
  })

  it('rounds across the 23-hour day rather than truncating it', () => {
    expect(daysBetween('2026-03-28', '2026-03-29')).toBe(1)
    expect(daysBetween('2026-10-24', '2026-10-25')).toBe(1)
  })
})

describe('weeks', () => {
  it('starts on Monday', () => {
    // 2026-09-03 is a Thursday.
    expect(startOfWeek('2026-09-03')).toBe('2026-08-31')
  })

  it('treats Sunday as the end of its week, not the start', () => {
    // 2026-09-06 is a Sunday; its Monday is six days back.
    expect(startOfWeek('2026-09-06')).toBe('2026-08-31')
  })

  it('starts the current week at today and shows other weeks whole', () => {
    // Thursday 3 Sep 2026, in the week beginning Monday 31 Aug.
    expect(weekDaysFrom('2026-08-31', '2026-09-03')).toEqual([
      '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06',
    ])
    // A week you stepped back to keeps all seven.
    expect(weekDaysFrom('2026-08-24', '2026-09-03')).toHaveLength(7)
    // And so does one you stepped forward to.
    expect(weekDaysFrom('2026-09-07', '2026-09-03')).toHaveLength(7)
    // Today being the Monday means nothing is dropped.
    expect(weekDaysFrom('2026-08-31', '2026-08-31')).toHaveLength(7)
    // Today being the Sunday leaves exactly one.
    expect(weekDaysFrom('2026-08-31', '2026-09-06')).toEqual(['2026-09-06'])
  })

  it('gives seven consecutive days', () => {
    expect(weekDays('2026-08-31')).toEqual([
      '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
      '2026-09-04', '2026-09-05', '2026-09-06',
    ])
  })
})

describe('months', () => {
  it('cuts a month key off a day key', () => {
    expect(monthKey('2026-09-03')).toBe('2026-09')
    expect(monthKey('2026-09')).toBe('2026-09')
    expect(monthStart('2026-09')).toBe('2026-09-01')
  })

  it('steps months across a year boundary', () => {
    expect(addMonths('2026-09', 1)).toBe('2026-10')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-09', 12)).toBe('2027-09')
  })

  it('counts the days in a month, leap year included', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2024-02')).toBe(29)
    expect(daysInMonth('2026-09')).toBe(30)
    expect(daysInMonth('2026-12')).toBe(31)
  })
})

describe('monthGrid', () => {
  it('starts on the Monday on or before the 1st', () => {
    // 1 Sep 2026 is a Tuesday, so the grid opens on Monday 31 Aug.
    const grid = monthGrid('2026-09')
    expect(grid[0]).toBe('2026-08-31')
    expect(grid[1]).toBe('2026-09-01')
  })

  it('is always whole weeks', () => {
    for (const month of ['2026-01', '2026-02', '2024-02', '2026-09', '2027-05']) {
      expect(monthGrid(month).length % 7).toBe(0)
    }
  })

  it('runs to the end of the week the month ends in', () => {
    // 30 Sep 2026 is a Wednesday, so the last row runs on to Sunday 4 Oct.
    const grid = monthGrid('2026-09')
    expect(grid[grid.length - 1]).toBe('2026-10-04')
  })

  it('contains every day of the month exactly once', () => {
    const grid = monthGrid('2026-09')
    const inMonth = grid.filter((day) => day.startsWith('2026-09'))
    expect(inMonth.length).toBe(30)
    expect(new Set(inMonth).size).toBe(30)
  })

  it('is consecutive throughout', () => {
    const grid = monthGrid('2026-02')
    for (let i = 1; i < grid.length; i += 1) {
      expect(grid[i]).toBe(addDays(grid[i - 1] as string, 1))
    }
  })

  it('gives a February starting on a Monday exactly four rows', () => {
    // Feb 2027 has 28 days and starts on a Monday — the one month that fits in
    // four rows. A fixed six-row grid would draw two empty weeks here.
    expect(startOfWeek('2027-02-01')).toBe('2027-02-01')
    expect(monthGrid('2027-02').length).toBe(28)
  })

  it('needs six rows for a long month starting late in the week', () => {
    // 31 days starting on a Saturday cannot fit in five weeks.
    expect(monthGrid('2026-08').length).toBe(42)
  })
})

describe('names', () => {
  const today = '2026-09-03'

  it('says today, tomorrow and yesterday', () => {
    expect(dayName('2026-09-03', today)).toBe('Today')
    expect(dayName('2026-09-04', today)).toBe('Tomorrow')
    expect(dayName('2026-09-02', today)).toBe('Yesterday')
  })

  it('falls back to the weekday name', () => {
    expect(dayName('2026-09-07', today)).toBe('Monday')
    expect(shortDayName('2026-09-07')).toBe('Mon')
  })

  it('formats short and long dates', () => {
    expect(shortDate('2026-09-03')).toBe('3 Sep')
    expect(longDate('2026-09-03')).toBe('3 September')
  })

  it('drops the year in the current year and keeps it otherwise', () => {
    expect(monthName('2026-09', today)).toBe('September')
    expect(monthName('2027-09', today)).toBe('September 2027')
    expect(monthName('2025-12', today)).toBe('December 2025')
  })

  it('says a range with the month once when it does not cross one', () => {
    expect(dateRange('2026-09-01', '2026-09-07')).toBe('1–7 Sep')
    expect(dateRange('2026-09-28', '2026-10-04')).toBe('28 Sep – 4 Oct')
    expect(dateRange('2026-09-03', '2026-09-03')).toBe('3 Sep')
  })
})

describe('times', () => {
  it('normalises what Postgres and an input give back', () => {
    expect(toTime('18:30:00')).toBe('18:30')
    expect(toTime('18:30')).toBe('18:30')
    expect(toTime('9:05')).toBe('09:05')
    expect(toTime(' 07:00 ')).toBe('07:00')
  })

  it('is null for anything that is not a time', () => {
    expect(toTime(null)).toBe(null)
    expect(toTime('')).toBe(null)
    expect(toTime('all day')).toBe(null)
    expect(toTime('25:00')).toBe(null)
    expect(toTime('12:75')).toBe(null)
    expect(toTime(1830)).toBe(null)
  })

  it('converts to minutes for sorting', () => {
    expect(minutesOfDay('00:00')).toBe(0)
    expect(minutesOfDay('18:30')).toBe(1110)
    expect(minutesOfDay('23:59')).toBe(1439)
    expect(minutesOfDay(null)).toBe(null)
  })

  it('labels a time and a range', () => {
    expect(timeLabel('18:30:00', null)).toBe('18:30')
    expect(timeLabel('18:30', '20:00')).toBe('18:30 – 20:00')
    expect(timeLabel(null, null)).toBe('')
    // An end with no start cannot be stored, and reads as nothing if it is.
    expect(timeLabel(null, '20:00')).toBe('')
  })
})
