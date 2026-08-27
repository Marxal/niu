import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from './calendar'
import { weekDays } from './dates'
import { layOutGrid, layOutWeek, showsTime } from './grid-layout'

/** Monday 31 Aug 2026 to Sunday 6 Sep. */
const WEEK = weekDays('2026-08-31')

function ev(over: Partial<CalendarEvent> = {}): CalendarEvent {
  const startsOn = over.startsOn ?? '2026-08-31'
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    kind: 'event',
    title: 'Thing',
    startsOn,
    startTime: '09:00',
    endTime: null,
    location: null,
    notes: null,
    colour: 'sky',
    confirmRequested: false,
    doneAt: null,
    doneBy: null,
    createdBy: 'me',
    updatedAt: '2026-01-01T00:00:00Z',
    attendees: [],
    confirmations: [],
    ...over,
    endsOn: over.endsOn ?? startsOn,
  }
}

describe('placing one event in a week', () => {
  it('puts Monday in column 0 and Sunday in column 6', () => {
    expect(layOutWeek(WEEK, [ev({ startsOn: '2026-08-31' })]).segments[0]?.column).toBe(0)
    expect(layOutWeek(WEEK, [ev({ startsOn: '2026-09-06' })]).segments[0]?.column).toBe(6)
  })

  it('gives a single day a span of one', () => {
    const [seg] = layOutWeek(WEEK, [ev({ startsOn: '2026-09-02' })]).segments
    expect(seg?.span).toBe(1)
    expect(seg?.clippedStart).toBe(false)
    expect(seg?.clippedEnd).toBe(false)
  })

  it('spans a multi-day event across the columns it covers', () => {
    // Wednesday to Friday is three columns, as one bar rather than three boxes.
    const [seg] = layOutWeek(WEEK, [ev({ startsOn: '2026-09-02', endsOn: '2026-09-04' })]).segments
    expect(seg?.column).toBe(2)
    expect(seg?.span).toBe(3)
  })

  it('clips an event that began in an earlier week', () => {
    const [seg] = layOutWeek(WEEK, [ev({ startsOn: '2026-08-28', endsOn: '2026-09-01' })]).segments
    expect(seg?.column).toBe(0)
    expect(seg?.span).toBe(2)
    expect(seg?.clippedStart).toBe(true)
    expect(seg?.clippedEnd).toBe(false)
  })

  it('clips an event that runs into the next week', () => {
    const [seg] = layOutWeek(WEEK, [ev({ startsOn: '2026-09-05', endsOn: '2026-09-09' })]).segments
    expect(seg?.column).toBe(5)
    expect(seg?.span).toBe(2)
    expect(seg?.clippedEnd).toBe(true)
  })

  it('clips both ends of an event that swallows the week', () => {
    const [seg] = layOutWeek(WEEK, [ev({ startsOn: '2026-08-01', endsOn: '2026-12-01' })]).segments
    expect(seg?.column).toBe(0)
    expect(seg?.span).toBe(7)
    expect(seg?.clippedStart).toBe(true)
    expect(seg?.clippedEnd).toBe(true)
  })

  it('leaves out an event that misses the week entirely', () => {
    expect(layOutWeek(WEEK, [ev({ startsOn: '2026-10-01' })]).segments).toHaveLength(0)
    expect(layOutWeek(WEEK, [ev({ startsOn: '2026-01-01' })]).segments).toHaveLength(0)
  })
})

describe('lanes', () => {
  it('puts two events on different days on the same lane', () => {
    const layout = layOutWeek(WEEK, [
      ev({ id: 'a', startsOn: '2026-08-31' }),
      ev({ id: 'b', startsOn: '2026-09-03' }),
    ])
    expect(layout.segments.every((s) => s.lane === 0)).toBe(true)
    expect(layout.lanes).toBe(1)
  })

  it('stacks two events on the same day', () => {
    const layout = layOutWeek(WEEK, [
      ev({ id: 'a', startsOn: '2026-09-01', startTime: '09:00' }),
      ev({ id: 'b', startsOn: '2026-09-01', startTime: '11:00' }),
    ])
    expect(layout.lanes).toBe(2)
    expect(new Set(layout.segments.map((s) => s.lane))).toEqual(new Set([0, 1]))
  })

  it('keeps a long bar on one lane the whole way across', () => {
    // The reason longest-first exists: a bar that changes lane mid-week reads
    // as two different events.
    const layout = layOutWeek(WEEK, [
      ev({ id: 'short', startsOn: '2026-09-01' }),
      ev({ id: 'trip', startsOn: '2026-08-31', endsOn: '2026-09-04' }),
    ])
    const trip = layout.segments.find((s) => s.event.id === 'trip')
    const short = layout.segments.find((s) => s.event.id === 'short')
    expect(trip?.lane).toBe(0)
    expect(trip?.span).toBe(5)
    expect(short?.lane).toBe(1)
  })

  it('lets a short event sit beside a bar it does not touch', () => {
    const layout = layOutWeek(WEEK, [
      ev({ id: 'trip', startsOn: '2026-08-31', endsOn: '2026-09-01' }),
      ev({ id: 'later', startsOn: '2026-09-05' }),
    ])
    expect(layout.lanes).toBe(1)
    expect(layout.segments.every((s) => s.lane === 0)).toBe(true)
  })

  it('packs downwards into the first free lane, not the next one', () => {
    const layout = layOutWeek(WEEK, [
      ev({ id: 'mon-a', startsOn: '2026-08-31', startTime: '08:00' }),
      ev({ id: 'mon-b', startsOn: '2026-08-31', startTime: '09:00' }),
      // Friday is free on lane 0 even though two lanes are in use on Monday.
      ev({ id: 'fri', startsOn: '2026-09-04' }),
    ])
    expect(layout.segments.find((s) => s.event.id === 'fri')?.lane).toBe(0)
  })

  it('reports no lanes for an empty week', () => {
    const layout = layOutWeek(WEEK, [])
    expect(layout.lanes).toBe(0)
    expect(layout.segments).toHaveLength(0)
    expect(layout.overflow).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

describe('overflow', () => {
  it('counts what did not fit, per day', () => {
    const layout = layOutWeek(
      WEEK,
      [
        ev({ id: 'a', startsOn: '2026-09-01', startTime: '08:00' }),
        ev({ id: 'b', startsOn: '2026-09-01', startTime: '09:00' }),
        ev({ id: 'c', startsOn: '2026-09-01', startTime: '10:00' }),
        ev({ id: 'd', startsOn: '2026-09-01', startTime: '11:00' }),
        ev({ id: 'e', startsOn: '2026-09-01', startTime: '12:00' }),
      ],
      2,
    )
    expect(layout.segments).toHaveLength(2)
    // Tuesday is column 1. Three did not fit.
    expect(layout.overflow[1]).toBe(3)
    expect(layout.overflow[0]).toBe(0)
  })

  it('counts a dropped multi-day event under every day it covers', () => {
    const layout = layOutWeek(
      WEEK,
      [
        ev({ id: 'a', startsOn: '2026-08-31', endsOn: '2026-09-06', startTime: '08:00' }),
        ev({ id: 'b', startsOn: '2026-08-31', endsOn: '2026-09-06', startTime: '09:00' }),
        ev({ id: 'c', startsOn: '2026-09-01', endsOn: '2026-09-02' }),
      ],
      2,
    )
    expect(layout.overflow[1]).toBe(1)
    expect(layout.overflow[2]).toBe(1)
    expect(layout.overflow[0]).toBe(0)
    expect(layout.overflow[3]).toBe(0)
  })

  it('never lets a lane index reach maxLanes', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      ev({ id: `e${i}`, startsOn: '2026-09-01', startTime: `${`${i + 8}`.padStart(2, '0')}:00` }),
    )
    const layout = layOutWeek(WEEK, many, 3)
    expect(layout.segments.every((s) => s.lane < 3)).toBe(true)
    expect(layout.lanes).toBeLessThanOrEqual(3)
  })
})

describe('the whole grid', () => {
  it('is one layout per week', () => {
    const days = [...weekDays('2026-08-31'), ...weekDays('2026-09-07')]
    expect(layOutGrid(days, [])).toHaveLength(2)
  })

  it('puts a bar that crosses the week boundary in both weeks, clipped', () => {
    const days = [...weekDays('2026-08-31'), ...weekDays('2026-09-07')]
    const trip = ev({ startsOn: '2026-09-04', endsOn: '2026-09-09' })
    const [first, second] = layOutGrid(days, [trip])

    expect(first?.segments[0]?.column).toBe(4)
    expect(first?.segments[0]?.span).toBe(3)
    expect(first?.segments[0]?.clippedEnd).toBe(true)
    expect(first?.segments[0]?.clippedStart).toBe(false)

    expect(second?.segments[0]?.column).toBe(0)
    expect(second?.segments[0]?.span).toBe(3)
    expect(second?.segments[0]?.clippedStart).toBe(true)
    expect(second?.segments[0]?.clippedEnd).toBe(false)
  })
})

describe('what a box can show', () => {
  it('shows a time only on a wide single-day box', () => {
    const wide = layOutWeek(WEEK, [
      ev({ startsOn: '2026-08-31', endsOn: '2026-09-02', startTime: '09:00' }),
    ]).segments[0]
    // Wide, but multi-day: a three-day event has no single time worth showing.
    expect(wide && showsTime(wide)).toBe(false)

    const narrow = layOutWeek(WEEK, [ev({ startsOn: '2026-08-31' })]).segments[0]
    expect(narrow && showsTime(narrow)).toBe(false)

    const allDay = layOutWeek(WEEK, [ev({ startsOn: '2026-08-31', startTime: null })]).segments[0]
    expect(allDay && showsTime(allDay)).toBe(false)
  })
})
