/*
 * Turning a Niu event into the JSON the Google Calendar API wants, and working
 * out which events still owe Google a push.
 *
 * Pure — no network, no Svelte, no Supabase. The HTTP lives in
 * google-sync.svelte.ts; everything here is arithmetic and shape, which is the
 * half that is easy to get quietly wrong and impossible to notice on a phone.
 *
 * ## The two things worth reading before changing anything
 *
 * **1. The Google event id is derived, not stored.** Google lets the caller
 * choose an event's id, as long as it is 5–1024 characters of base32hex —
 * lowercase a–v and 0–9. A uuid with its dashes removed is hex, which is inside
 * that alphabet, so `niu` + the uuid *is* the Google id.
 *
 * That is worth more than the column it saves. It makes a push idempotent: if a
 * request half-fails and gets retried, the retry re-uses the same id and
 * updates the event instead of making a second copy of Thursday's dinner. And a
 * deletion still knows what to delete after our row is gone, which is why the
 * tombstone table in 0012 is three columns rather than a join.
 *
 * **2. Google's all-day end date is exclusive; ours is inclusive.** A holiday
 * from the 1st to the 7th is stored here as `endsOn = the 7th`, and has to be
 * sent to Google as `end.date = the 8th`. That conversion happens once, in
 * `toGoogleEvent`, and the test for it is the one that matters most in this
 * file — get it wrong and every multi-day event is a day short, which is
 * exactly the kind of bug nobody sees for a month.
 */

import type { CalendarEvent } from './calendar'
import { addDays } from './dates'

/** The scope Niu asks Google for, and the reason it can be trusted.
 *
 * "Make secondary Google calendars, and see, create, change and delete events
 * on them" — and nothing else. Niu is not merely *choosing* not to read work
 * meetings, as NIU.md §4.3 promises: with this scope it is incapable of it.
 *
 * The price, and the reason each member gets their own copy of the calendar, is
 * that the scope covers only calendars this app created for this user, and it
 * cannot write sharing rules. See the long note in 0012_calendar.sql.
 */
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'

export const GOOGLE_API = 'https://www.googleapis.com/calendar/v3'

/** What the calendar Niu makes in each member's account is called. */
export const NIU_CALENDAR_SUMMARY = 'Niu'

export const NIU_CALENDAR_DESCRIPTION =
  'Family events from Niu. Written by the app; edits made here are overwritten.'

/* -------------------------------------------------------------------------- */
/* Ids                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The Google id for one of our events. See the header for why it is derived.
 *
 * Anything that is not a plain uuid comes back null rather than being coerced:
 * a malformed id would produce a Google id that collides with nothing and can
 * never be found again, which is worse than not syncing that one row.
 */
export function googleEventId(eventId: string): string | null {
  const bare = eventId.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(bare)) return null
  return `niu${bare}`
}

/* -------------------------------------------------------------------------- */
/* The body                                                                    */
/* -------------------------------------------------------------------------- */

export interface GoogleDateTime {
  date?: string
  dateTime?: string
  timeZone?: string
}

export interface GoogleEventBody {
  id?: string
  summary: string
  description?: string
  location?: string
  start: GoogleDateTime
  end: GoogleDateTime
  status?: 'confirmed' | 'tentative'
  transparency?: 'opaque' | 'transparent'
  reminders?: { useDefault: boolean; overrides?: { method: 'popup'; minutes: number }[] }
}

/** How many minutes before a timed reminder Google should buzz the phone. */
const REMINDER_LEAD_MINUTES = 10

/**
 * What hour an all-day reminder is pushed to Google at, and how long it lasts.
 *
 * This is the one place a Niu event deliberately changes shape on the way over,
 * and the reason is a hard limit in Google's API rather than a preference.
 *
 * Google counts a reminder in *minutes before the start of the event*, and an
 * all-day event starts at midnight. `minutes` must be zero or positive, so the
 * earliest an all-day reminder can fire is midnight — which is a notification
 * about renewing the parking permit that nobody will ever read — and anything
 * else lands the day *before*.
 *
 * So an all-day reminder crosses over as a short timed event at 09:00 on its
 * own day, with the popup at zero minutes. In Niu it stays a day's task with no
 * time on it, which is what it is; in Google it becomes the moment the phone
 * should buzz, which is what Google is for. An all-day *event* — a holiday, a
 * birthday — is not touched: it is genuinely an all-day thing and belongs in
 * the banner at the top of the day.
 */
const REMINDER_HOUR = '09:00'
const REMINDER_END_HOUR = '09:15'

/**
 * A Niu event as Google wants it.
 *
 * `timeZone` is the phone's own, read at the call site. Both phones in this
 * household are in the same place, and an event written in Gothenburg and
 * pushed from a holiday in Barcelona should still be at 18:30 Gothenburg time —
 * which is what sending the zone alongside the wall-clock time achieves, and
 * what converting to UTC here would destroy.
 */
export function toGoogleEvent(event: CalendarEvent, timeZone: string): GoogleEventBody {
  const { start, end } = googleSpan(event, timeZone)

  const body: GoogleEventBody = {
    summary: googleSummary(event),
    start,
    end,
    // An unconfirmed event goes over as "tentative" so Google's own UI draws it
    // differently too. That costs nothing and means the mark survives the trip
    // to the phone's calendar widget, where most of the glances happen.
    status: event.confirmRequested && !isSettled(event) ? 'tentative' : 'confirmed',
    // A reminder should not make you look busy to yourself. An event should.
    transparency: event.kind === 'reminder' ? 'transparent' : 'opaque',
    reminders: reminderRule(event),
  }

  const description = googleDescription(event)
  if (description !== '') body.description = description
  if (event.location) body.location = event.location

  return body
}

/**
 * The start and end Google should be given.
 *
 * Three shapes come out of here, and each is a decision:
 *
 *   all-day event     `date` at both ends, with the end pushed one day past
 *                     ours — Google's all-day end is exclusive and ours is
 *                     inclusive. This is the conversion most worth testing.
 *   all-day reminder  a 15-minute slot at 09:00. See REMINDER_HOUR.
 *   timed             wall-clock time plus the zone. An event with no end time
 *                     gets an hour, which is what Google itself assumes.
 */
export function googleSpan(
  event: CalendarEvent,
  timeZone: string,
): { start: GoogleDateTime; end: GoogleDateTime } {
  if (event.startTime === null) {
    if (event.kind === 'reminder') {
      return {
        start: { dateTime: `${event.startsOn}T${REMINDER_HOUR}:00`, timeZone },
        end: { dateTime: `${event.startsOn}T${REMINDER_END_HOUR}:00`, timeZone },
      }
    }
    return { start: { date: event.startsOn }, end: { date: addDays(event.endsOn, 1) } }
  }

  const startTime = event.startTime
  let endsOn = event.endsOn
  let endTime = event.endTime

  if (endTime === null) {
    // An hour after the start. At 23:30 that is 00:30 *the next day*, and
    // handing Google an end before its start is a 400 rather than a short
    // event, so the day has to roll with it.
    const [rolled, time] = addHour(startTime)
    endTime = time
    if (rolled) endsOn = addDays(endsOn, 1)
  }

  return {
    start: { dateTime: `${event.startsOn}T${startTime}:00`, timeZone },
    end: { dateTime: `${endsOn}T${endTime}:00`, timeZone },
  }
}

/**
 * The title Google shows.
 *
 * A reminder is prefixed rather than given its own calendar, because a second
 * calendar is a second thing to subscribe to on both phones and the prefix does
 * the same job in the notification shade, where it is actually read.
 *
 * A ticked-off reminder keeps its place and says so. Deleting it from Google
 * would be tidier and wrong: the point of ticking is that it *was* done.
 */
export function googleSummary(event: CalendarEvent): string {
  if (event.kind !== 'reminder') return event.title
  return event.doneAt === null ? `⏰ ${event.title}` : `✓ ${event.title}`
}

/** Notes, plus the line that says where this came from. */
export function googleDescription(event: CalendarEvent): string {
  const parts: string[] = []
  if (event.notes) parts.push(event.notes)
  parts.push('— added in Niu')
  return parts.join('\n\n')
}

function isSettled(event: CalendarEvent): boolean {
  return (
    event.confirmations.length > 0 && event.confirmations.every((c) => c.answer === 'yes')
  )
}

type Reminders = NonNullable<GoogleEventBody['reminders']>

function reminderRule(event: CalendarEvent): Reminders {
  // An ordinary event uses whatever defaults the person set on the calendar
  // itself, which is the one place they can change it without us building a
  // settings screen for it.
  if (event.kind !== 'reminder') return { useDefault: true }
  // A reminder that has been ticked off has nothing left to remind anyone of.
  if (event.doneAt !== null) return { useDefault: false, overrides: [] }

  // All-day reminders arrive at 09:00 already (see googleSpan), so the popup is
  // at the event itself rather than some minutes before it.
  const minutes = event.startTime === null ? 0 : REMINDER_LEAD_MINUTES
  return { useDefault: false, overrides: [{ method: 'popup', minutes }] }
}

/**
 * `HH:MM` an hour later, and whether that crossed midnight.
 *
 * The flag is the whole point: without it, 23:30 + an hour is "00:30" on the
 * same day, which is an end before its start.
 */
function addHour(time: string): [rolled: boolean, time: string] {
  const h = Number(time.slice(0, 2))
  const m = time.slice(3, 5)
  const next = h + 1
  return [next > 23, `${`${next % 24}`.padStart(2, '0')}:${m}`]
}

/* -------------------------------------------------------------------------- */
/* The queue                                                                   */
/* -------------------------------------------------------------------------- */

/** What this member's phone has already told Google about one event. */
export interface SyncRow {
  eventId: string
  /** The `updatedAt` that was pushed. Null if it has never been pushed. */
  pushedAt: string | null
  /** Set once the Google copy of a deleted event has been removed. */
  removedAt: string | null
}

export interface SyncPlan {
  /** Events to insert or update, oldest change first. */
  push: CalendarEvent[]
  /** Google ids to delete — events that no longer exist here. */
  remove: { eventId: string; googleId: string }[]
}

/**
 * What still has to be sent, given what this member has already sent.
 *
 * The comparison is `updatedAt !== pushedAt` rather than `>`: string timestamps
 * from two sources are not reliably ordered, and "different from what I sent"
 * is the question anyway. A clock that went backwards then produces one
 * unnecessary push instead of a permanently stale event.
 *
 * `limit` exists because this runs on a phone that may have been offline for a
 * fortnight, and a hundred sequential HTTPS requests on mobile data is a worse
 * experience than syncing the first twenty now and the rest on the next tap.
 */
export function syncPlan(
  events: readonly CalendarEvent[],
  tombstones: readonly string[],
  synced: readonly SyncRow[],
  limit = 25,
): SyncPlan {
  const byId = new Map(synced.map((row) => [row.eventId, row]))

  const push = events
    .filter((event) => {
      const row = byId.get(event.id)
      return row === undefined || row.pushedAt !== event.updatedAt
    })
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, limit)

  const remove: SyncPlan['remove'] = []
  for (const eventId of tombstones) {
    const row = byId.get(eventId)
    // Never pushed means Google never had it — there is nothing to delete, and
    // asking would be a wasted request and a 404 to swallow.
    if (row === undefined || row.pushedAt === null || row.removedAt !== null) continue
    const googleId = googleEventId(eventId)
    if (googleId === null) continue
    remove.push({ eventId, googleId })
    if (remove.length >= limit) break
  }

  return { push, remove }
}

/** How many things are waiting — the number on the "Sync" button. */
export function pendingCount(plan: SyncPlan): number {
  return plan.push.length + plan.remove.length
}
