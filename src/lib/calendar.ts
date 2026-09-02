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

import { addDays, daysBetween, localInstant, minutesOfDay, toTime } from './dates'
import { isTagColour, type TagColour } from './dish-tags'
import {
  DEFAULT_REPEAT_COUNT,
  MIN_REPEAT_COUNT,
  type RepeatKind,
  type SeriesRule,
  clampCount,
  isSeriesRule,
} from './recurrence'

export type EventKind = 'event' | 'reminder'

export const EVENT_KINDS: readonly EventKind[] = ['event', 'reminder']

export function isEventKind(value: unknown): value is EventKind {
  return EVENT_KINDS.includes(value as EventKind)
}

/**
 * The three moments a push reminder can go off (round 20.1). Named for what
 * they mean, not for whatever offset happens to implement them, so the sheet's
 * chips and the database's check constraint can both read the same word.
 */
export type ReminderOffset = 'on_time' | '15_before' | 'day_before'

export const REMINDER_OFFSETS: readonly ReminderOffset[] = ['on_time', '15_before', 'day_before']

export function isReminderOffset(value: unknown): value is ReminderOffset {
  return REMINDER_OFFSETS.includes(value as ReminderOffset)
}

const REMINDER_MINUTES_BEFORE: Record<ReminderOffset, number> = {
  on_time: 0,
  '15_before': 15,
  day_before: 24 * 60,
}

/**
 * When a reminder push should fire, as an ISO instant — or null when nothing
 * is armed. This is the one thing in the whole module that turns a day into a
 * moment; see localInstant's own note for why that has to happen here, on the
 * device, rather than in Postgres.
 *
 * An untimed event has no hour to count from, so this borrows the same 09:00
 * pensar's own due reminders default to: the least wrong guess for a day with
 * no time stated.
 */
export function remindInstant(draft: EventDraft): string | null {
  if (draft.remind === null) return null
  return localInstant(draft.startsOn, draft.startTime ?? '09:00', REMINDER_MINUTES_BEFORE[draft.remind])
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
  /** Which push reminder is armed, or null for none. See remindInstant. */
  remindOffset: ReminderOffset | null
  /** Reminders only: when it was ticked off, and by whom. */
  doneAt: string | null
  doneBy: string | null
  createdBy: string
  updatedAt: string
  /** Ids from household_people, marked as going. Empty means everyone (§4.3).
   *  People, not accounts — a child can be on the list (round 11.2). */
  attendees: string[]
  /** One row per person who was asked. Empty until somebody asks. */
  confirmations: Confirmation[]
  /** Which repeating series this belongs to, or null for a one-off. Every
   *  occurrence of "every Sunday, ten times" is an ordinary event carrying the
   *  same id here — see recurrence.ts for why there are ten rows and not one. */
  seriesId: string | null
  /** Where in the series this one is, from 0. Shown as "3 of 10". */
  seriesIndex: number
  /** How many were written. Stays at what the series was *made* as, so a
   *  removed occurrence does not renumber the ones around it. */
  seriesCount: number
  /** How often the series comes round. Null on a one-off. */
  seriesRule: SeriesRule | null
}

/** Whether this event is one of several. What makes the sheet ask the question. */
export function isSeries(event: CalendarEvent): boolean {
  return event.seriesId !== null
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
  /** How often to write it. Only read when the event is being created — see
   *  the note on EditableField in recurrence.ts. */
  repeat: RepeatKind
  /** How many times, when `repeat` is not 'none'. */
  repeatCount: number
  /**
   * Whether to send it round for confirmation on save.
   *
   * On the draft rather than only on the saved event, because round 13 moved
   * the question into the ordinary flow: it is a switch you set while writing
   * the thing down, not a button you come back and press afterwards. Turning it
   * off again withdraws a question already asked.
   */
  askConfirm: boolean
  /**
   * Which push reminder to arm on save, or null for none (round 20.1). "The
   * reminder will send always a notification" (Marçal) — there is no second
   * switch on top of this one; picking an offset is the whole instruction.
   */
  remind: ReminderOffset | null
}

/**
 * The hours a timed event starts and ends at when nobody has said otherwise.
 *
 * Midday to one o'clock (Marçal, round 13, after round 12's 18:00 and round
 * 11's). The middle of the day is the least wrong guess for a family event that
 * could be anything, and an hour is what Google assumes for an event with no
 * end anyway — so the pair agrees with what the push would have done.
 */
export const DEFAULT_START_TIME = '12:00'
export const DEFAULT_END_TIME = '13:00'

/**
 * A blank draft for a day. Nothing starts with a time — see below.
 *
 * Round 11 opened an event at 18:00, on the reasoning that a family event is
 * usually an evening one and a default you keep beats a field you fill. Marçal,
 * after using it: *"start is set to 18 by default, can we find a way or a flow
 * where start time is not required?"*
 *
 * The honest answer was already in the data model. A null start time **is**
 * "all day" (§7) — there is no boolean beside it that could disagree — so an
 * event with no time is not a half-finished event, it is a complete one that
 * happens on a day rather than at an hour. Round 11 was making everyone say
 * *when* before they had decided there was a when.
 *
 * Round 13 settled where that leaves the default. An **event** opens timed, at
 * midday, with an All day switch right above it — which is the Google shape
 * Marçal asked for, and which makes "no time" one obvious tap rather than the
 * thing you have to opt out of. A **reminder** still opens with no time at all:
 * "remember to renew the permit" is about a day, and asking for an hour would
 * make the faster of the two kinds the slower one.
 *
 * `askConfirm` comes in from the caller because its default is a device
 * preference (Settings → Ask to confirm) and this module has no Svelte in it.
 */
export function newDraft(kind: EventKind, day: string, askConfirm = false): EventDraft {
  const timed = kind === 'event'
  return {
    kind,
    title: '',
    startsOn: day,
    endsOn: day,
    startTime: timed ? DEFAULT_START_TIME : null,
    endTime: timed ? DEFAULT_END_TIME : null,
    location: '',
    notes: '',
    colour: DEFAULT_EVENT_COLOUR,
    attendees: [],
    repeat: 'none',
    repeatCount: DEFAULT_REPEAT_COUNT,
    askConfirm,
    remind: null,
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
    // What this event's series *is*, so the sheet can say "Weekly, 3 of 10".
    // Editing these is not offered — see EditableField in recurrence.ts.
    repeat: event.seriesRule ?? 'none',
    repeatCount: event.seriesRule === null ? DEFAULT_REPEAT_COUNT : event.seriesCount,
    // Already asked is the switch already on. Turning it off withdraws.
    askConfirm: event.confirmRequested,
    remind: event.remindOffset,
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
    repeat: draft.repeat,
    // A repeat of one is a one-off wearing a rule, which would leave a series of
    // a single event on the calendar for no reason.
    repeatCount: draft.repeat === 'none' ? 1 : clampCount(draft.repeatCount),
    askConfirm: draft.askConfirm,
    remind: draft.remind,
  }
}

/** Whether a clean draft asks for more than one row to be written. */
export function isRepeating(draft: EventDraft): boolean {
  return draft.repeat !== 'none' && draft.repeatCount >= MIN_REPEAT_COUNT
}

/** The rule to store on the rows, or null when it is a one-off. */
export function draftRule(draft: EventDraft): SeriesRule | null {
  return isRepeating(draft) && isSeriesRule(draft.repeat) ? draft.repeat : null
}

/** How many rows a draft asks for. One for a one-off. */
export function draftOccurrences(draft: EventDraft): number {
  return draftRule(draft) === null ? 1 : draft.repeatCount
}

/**
 * Whether an edit changes the *shape* of a run rather than its contents.
 *
 * The shape is the rhythm and how many times — the two things that decide how
 * many rows exist. Everything else is a field on rows that already exist.
 *
 * Kept apart from draftChanges (recurrence.ts) because they lead to different
 * writes and to different questions: a field edit asks "this one, or all of
 * them?", while a shape change has only one possible answer. You cannot make
 * one occurrence out of ten repeat fortnightly.
 */
export function seriesShapeChanged(event: CalendarEvent, draft: EventDraft): boolean {
  const nowCount = event.seriesRule === null ? 1 : event.seriesCount
  return draftRule(draft) !== event.seriesRule || draftOccurrences(draft) !== nowCount
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
