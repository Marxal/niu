import { describe, expect, it } from 'vitest'
import {
  type CalendarEvent,
  type EventDraft,
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  awaitingMe,
  canSave,
  cleanDraft,
  confirmState,
  coversDay,
  draftFrom,
  draftOccurrences,
  draftRule,
  eventDays,
  isRepeating,
  isSeries,
  eventsByDay,
  eventsOn,
  isMultiDay,
  isUnconfirmed,
  needsMyAnswer,
  needsReconfirming,
  newDraft,
  seriesShapeChanged,
  sortEvents,
  spanDays,
  toEventColour,
  upcoming,
} from './calendar'

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

describe('the days an event covers', () => {
  const holiday = event({ startsOn: '2026-09-01', endsOn: '2026-09-07' })

  it('is inclusive at both ends', () => {
    expect(coversDay(holiday, '2026-09-01')).toBe(true)
    expect(coversDay(holiday, '2026-09-07')).toBe(true)
    expect(coversDay(holiday, '2026-08-31')).toBe(false)
    expect(coversDay(holiday, '2026-09-08')).toBe(false)
  })

  it('counts a single day as one, not zero', () => {
    expect(spanDays(event())).toBe(1)
    expect(spanDays(holiday)).toBe(7)
    expect(isMultiDay(event())).toBe(false)
    expect(isMultiDay(holiday)).toBe(true)
  })

  it('lists every day it touches', () => {
    expect(eventDays(holiday)).toHaveLength(7)
    expect(eventDays(holiday)[0]).toBe('2026-09-01')
    expect(eventDays(holiday)[6]).toBe('2026-09-07')
    expect(eventDays(event())).toEqual(['2026-09-03'])
  })

  it('does not run away on a nonsense row', () => {
    const broken = event({ startsOn: '2026-01-01', endsOn: '2099-01-01' })
    expect(eventDays(broken).length).toBeLessThanOrEqual(367)
  })

  it('finds a multi-day event on a day in the middle', () => {
    const found = eventsOn([holiday, event()], '2026-09-04')
    expect(found).toHaveLength(1)
    expect(found[0]?.startsOn).toBe('2026-09-01')
  })
})

describe('eventsByDay', () => {
  it('puts a multi-day event in every bucket it touches', () => {
    const trip = event({ id: 'a', startsOn: '2026-09-01', endsOn: '2026-09-03' })
    const byDay = eventsByDay([trip], '2026-09-01', '2026-09-30')
    expect(byDay.get('2026-09-01')).toHaveLength(1)
    expect(byDay.get('2026-09-02')).toHaveLength(1)
    expect(byDay.get('2026-09-03')).toHaveLength(1)
    expect(byDay.get('2026-09-04')).toBeUndefined()
  })

  it('clips to the window, so a grid never grows cells it has no room for', () => {
    const trip = event({ startsOn: '2026-08-28', endsOn: '2026-09-02' })
    const byDay = eventsByDay([trip], '2026-09-01', '2026-09-30')
    expect([...byDay.keys()].sort()).toEqual(['2026-09-01', '2026-09-02'])
  })

  it('leaves empty days out rather than holding empty arrays', () => {
    expect(eventsByDay([event()], '2026-09-01', '2026-09-30').size).toBe(1)
  })
})

describe('the order a day reads in', () => {
  it('puts all-day things above timed ones', () => {
    const allDay = event({ id: 'a', title: 'Holiday', startTime: null })
    const timed = event({ id: 'b', title: 'Dentist', startTime: '09:00' })
    expect(sortEvents([timed, allDay]).map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('then sorts by the clock', () => {
    const late = event({ id: 'late', startTime: '18:30' })
    const early = event({ id: 'early', startTime: '09:00' })
    const noon = event({ id: 'noon', startTime: '12:00' })
    expect(sortEvents([late, early, noon]).map((e) => e.id)).toEqual([
      'early', 'noon', 'late',
    ])
  })

  it('sinks ticked-off reminders to the bottom whatever their time', () => {
    const done = event({
      id: 'done', kind: 'reminder', startTime: null, doneAt: '2026-09-03T08:00:00Z',
    })
    const todo = event({ id: 'todo', startTime: '23:00' })
    expect(sortEvents([done, todo]).map((e) => e.id)).toEqual(['todo', 'done'])
  })

  it('breaks a dead heat on title, then id, so the order never flickers', () => {
    const b = event({ id: 'b', title: 'Bath' })
    const a = event({ id: 'a', title: 'Bath' })
    expect(sortEvents([b, a]).map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('does not mutate what it was given', () => {
    const list = [event({ id: 'b', startTime: '20:00' }), event({ id: 'a', startTime: '08:00' })]
    sortEvents(list)
    expect(list.map((e) => e.id)).toEqual(['b', 'a'])
  })
})

describe('upcoming', () => {
  it('keeps a multi-day event that started in the past but has not ended', () => {
    const trip = event({ id: 'trip', startsOn: '2026-09-01', endsOn: '2026-09-07' })
    const past = event({ id: 'past', startsOn: '2026-08-01', endsOn: '2026-08-01' })
    expect(upcoming([trip, past], '2026-09-03').map((e) => e.id)).toEqual(['trip'])
  })

  it('leaves out what has been ticked off', () => {
    const done = event({ kind: 'reminder', doneAt: '2026-09-02T10:00:00Z' })
    expect(upcoming([done], '2026-09-01')).toHaveLength(0)
  })

  it('stops at the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      event({ id: `e${i}`, startsOn: `2026-09-${`${i + 1}`.padStart(2, '0')}` }),
    )
    expect(upcoming(many, '2026-09-01', 3)).toHaveLength(3)
  })
})

describe('confirmation', () => {
  it('is settled when nobody was asked', () => {
    expect(confirmState(event())).toBe('settled')
    // The flag without the rows is still nothing to wait for.
    expect(confirmState(event({ confirmRequested: true }))).toBe('settled')
  })

  it('waits while an answer is missing', () => {
    const asked = event({
      confirmRequested: true,
      confirmations: [{ userId: 'wife', answer: null }],
    })
    expect(confirmState(asked)).toBe('waiting')
    expect(isUnconfirmed(asked)).toBe(true)
  })

  it('is confirmed once everyone has said yes', () => {
    const yes = event({
      confirmRequested: true,
      confirmations: [{ userId: 'wife', answer: 'yes' }],
    })
    expect(confirmState(yes)).toBe('confirmed')
    expect(isUnconfirmed(yes)).toBe(false)
  })

  it('lets one no outweigh a missing answer', () => {
    const mixed = event({
      confirmRequested: true,
      confirmations: [
        { userId: 'wife', answer: 'no' },
        { userId: 'kid', answer: null },
      ],
    })
    expect(confirmState(mixed)).toBe('declined')
  })

  it('knows whose turn it is', () => {
    const asked = event({
      confirmRequested: true,
      confirmations: [{ userId: 'wife', answer: null }],
    })
    expect(needsMyAnswer(asked, 'wife')).toBe(true)
    expect(needsMyAnswer(asked, 'marcal')).toBe(false)
    expect(needsMyAnswer(asked, null)).toBe(false)
  })

  it('keeps an unanswered question about the past in the badge', () => {
    const old = event({
      startsOn: '2020-01-01',
      endsOn: '2020-01-01',
      confirmRequested: true,
      confirmations: [{ userId: 'wife', answer: null }],
    })
    expect(awaitingMe([old], 'wife')).toHaveLength(1)
  })

  it('drops out of the badge once answered', () => {
    const answered = event({
      confirmRequested: true,
      confirmations: [{ userId: 'wife', answer: 'yes' }],
    })
    expect(awaitingMe([answered], 'wife')).toHaveLength(0)
  })
})

describe('drafts', () => {
  it('opens an event at midday and a reminder with no time at all', () => {
    // Round 13, after round 12 opened both with no time: an event is timed
    // again now that there is an All-day switch in plain sight above it, and
    // midday to one is the least wrong guess. A reminder is still about a day.
    const event = newDraft('event', '2026-09-03')
    expect(event.startTime).toBe(DEFAULT_START_TIME)
    expect(event.endTime).toBe(DEFAULT_END_TIME)
    expect(DEFAULT_START_TIME).toBe('12:00')
    expect(DEFAULT_END_TIME).toBe('13:00')

    const reminder = newDraft('reminder', '2026-09-03')
    expect(reminder.startTime).toBe(null)
    expect(reminder.endTime).toBe(null)
  })

  it('takes the confirmation switch from the caller, off unless told', () => {
    // The default lives in Settings, and this module has no Svelte in it.
    expect(newDraft('event', '2026-09-03').askConfirm).toBe(false)
    expect(newDraft('event', '2026-09-03', true).askConfirm).toBe(true)
    // An event that has already been sent round opens with the switch on.
    expect(draftFrom(event({ confirmRequested: true })).askConfirm).toBe(true)
    expect(draftFrom(event()).askConfirm).toBe(false)
  })

  it('starts a new draft as a one-off', () => {
    const draft = newDraft('event', '2026-09-03')
    expect(draft.repeat).toBe('none')
    expect(isRepeating(draft)).toBe(false)
    expect(draftRule(draft)).toBe(null)
  })

  it('turns a repeat of one back into a one-off when cleaning', () => {
    const once = cleanDraft({
      ...newDraft('event', '2026-09-03'),
      title: 'Gym',
      repeat: 'weekly',
      repeatCount: 1,
    })
    // clampCount floors at two, because one occurrence is not a series.
    expect(once?.repeatCount).toBe(2)
    expect(draftRule(once as EventDraft)).toBe('weekly')
  })

  it('spots a change to the shape of a run', () => {
    const gym = event({ seriesId: 'abc', seriesIndex: 2, seriesCount: 10, seriesRule: 'weekly' })
    const same = draftFrom(gym)

    // Editing the title of one of ten is not a change to the run.
    expect(seriesShapeChanged(gym, { ...same, title: 'Swimming' })).toBe(false)
    // Twelve instead of ten is.
    expect(seriesShapeChanged(gym, { ...same, repeatCount: 12 })).toBe(true)
    // So is a different rhythm, and so is stopping it repeating at all.
    expect(seriesShapeChanged(gym, { ...same, repeat: 'fortnightly' })).toBe(true)
    expect(seriesShapeChanged(gym, { ...same, repeat: 'none' })).toBe(true)
  })

  it('spots a one-off being turned into a run', () => {
    const dinner = event()
    const same = draftFrom(dinner)
    expect(seriesShapeChanged(dinner, same)).toBe(false)
    // The count moving on a one-off means nothing until a rule is set with it.
    expect(seriesShapeChanged(dinner, { ...same, repeatCount: 4 })).toBe(false)
    expect(seriesShapeChanged(dinner, { ...same, repeat: 'weekly', repeatCount: 4 })).toBe(true)
    expect(draftOccurrences({ ...same, repeat: 'weekly', repeatCount: 4 })).toBe(4)
    expect(draftOccurrences(same)).toBe(1)
  })

  it('reads an existing series back into the draft', () => {
    const gym = event({ seriesId: 'abc', seriesIndex: 2, seriesCount: 10, seriesRule: 'weekly' })
    const draft = draftFrom(gym)
    expect(draft.repeat).toBe('weekly')
    expect(draft.repeatCount).toBe(10)
    expect(isSeries(gym)).toBe(true)
    expect(isSeries(event())).toBe(false)
  })

  it('round-trips an event', () => {
    const original = event({
      title: 'Dentist', location: 'Vasagatan', notes: 'bring the card',
      attendees: ['wife'], colour: 'moss',
    })
    const draft = draftFrom(original)
    expect(draft.title).toBe('Dentist')
    expect(draft.location).toBe('Vasagatan')
    expect(draft.attendees).toEqual(['wife'])
    expect(draft.colour).toBe('moss')
  })

  it('copies the attendee list rather than aliasing it', () => {
    const original = event({ attendees: ['wife'] })
    draftFrom(original).attendees.push('kid')
    expect(original.attendees).toEqual(['wife'])
  })

  it('refuses to save without a title', () => {
    const blank: EventDraft = { ...newDraft('event', '2026-09-03'), title: '   ' }
    expect(canSave(blank)).toBe(false)
    expect(cleanDraft(blank)).toBe(null)
  })

  it('trims what it keeps', () => {
    const draft: EventDraft = {
      ...newDraft('event', '2026-09-03'),
      title: '  Dinner  ', location: '  Home ', notes: ' bring wine ',
    }
    const clean = cleanDraft(draft)
    expect(clean?.title).toBe('Dinner')
    expect(clean?.location).toBe('Home')
    expect(clean?.notes).toBe('bring wine')
  })

  it('pulls an end day back before the start up to the start', () => {
    const draft: EventDraft = {
      ...newDraft('event', '2026-09-03'), title: 'x', endsOn: '2026-09-01',
    }
    expect(cleanDraft(draft)?.endsOn).toBe('2026-09-03')
  })

  it('drops an end time that is not after the start on the same day', () => {
    const draft: EventDraft = {
      ...newDraft('event', '2026-09-03'), title: 'x',
      startTime: '18:00', endTime: '17:00',
    }
    expect(cleanDraft(draft)?.endTime).toBe(null)
  })

  it('keeps an end time that is earlier in the day on a later day', () => {
    // An overnight trip really does end at 09:00 on a morning after a 20:00 start.
    const draft: EventDraft = {
      ...newDraft('event', '2026-09-03'), title: 'x',
      endsOn: '2026-09-04', startTime: '20:00', endTime: '09:00',
    }
    expect(cleanDraft(draft)?.endTime).toBe('09:00')
  })

  it('drops an end time when there is no start time', () => {
    const draft: EventDraft = {
      ...newDraft('event', '2026-09-03'), title: 'x',
      startTime: null, endTime: '20:00',
    }
    expect(cleanDraft(draft)?.endTime).toBe(null)
  })

  it('normalises times coming back from the database', () => {
    const draft: EventDraft = {
      ...newDraft('event', '2026-09-03'), title: 'x',
      startTime: '18:30:00', endTime: '20:00:00',
    }
    const clean = cleanDraft(draft)
    expect(clean?.startTime).toBe('18:30')
    expect(clean?.endTime).toBe('20:00')
  })

  it('dedupes attendees', () => {
    const draft: EventDraft = {
      ...newDraft('event', '2026-09-03'), title: 'x', attendees: ['a', 'a', 'b'],
    }
    expect(cleanDraft(draft)?.attendees).toEqual(['a', 'b'])
  })

  it('falls back to the default colour for something unknown', () => {
    expect(toEventColour('sky')).toBe('sky')
    expect(toEventColour('neon')).toBe('sky')
    expect(toEventColour(null)).toBe('sky')
  })
})

describe('needsReconfirming', () => {
  const before: EventDraft = { ...newDraft('event', '2026-09-03'), startTime: '18:00' }

  it('is true when the day, the time or the place moves', () => {
    expect(needsReconfirming(before, { ...before, startsOn: '2026-09-05' })).toBe(true)
    expect(needsReconfirming(before, { ...before, endsOn: '2026-09-05' })).toBe(true)
    expect(needsReconfirming(before, { ...before, startTime: '20:00' })).toBe(true)
    expect(needsReconfirming(before, { ...before, location: 'Kitchen' })).toBe(true)
    expect(needsReconfirming(before, { ...before, startTime: null })).toBe(true)
  })

  it('is false for a typo, a note or a colour', () => {
    expect(needsReconfirming(before, { ...before, title: 'Dinner!' })).toBe(false)
    expect(needsReconfirming(before, { ...before, notes: 'bring wine' })).toBe(false)
    expect(needsReconfirming(before, { ...before, colour: 'moss' })).toBe(false)
    expect(needsReconfirming(before, { ...before, attendees: ['wife'] })).toBe(false)
  })

  it('ignores whitespace in the place', () => {
    expect(needsReconfirming(before, { ...before, location: '   ' })).toBe(false)
  })
})
