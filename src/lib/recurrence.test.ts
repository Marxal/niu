import { describe, expect, it } from 'vitest'
import { type EventDraft, newDraft } from './calendar'
import {
  DEFAULT_REPEAT_COUNT,
  MAX_OCCURRENCES,
  MIN_REPEAT_COUNT,
  applyChange,
  clampCount,
  draftChanges,
  isNoChange,
  isRepeatKind,
  isSeriesRule,
  lastOccurrence,
  occurrenceDays,
} from './recurrence'

function draft(over: Partial<EventDraft> = {}): EventDraft {
  return { ...newDraft('event', '2026-09-06'), title: 'Gym', ...over }
}

describe('the rule', () => {
  it('knows its own kinds', () => {
    expect(isRepeatKind('weekly')).toBe(true)
    expect(isRepeatKind('none')).toBe(true)
    expect(isRepeatKind('yearly')).toBe(false)
    // A one-off is a repeat kind but never a stored rule.
    expect(isSeriesRule('none')).toBe(false)
    expect(isSeriesRule('weekly')).toBe(true)
    expect(isSeriesRule(null)).toBe(false)
  })

  it('clamps a count into what a series may be', () => {
    expect(clampCount(10)).toBe(10)
    expect(clampCount(1)).toBe(MIN_REPEAT_COUNT)
    expect(clampCount(0)).toBe(MIN_REPEAT_COUNT)
    expect(clampCount(-4)).toBe(MIN_REPEAT_COUNT)
    expect(clampCount(9999)).toBe(MAX_OCCURRENCES)
    expect(clampCount(3.4)).toBe(3)
    // A field that got emptied hands back NaN; a default beats a crash.
    expect(clampCount(Number.NaN)).toBe(DEFAULT_REPEAT_COUNT)
  })
})

describe('the days a series lands on', () => {
  // 6 September 2026 is a Sunday — Marçal's gym day.
  it('writes ten Sundays, first one included', () => {
    const days = occurrenceDays('2026-09-06', 'weekly', 10)
    expect(days).toHaveLength(10)
    expect(days[0]).toBe('2026-09-06')
    expect(days[1]).toBe('2026-09-13')
    expect(days[9]).toBe('2026-11-08')
  })

  it('handles daily and fortnightly', () => {
    expect(occurrenceDays('2026-09-06', 'daily', 3)).toEqual([
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
    ])
    expect(occurrenceDays('2026-09-06', 'fortnightly', 3)).toEqual([
      '2026-09-06',
      '2026-09-20',
      '2026-10-04',
    ])
  })

  it('crosses a month and a year without help', () => {
    const days = occurrenceDays('2026-12-27', 'weekly', 3)
    expect(days).toEqual(['2026-12-27', '2027-01-03', '2027-01-10'])
  })

  it('is a single day for a one-off, whatever the count says', () => {
    expect(occurrenceDays('2026-09-06', 'none', 10)).toEqual(['2026-09-06'])
  })

  it('never writes more than the ceiling', () => {
    expect(occurrenceDays('2026-09-06', 'daily', 500)).toHaveLength(MAX_OCCURRENCES)
  })

  describe('monthly, which is the one with a decision in it', () => {
    it('keeps the same date', () => {
      expect(occurrenceDays('2026-01-15', 'monthly', 3)).toEqual([
        '2026-01-15',
        '2026-02-15',
        '2026-03-15',
      ])
    })

    it('clamps to the last day rather than skipping the month', () => {
      // Google's RRULE would drop February entirely. A rent reminder set on the
      // 31st should still turn up in February.
      expect(occurrenceDays('2026-01-31', 'monthly', 3)).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
      ])
    })

    it('measures every step from the original date, not the clamped one', () => {
      // The March one is the 31st again — if each month were computed from the
      // month before, February's 28th would drag the rest of the year with it.
      const days = occurrenceDays('2026-01-31', 'monthly', 4)
      expect(days[3]).toBe('2026-04-30')
    })

    it('finds the 29th of February in a leap year', () => {
      expect(occurrenceDays('2028-01-29', 'monthly', 2)).toEqual(['2028-01-29', '2028-02-29'])
    })
  })

  it('reports the last day a series reaches', () => {
    expect(lastOccurrence('2026-09-06', 'weekly', 10)).toBe('2026-11-08')
    expect(lastOccurrence('2026-09-06', 'none', 10)).toBe('2026-09-06')
  })
})

describe('what an edit changed', () => {
  const before = draft({ startTime: '18:00', endTime: '19:00' })

  it('sees nothing when nothing moved', () => {
    expect(draftChanges(before, { ...before })).toEqual(new Set())
    expect(isNoChange(before, { ...before })).toBe(true)
  })

  it('names each field it finds', () => {
    expect(draftChanges(before, { ...before, title: 'Swimming' })).toEqual(new Set(['title']))
    expect(draftChanges(before, { ...before, startTime: '19:00' })).toEqual(
      new Set(['startTime']),
    )
    expect(draftChanges(before, { ...before, colour: 'moss' })).toEqual(new Set(['colour']))
    expect(draftChanges(before, { ...before, notes: 'bring a towel' })).toEqual(
      new Set(['notes']),
    )
  })

  it('ignores whitespace on the text fields', () => {
    expect(isNoChange(before, { ...before, title: '  Gym  ' })).toBe(true)
    expect(isNoChange(before, { ...before, location: '   ' })).toBe(true)
  })

  it('treats attendees as a set, not a list', () => {
    const withTwo = { ...before, attendees: ['a', 'b'] }
    expect(isNoChange(withTwo, { ...withTwo, attendees: ['b', 'a'] })).toBe(true)
    expect(draftChanges(withTwo, { ...withTwo, attendees: ['a'] })).toEqual(
      new Set(['attendees']),
    )
  })

  it('tells a moved day apart from a lengthened one', () => {
    expect(draftChanges(before, { ...before, startsOn: '2026-09-07', endsOn: '2026-09-07' }))
      .toEqual(new Set(['day']))
    expect(draftChanges(before, { ...before, endsOn: '2026-09-08' })).toEqual(new Set(['span']))
  })
})

describe('applying one occurrence’s edit to the rest', () => {
  /** The third of ten Sunday gym sessions, and one of the others. */
  const third = draft({ startsOn: '2026-09-20', endsOn: '2026-09-20', startTime: '18:00' })
  const seventh = draft({ startsOn: '2026-10-18', endsOn: '2026-10-18', startTime: '18:00' })

  it('copies a new time to every occurrence, leaving their days alone', () => {
    const after = { ...third, startTime: '19:30' }
    const result = applyChange(seventh, third, after)
    expect(result.startTime).toBe('19:30')
    expect(result.startsOn).toBe('2026-10-18')
  })

  it('copies a title, a colour and a place', () => {
    const after = { ...third, title: 'Swimming', colour: 'moss' as const, location: 'Valhalla' }
    const result = applyChange(seventh, third, after)
    expect(result.title).toBe('Swimming')
    expect(result.colour).toBe('moss')
    expect(result.location).toBe('Valhalla')
  })

  it('shifts the day rather than copying it', () => {
    // Sunday to Monday on one session moves the whole term on by a day, which
    // keeps it weekly. Copying the date would land all ten on the 21st.
    const after = { ...third, startsOn: '2026-09-21', endsOn: '2026-09-21' }
    const result = applyChange(seventh, third, after)
    expect(result.startsOn).toBe('2026-10-19')
    expect(result.endsOn).toBe('2026-10-19')
  })

  it('leaves alone whatever the edit did not touch', () => {
    // The seventh was moved to a Saturday and given a note at some point. An
    // edit to the third's *time* must not drag either of those back.
    const odd = { ...seventh, startsOn: '2026-10-17', endsOn: '2026-10-17', notes: 'away' }
    const after = { ...third, startTime: '20:00' }
    const result = applyChange(odd, third, after)
    expect(result.startsOn).toBe('2026-10-17')
    expect(result.notes).toBe('away')
    expect(result.startTime).toBe('20:00')
  })

  it('gives every occurrence the new length, measured from its own start', () => {
    const after = { ...third, endsOn: '2026-09-22' }
    const result = applyChange(seventh, third, after)
    expect(result.startsOn).toBe('2026-10-18')
    expect(result.endsOn).toBe('2026-10-20')
  })

  it('keeps each occurrence’s own length when the length did not change', () => {
    const twoDays = { ...seventh, endsOn: '2026-10-19' }
    const after = { ...third, title: 'Swimming' }
    expect(applyChange(twoDays, third, after).endsOn).toBe('2026-10-19')
  })

  it('drops the time from all of them when it is taken off one', () => {
    const after = { ...third, startTime: null, endTime: null }
    const result = applyChange(seventh, third, after)
    expect(result.startTime).toBe(null)
    expect(result.endTime).toBe(null)
  })

  it('changes nothing at all when the edit changed nothing', () => {
    const result = applyChange(seventh, third, { ...third })
    expect(result).toEqual(seventh)
  })
})
