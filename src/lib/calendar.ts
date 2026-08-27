/*
 * What an event is, and every calculation the calendar screen does to a pile of
 * them. Pure — no Svelte, no Supabase, no DOM — and therefore tested.
 *
 * ## One type, two things
 *
 * `kind` is 'event' or 'reminder'. An event is the ordinary thing: a title, a
 * day, usually a time, sometimes people. A reminder is the faster thing Marçal
 * asked for in round 11 — "Tuesday, remember to renew the parking permit" —
 * which is the same row with fewer fields filled in and one extra ability: it
 * can be ticked off.
 *
 * They share a type because everything that happens to them is shared. The
 * month grid draws both, the day list sorts both together (a reminder at 09:00
 * belongs above a dentist at 11:00, not in a separate column), and the Google
 * push writes both. Only the sheet and the tick treat them differently.
 *
 * ## Confirmation
 *
 * §4.3 never asked for this; Marçal did, in round 11, and it is the feature the
 * calendar is really for: *"an option to send for confirmation that sends a
 * notification to the other user"*. An event is in one of three states —
 *
 *   settled    nobody was asked. The normal case, and it draws normally.
 *   waiting    somebody was asked and hasn't answered. Draws dashed.
 *   declined   somebody answered no. Draws struck through.
 *
 * — and the important design decision is that **waiting is not hidden**. The
 * event is on the calendar the moment it is written; the mark says the other
 * person hasn't seen it yet. An event that only appeared once confirmed would
 * be an event you cannot talk about.
 *
 * ## Multi-day
 *
 * `startsOn`/`endsOn` are inclusive, so a holiday from the 1st to the 7th holds
 * the 7th. Every function here that asks "is this event on this day" is a range
 * test rather than an equality test, which is the whole reason they are
 * functions and not one-liners at the call sites.
 */

import { addDays, daysBetween, minutesOfDay, toTime } from './dates'
import { isTagColour, type TagColour } from './dish-tags'

export type EventKind = 'event' | 'reminder'

export const EVENT_KINDS: readonly EventKind[] = ['event', 'reminder']

export function isEventKind(value: unknown): value is EventKind {
  return EVENT_KINDS.includes(value as EventKind)
}

/** How an event's confirmation is going. See the header. */
export type ConfirmState = 'settled' | 'waiting' | 'declined' | 'confirmed'

/** One person's answer to "can you make this?". Null means they haven't. */
export interface Confirmation {
  userId: string
  answer: 'yes' | 'no' | null
}

export interface CalendarEvent {
  id: string
  kind: EventKind
  title: string
  /** ISO `YYYY-MM-DD`. */
  startsOn: string
  /** ISO `YYYY-MM-DD`, **inclusive**. Equal to startsOn for a single day. */
  endsOn: string
  /** `HH:MM`, or null — which is what "all day" means. */
  startTime: string | null
  /** `HH:MM`, or null. Never set without a startTime; the database refuses it. */
  endTime: string | null
  location: string | null
  notes: string | null
  colour: TagColour
  /** Whether anyone was ever asked to confirm this. */
  confirmRequested: boolean
  /** Reminders only: when it was ticked off, and by whom. */
  doneAt: string | null
  doneBy: string | null
  createdBy: string
  updatedAt: string
  /** Household member ids marked as going. Empty means everyone (§4.3). */
  attendees: string[]
  /** One row per person who was asked. Empty until somebody asks. */
  confirmations: Confirmation[]
}

/**
 * The six an event can be painted, out of the eight in dish-tags.ts.
 *
 * Six rather than eight because they live on one line in the sheet now (Marçal,
 * round 11.1), and because two of the eight were pulling their weight in the
 * dish library and not here: sage sits too close to moss to be told apart in a
 * 7px box in a month grid, and stone is the colour of something with no colour,
 * which is not a category anyone chooses on purpose.
 *
 * The tokens are untouched — a dish tag still has all eight. This is a shorter
 * menu over the same palette, not a different palette.
 */
export const EVENT_COLOURS: readonly TagColour[] = [
  'clay',
  'amber',
  'moss',
  'sky',
  'plum',
  'rose',
]

/** The colour an event gets when nobody has chosen one. */
export const DEFAULT_EVENT_COLOUR: TagColour = 'sky'

export function toEventColour(value: unknown): TagColour {
  return isTagColour(value) ? value : DEFAULT_EVENT_COLOUR
}

/* -------------------------------------------------------------------------- */
/* Days an event covers                                                        */
/* -------------------------------------------------------------------------- */

/** Whether an event covers a given day. Inclusive at both ends. */
export function coversDay(event: CalendarEvent, day: string): boolean {
  return event.startsOn <= day && day <= event.endsOn
}

/** How many days an event spans. One for an ordinary event. */
export function spanDays(event: CalendarEvent): number {
  return daysBetween(event.startsOn, event.endsOn) + 1
}

export function isMultiDay(event: CalendarEvent): boolean {
  return event.endsOn > event.startsOn
}

/** Every day key an event touches. Used to bucket a month's worth at once. */
export function eventDays(event: CalendarEvent): string[] {
  const out: string[] = []
  for (let day = event.startsOn; day <= event.endsOn; day = addDays(day, 1)) {
    out.push(day)
    // A row with a wild endsOn should not hang the phone. Nothing in the UI
    // can produce this; a hand-edited row could.
    if (out.length > 366) break
  }
  return out
}

/** Everything happening on one day, in the order it should be drawn. */
export function eventsOn(events: readonly CalendarEvent[], day: string): CalendarEvent[] {
  return sortEvents(events.filter((event) => coversDay(event, day)))
}

/**
 * Every day in a range that has something on it, as a map from day key to the
 * events touching it.
 *
 * Built in one pass rather than by filtering the list once per cell: a month
 * grid is up to 42 cells, and 42 passes over the month's events is the kind of
 * thing that is fine until a household has a busy September.
 */
export function eventsByDay(
  events: readonly CalendarEvent[],
  from: string,
  to: string,
): Map<string, CalendarEvent[]> {
  const out = new Map<string, CalendarEvent[]>()
  for (const event of sortEvents(events)) {
    for (const day of eventDays(event)) {
      if (day < from || day > to) continue
      const bucket = out.get(day)
      if (bucket) bucket.push(event)
      else out.set(day, [event])
    }
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Order                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The order a day reads in: all-day things first, then by start time, then by
 * title.
 *
 * All-day first because a bank holiday or a trip is the *context* for the rest
 * of the day, and it has no time to sort it by anyway. After that it is simply
 * the clock, which is the only order a day has.
 *
 * Ticked-off reminders sink to the bottom regardless. They are done; they are
 * kept visible so you can see the permit *was* renewed, but they stop competing
 * with what still has to happen.
 */
export function sortEvents(events: readonly CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const doneA = a.doneAt === null ? 0 : 1
    const doneB = b.doneAt === null ? 0 : 1
    if (doneA !== doneB) return doneA - doneB

    if (a.startsOn !== b.startsOn) return a.startsOn.localeCompare(b.startsOn)

    const minsA = minutesOfDay(a.startTime)
    const minsB = minutesOfDay(b.startTime)
    if (minsA === null && minsB !== null) return -1
    if (minsA !== null && minsB === null) return 1
    if (minsA !== null && minsB !== null && minsA !== minsB) return minsA - minsB

    return a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
  })
}

/**
 * The next few days that have anything on them, from `today` forward.
 *
 * This is what the screen falls back to when you land on a month with an empty
 * selected day: "nothing on Tuesday" is a worse answer than "nothing on
 * Tuesday, and here is what is coming".
 */
export function upcoming(
  events: readonly CalendarEvent[],
  today: string,
  limit = 5,
): CalendarEvent[] {
  return sortEvents(events.filter((e) => e.endsOn >= today && e.doneAt === null)).slice(0, limit)
}

/* -------------------------------------------------------------------------- */
/* Confirmation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Where an event's confirmation has got to.
 *
 * A 'no' from anyone wins over a missing answer from anyone else: one person
 * saying they can't make it is a fact, and the event needs looking at whatever
 * the others say.
 */
export function confirmState(event: CalendarEvent): ConfirmState {
  if (!event.confirmRequested || event.confirmations.length === 0) return 'settled'
  if (event.confirmations.some((c) => c.answer === 'no')) return 'declined'
  if (event.confirmations.some((c) => c.answer === null)) return 'waiting'
  return 'confirmed'
}

/** True while an event is waiting on somebody — what the dashed styling keys off. */
export function isUnconfirmed(event: CalendarEvent): boolean {
  return confirmState(event) === 'waiting'
}

/** Whether *this* person still owes an answer on this event. */
export function needsMyAnswer(event: CalendarEvent, userId: string | null): boolean {
  if (userId === null) return false
  return event.confirmations.some((c) => c.userId === userId && c.answer === null)
}

/**
 * Everything waiting on me, soonest first — the list behind the badge on the
 * Calendar tab.
 *
 * Past events are deliberately included. An unanswered question about last
 * Tuesday is still an unanswered question, and silently dropping it would mean
 * the badge could clear itself without anybody doing anything.
 */
export function awaitingMe(
  events: readonly CalendarEvent[],
  userId: string | null,
): CalendarEvent[] {
  return sortEvents(events.filter((event) => needsMyAnswer(event, userId)))
}

/* -------------------------------------------------------------------------- */
/* Writing one down                                                            */
/* -------------------------------------------------------------------------- */

/** What the sheet collects. Everything optional has a sane empty value. */
export interface EventDraft {
  kind: EventKind
  title: string
  startsOn: string
  endsOn: string
  startTime: string | null
  endTime: string | null
  location: string
  notes: string
  colour: TagColour
  attendees: string[]
}

/** A blank draft for a day. A reminder starts all-day; an event starts at 18:00. */
export function newDraft(kind: EventKind, day: string): EventDraft {
  return {
    kind,
    title: '',
    startsOn: day,
    endsOn: day,
    // 18:00 because a family event is usually an evening one, and a default you
    // usually keep beats a blank field you always have to fill. A reminder gets
    // no time at all: "remember to do x" is about the day, and asking for a
    // time would make it slower than an event rather than faster, which was the
    // whole point of having it.
    startTime: kind === 'event' ? '18:00' : null,
    endTime: null,
    location: '',
    notes: '',
    colour: DEFAULT_EVENT_COLOUR,
    attendees: [],
  }
}

/** An existing event back into a draft, for editing. */
export function draftFrom(event: CalendarEvent): EventDraft {
  return {
    kind: event.kind,
    title: event.title,
    startsOn: event.startsOn,
    endsOn: event.endsOn,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location ?? '',
    notes: event.notes ?? '',
    colour: event.colour,
    attendees: [...event.attendees],
  }
}

/**
 * A draft cleaned up into something the database will accept, or null if there
 * is nothing worth saving.
 *
 * Null rather than a thrown error or a list of complaints: the only way to get
 * here with a bad draft is an empty title, and the answer to an empty title is
 * a disabled Save button, not a red message explaining that events need names.
 *
 * The three repairs it makes quietly, because all three are things a person
 * does and none is a mistake worth interrupting them for:
 *   - an end day before the start day becomes a single day
 *   - an end time before the start time is dropped
 *   - an end time with no start time is dropped (the database refuses it)
 */
export function cleanDraft(draft: EventDraft): EventDraft | null {
  const title = draft.title.trim()
  if (title === '') return null

  const startTime = toTime(draft.startTime)
  let endTime = startTime === null ? null : toTime(draft.endTime)

  const startMins = minutesOfDay(startTime)
  const endMins = minutesOfDay(endTime)
  const singleDay = draft.endsOn <= draft.startsOn
  if (singleDay && startMins !== null && endMins !== null && endMins <= startMins) {
    endTime = null
  }

  return {
    kind: draft.kind,
    title,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn < draft.startsOn ? draft.startsOn : draft.endsOn,
    startTime,
    endTime,
    location: draft.location.trim(),
    notes: draft.notes.trim(),
    colour: toEventColour(draft.colour),
    // Deduped: the avatar row can't produce a repeat, but a draft round-tripped
    // through an older version of the app could.
    attendees: [...new Set(draft.attendees)],
  }
}

/** Whether a draft is currently saveable — what the Save button is bound to. */
export function canSave(draft: EventDraft): boolean {
  return draft.title.trim() !== ''
}

/**
 * Whether two drafts differ in a way that should make everyone confirm again.
 *
 * Used when saving an edit to an event people have already answered: moving
 * dinner from Thursday to Saturday makes an old "yes" meaningless, while fixing
 * a typo in the title does not. Time, day and place are the three that change
 * whether you can actually be there.
 */
export function needsReconfirming(before: EventDraft, after: EventDraft): boolean {
  return (
    before.startsOn !== after.startsOn ||
    before.endsOn !== after.endsOn ||
    before.startTime !== after.startTime ||
    before.location.trim() !== after.location.trim()
  )
}
