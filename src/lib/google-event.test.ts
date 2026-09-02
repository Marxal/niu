import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from './calendar'
import {
  type SyncRow,
  GOOGLE_SCOPE,
  googleDescription,
  googleEventId,
  googleSummary,
  pendingCount,
  syncPlan,
  toGoogleEvent,
} from './google-event'

const TZ = 'Europe/Stockholm'

function event(over: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    kind: 'event',
    title: 'Dinner',
    startsOn: '2026-09-03',
    endsOn: '2026-09-03',
    startTime: '18:30',
    endTime: null,
    location: null,
    notes: null,
    colour: 'sky',
    confirmRequested: false,
    remindOffset: null,
    doneAt: null,
    doneBy: null,
    createdBy: 'marcal',
    updatedAt: '2026-09-01T10:00:00Z',
    attendees: [],
    confirmations: [],
    seriesId: null,
    seriesIndex: 0,
    seriesCount: 1,
    seriesRule: null,
    ...over,
  }
}

describe('the scope', () => {
  it('is the one that cannot read other calendars', () => {
    // Pinned deliberately. Widening this to .../auth/calendar would silently
    // hand Niu read access to every work meeting on both accounts, which §4.3
    // promises it will never have. Changing this line is a product decision.
    expect(GOOGLE_SCOPE).toBe('https://www.googleapis.com/auth/calendar.app.created')
  })
})

describe('googleEventId', () => {
  it('is derived from our uuid, so a retry updates instead of duplicating', () => {
    expect(googleEventId('11111111-1111-4111-8111-111111111111')).toBe(
      'niu11111111111141118111111111111111',
    )
  })

  it('is stable', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    expect(googleEventId(id)).toBe(googleEventId(id))
  })

  it('only uses characters Google allows in an id', () => {
    const id = googleEventId('3f2504e0-4f89-41d3-9a0c-0305e82c3301') ?? ''
    // base32hex: lowercase a–v and digits. Length must be 5–1024.
    expect(id).toMatch(/^[0-9a-v]+$/)
    expect(id.length).toBeGreaterThanOrEqual(5)
    expect(id.length).toBeLessThanOrEqual(1024)
  })

  it('uppercases down rather than sending an id Google would reject', () => {
    expect(googleEventId('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe(
      'niu3f2504e04f8941d39a0c0305e82c3301',
    )
  })

  it('refuses anything that is not a uuid', () => {
    expect(googleEventId('not-a-uuid')).toBe(null)
    expect(googleEventId('')).toBe(null)
    expect(googleEventId('11111111-1111-4111-8111-11111111111')).toBe(null)
  })
})

describe('an all-day event', () => {
  it('sends an exclusive end date, one past ours', () => {
    // The single most important line in this file. A holiday from the 1st to
    // the 7th is seven days; Google's end is exclusive, so it must read the 8th.
    const holiday = event({
      title: 'Holiday', startsOn: '2026-09-01', endsOn: '2026-09-07', startTime: null,
    })
    const body = toGoogleEvent(holiday, TZ)
    expect(body.start).toEqual({ date: '2026-09-01' })
    expect(body.end).toEqual({ date: '2026-09-08' })
  })

  it('is one day long when it starts and ends on the same day', () => {
    const day = event({ startTime: null })
    const body = toGoogleEvent(day, TZ)
    expect(body.start).toEqual({ date: '2026-09-03' })
    expect(body.end).toEqual({ date: '2026-09-04' })
  })

  it('carries no time zone, because a date has none', () => {
    const body = toGoogleEvent(event({ startTime: null }), TZ)
    expect(body.start.timeZone).toBeUndefined()
    expect(body.start.dateTime).toBeUndefined()
  })
})

describe('a timed event', () => {
  it('sends wall-clock time with the zone beside it, never UTC', () => {
    const body = toGoogleEvent(event({ startTime: '18:30', endTime: '20:00' }), TZ)
    expect(body.start).toEqual({ dateTime: '2026-09-03T18:30:00', timeZone: TZ })
    expect(body.end).toEqual({ dateTime: '2026-09-03T20:00:00', timeZone: TZ })
  })

  it('gives an hour to an event with no end time', () => {
    const body = toGoogleEvent(event({ startTime: '18:30', endTime: null }), TZ)
    expect(body.end.dateTime).toBe('2026-09-03T19:30:00')
  })

  it('rolls the day when that hour crosses midnight', () => {
    // 23:30 + an hour is 00:30 tomorrow. Sending 00:30 today would be an end
    // before its start, which Google rejects outright.
    const body = toGoogleEvent(event({ startTime: '23:30', endTime: null }), TZ)
    expect(body.end.dateTime).toBe('2026-09-04T00:30:00')
  })

  it('keeps the end an overnight event was given', () => {
    const body = toGoogleEvent(
      event({ startsOn: '2026-09-03', endsOn: '2026-09-04', startTime: '20:00', endTime: '09:00' }),
      TZ,
    )
    expect(body.start.dateTime).toBe('2026-09-03T20:00:00')
    expect(body.end.dateTime).toBe('2026-09-04T09:00:00')
  })
})

describe('a reminder', () => {
  it('lands at 09:00 when it has no time of its own', () => {
    // Google counts a reminder in minutes *before* an event and will not take a
    // negative number, so an all-day reminder could otherwise only buzz at
    // midnight or the day before. Sending it as a short 09:00 slot is what
    // makes "Tuesday, renew the permit" arrive on Tuesday morning.
    const body = toGoogleEvent(event({ kind: 'reminder', startTime: null }), TZ)
    expect(body.start.dateTime).toBe('2026-09-03T09:00:00')
    expect(body.end.dateTime).toBe('2026-09-03T09:15:00')
    expect(body.reminders).toEqual({
      useDefault: false, overrides: [{ method: 'popup', minutes: 0 }],
    })
  })

  it('buzzes ten minutes before one that has a time', () => {
    const body = toGoogleEvent(event({ kind: 'reminder', startTime: '14:00' }), TZ)
    expect(body.start.dateTime).toBe('2026-09-03T14:00:00')
    expect(body.reminders).toEqual({
      useDefault: false, overrides: [{ method: 'popup', minutes: 10 }],
    })
  })

  it('stops buzzing once it is ticked off, but stays on the calendar', () => {
    const done = event({
      kind: 'reminder', startTime: null, doneAt: '2026-09-02T08:00:00Z',
    })
    const body = toGoogleEvent(done, TZ)
    expect(body.reminders).toEqual({ useDefault: false, overrides: [] })
    expect(body.summary).toBe('✓ Dinner')
  })

  it('never blocks time, unlike an event', () => {
    expect(toGoogleEvent(event({ kind: 'reminder' }), TZ).transparency).toBe('transparent')
    expect(toGoogleEvent(event(), TZ).transparency).toBe('opaque')
  })

  it('wears a mark in the title so it reads as one in the notification shade', () => {
    expect(googleSummary(event({ kind: 'reminder', title: 'Parking' }))).toBe('⏰ Parking')
    expect(googleSummary(event({ title: 'Dinner' }))).toBe('Dinner')
  })

  it('uses the calendar defaults for an ordinary event', () => {
    expect(toGoogleEvent(event(), TZ).reminders).toEqual({ useDefault: true })
  })
})

describe('the rest of the body', () => {
  it('marks an unanswered event tentative so Google draws it differently too', () => {
    const waiting = event({
      confirmRequested: true, confirmations: [{ userId: 'wife', answer: null }],
    })
    expect(toGoogleEvent(waiting, TZ).status).toBe('tentative')
  })

  it('goes back to confirmed once everyone says yes', () => {
    const yes = event({
      confirmRequested: true, confirmations: [{ userId: 'wife', answer: 'yes' }],
    })
    expect(toGoogleEvent(yes, TZ).status).toBe('confirmed')
  })

  it('is confirmed when nobody was asked', () => {
    expect(toGoogleEvent(event(), TZ).status).toBe('confirmed')
  })

  it('always says where it came from, notes or no notes', () => {
    expect(googleDescription(event())).toBe('— added in Niu')
    expect(googleDescription(event({ notes: 'bring wine' }))).toBe(
      'bring wine\n\n— added in Niu',
    )
  })

  it('leaves location off entirely when there is none', () => {
    expect(toGoogleEvent(event(), TZ).location).toBeUndefined()
    expect(toGoogleEvent(event({ location: 'Home' }), TZ).location).toBe('Home')
  })

  it('carries the colour over as one of Google\'s own colorIds', () => {
    expect(toGoogleEvent(event({ colour: 'sky' }), TZ).colorId).toBe('7')
    expect(toGoogleEvent(event({ colour: 'rose' }), TZ).colorId).toBe('4')
  })

  it('gives every one of the six on-offer colours its own colorId', () => {
    const ids = new Set(
      (['clay', 'amber', 'moss', 'sky', 'plum', 'rose'] as const).map(
        (colour) => toGoogleEvent(event({ colour }), TZ).colorId,
      ),
    )
    expect(ids.size).toBe(6)
  })
})

describe('the sync queue', () => {
  const a = event({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', updatedAt: '2026-09-01T10:00:00Z' })
  const b = event({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', updatedAt: '2026-09-02T10:00:00Z' })

  it('queues everything the first time', () => {
    const plan = syncPlan([a, b], [], [])
    expect(plan.push.map((e) => e.id)).toEqual([a.id, b.id])
    expect(pendingCount(plan)).toBe(2)
  })

  it('leaves alone what has already gone over unchanged', () => {
    const synced: SyncRow[] = [{ eventId: a.id, pushedAt: a.updatedAt, removedAt: null }]
    expect(syncPlan([a, b], [], synced).push.map((e) => e.id)).toEqual([b.id])
  })

  it('re-queues an event that has been edited since', () => {
    const synced: SyncRow[] = [
      { eventId: a.id, pushedAt: '2026-08-01T10:00:00Z', removedAt: null },
    ]
    expect(syncPlan([a], [], synced).push).toHaveLength(1)
  })

  it('sends the oldest change first, so a backlog drains in order', () => {
    const plan = syncPlan([b, a], [], [])
    expect(plan.push.map((e) => e.id)).toEqual([a.id, b.id])
  })

  it('stops at the limit rather than firing a hundred requests on mobile data', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      event({ id: `${`${i}`.padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa` }),
    )
    expect(syncPlan(many, [], [], 25).push).toHaveLength(25)
  })

  it('deletes a tombstoned event that Google actually has', () => {
    const synced: SyncRow[] = [{ eventId: a.id, pushedAt: a.updatedAt, removedAt: null }]
    const plan = syncPlan([], [a.id], synced)
    expect(plan.remove).toEqual([{ eventId: a.id, googleId: googleEventId(a.id) }])
  })

  it('does not ask Google to delete something it was never told about', () => {
    expect(syncPlan([], [a.id], []).remove).toHaveLength(0)
    const never: SyncRow[] = [{ eventId: a.id, pushedAt: null, removedAt: null }]
    expect(syncPlan([], [a.id], never).remove).toHaveLength(0)
  })

  it('does not delete twice', () => {
    const gone: SyncRow[] = [
      { eventId: a.id, pushedAt: a.updatedAt, removedAt: '2026-09-05T10:00:00Z' },
    ]
    expect(syncPlan([], [a.id], gone).remove).toHaveLength(0)
  })

  it('skips a tombstone whose id could never have made a Google id', () => {
    const synced: SyncRow[] = [{ eventId: 'junk', pushedAt: 'x', removedAt: null }]
    expect(syncPlan([], ['junk'], synced).remove).toHaveLength(0)
  })

  it('counts both halves of the work', () => {
    const synced: SyncRow[] = [{ eventId: a.id, pushedAt: a.updatedAt, removedAt: null }]
    expect(pendingCount(syncPlan([b], [a.id], synced))).toBe(2)
  })
})
