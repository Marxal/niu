/*
 * The events on screen, kept live, and everything that writes one.
 *
 * ## What is loaded, and when
 *
 * A window of days rather than everything: three months back and a year forward
 * at boot, widened by whatever month you step to. It never narrows — narrowing
 * would throw away rows a step back would immediately need again, and it would
 * also hide events from the Google queue, which reads the same list. See
 * loadInitialWindow for why the boot window is as wide as it is.
 *
 * A multi-day event is caught by an *overlap* test — `starts_on <= to and
 * ends_on >= from` — not by its start date. A holiday that began last month is
 * still happening this month and has to come back.
 *
 * ## Realtime is the source of truth
 *
 * Same stance as the shopping list and the planner: every change comes back
 * through the subscription and overwrites what is here, so a change made on the
 * other phone and one made on this one take exactly the same path. Three tables
 * feed it — the events, who is going, and who has confirmed — because all three
 * change what a card looks like.
 *
 * Fail soft throughout: a failed call sets `error` and leaves the last good
 * month on screen.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { auth } from './auth.svelte'
import {
  type CalendarEvent,
  type Confirmation,
  type EventDraft,
  awaitingMe,
  cleanDraft,
  toEventColour,
} from './calendar'
import { addMonths, isDayKey, monthGrid, monthKey, monthStart, todayKey } from './dates'
import { household } from './household.svelte'
import { isEventKind } from './calendar'
import { strings } from './strings'
import { supabase } from './supabase'

class CalendarState {
  events = $state<CalendarEvent[]>([])
  /** Ids of events deleted here, so the Google push knows to remove its copies. */
  tombstones = $state<string[]>([])
  loading = $state(false)
  error = $state<string | null>(null)

  /** The window currently loaded, as day keys. */
  from = $state<string>(todayKey())
  to = $state<string>(todayKey())

  /** Everything still waiting on an answer from *you*. Drives the tab badge. */
  waitingOnMe = $derived(awaitingMe(this.events, auth.userId))
}

export const calendar = new CalendarState()

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

interface EventRow {
  id: string
  kind: string
  title: string
  starts_on: string
  ends_on: string
  start_time: string | null
  end_time: string | null
  location: string | null
  notes: string | null
  colour: string | null
  confirm_requested: boolean
  done_at: string | null
  done_by: string | null
  created_by: string
  updated_at: string
}

function toEvent(
  row: EventRow,
  attendees: string[],
  confirmations: CalendarEvent['confirmations'],
): CalendarEvent {
  return {
    id: row.id,
    kind: isEventKind(row.kind) ? row.kind : 'event',
    title: row.title,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    // Postgres hands back HH:MM:SS; the app works in HH:MM throughout.
    startTime: row.start_time === null ? null : row.start_time.slice(0, 5),
    endTime: row.end_time === null ? null : row.end_time.slice(0, 5),
    location: row.location,
    notes: row.notes,
    colour: toEventColour(row.colour),
    confirmRequested: row.confirm_requested,
    doneAt: row.done_at,
    doneBy: row.done_by,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    attendees,
    confirmations,
  }
}

/**
 * The window a month needs: the grid it draws — which already reaches into the
 * neighbouring months — plus a month of slack each side so stepping is instant.
 */
export function windowForMonth(month: string): { from: string; to: string } {
  const grid = monthGrid(month)
  return {
    from: monthStart(addMonths(month, -1)),
    to: grid[grid.length - 1] ?? monthStart(addMonths(month, 1)),
  }
}

/**
 * The window loaded at boot: three months back, a year forward.
 *
 * Much wider than the month on screen, and the reason is the Google queue rather
 * than the grid. What still owes Google a push is worked out from the events in
 * memory, so an event that has fallen outside the loaded window is an event the
 * queue cannot see — and the case that produces is real: write something for
 * December, never connect Google, open the app in January, and a narrow window
 * would have quietly dropped it from the queue for good.
 *
 * The cost is small. A household's calendar is a few hundred short rows a year,
 * which is less data than one screen of the shopping catalogue.
 */
export async function loadInitialWindow(): Promise<void> {
  const month = monthKey(todayKey())
  calendar.from = monthStart(addMonths(month, -3))
  calendar.to = windowForMonth(addMonths(month, 12)).to
  await loadEvents()
}

/** Widens the loaded window to cover a month, and reloads if it had to grow. */
export async function setWindow(month: string): Promise<void> {
  const want = windowForMonth(month)
  const from = want.from < calendar.from ? want.from : calendar.from
  const to = want.to > calendar.to ? want.to : calendar.to

  if (from === calendar.from && to === calendar.to && calendar.events.length > 0) return

  calendar.from = from
  calendar.to = to
  await loadEvents()
}

export async function loadEvents(): Promise<void> {
  if (!supabase || !household.id) return

  calendar.loading = true

  // Three reads rather than one nested select: PostgREST can embed the child
  // rows, but the embed makes the filter above apply to the parent only, and a
  // row with no attendees comes back with an empty array either way. Three
  // small queries are easier to read and each one is a plain index lookup.
  const [eventsResult, attendeesResult, confirmationsResult] = await Promise.all([
    supabase
      .from('events')
      .select(
        'id, kind, title, starts_on, ends_on, start_time, end_time, location, notes, ' +
          'colour, confirm_requested, done_at, done_by, created_by, updated_at',
      )
      .eq('household_id', household.id)
      .lte('starts_on', calendar.to)
      .gte('ends_on', calendar.from),
    supabase
      .from('event_attendees')
      .select('event_id, user_id')
      .eq('household_id', household.id),
    supabase
      .from('event_confirmations')
      .select('event_id, user_id, answer')
      .eq('household_id', household.id),
  ])

  calendar.loading = false

  if (eventsResult.error || !eventsResult.data) {
    calendar.error = strings.calendar.loadFailed
    return
  }

  const attendees = new Map<string, string[]>()
  const attendeeRows = (attendeesResult.data ?? []) as unknown as {
    event_id: string
    user_id: string
  }[]
  for (const row of attendeeRows) {
    const list = attendees.get(row.event_id)
    if (list) list.push(row.user_id)
    else attendees.set(row.event_id, [row.user_id])
  }

  const confirmations = new Map<string, CalendarEvent['confirmations']>()
  const confirmationRows = (confirmationsResult.data ?? []) as unknown as {
    event_id: string
    user_id: string
    answer: string | null
  }[]
  for (const row of confirmationRows) {
    const entry: Confirmation = {
      userId: row.user_id,
      answer: row.answer === 'yes' || row.answer === 'no' ? row.answer : null,
    }
    const list = confirmations.get(row.event_id)
    if (list) list.push(entry)
    else confirmations.set(row.event_id, [entry])
  }

  calendar.error = null
  calendar.events = (eventsResult.data as unknown as EventRow[]).map((row) =>
    toEvent(row, attendees.get(row.id) ?? [], confirmations.get(row.id) ?? []),
  )
}

/** Ids of events this household has deleted — the Google push's delete queue. */
export async function loadTombstones(): Promise<void> {
  if (!supabase || !household.id) return

  const { data } = await supabase
    .from('event_tombstones')
    .select('event_id')
    .eq('household_id', household.id)
    .order('deleted_at', { ascending: false })
    .limit(200)

  calendar.tombstones = ((data ?? []) as { event_id: string }[]).map((r) => r.event_id)
}

let channel: RealtimeChannel | null = null

export function watchCalendar(): () => void {
  if (!supabase || !household.id) return () => {}

  const client = supabase
  const filter = `household_id=eq.${household.id}`
  const reload = () => void loadEvents()

  channel = client
    .channel(`calendar:${household.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter }, reload)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'event_attendees', filter },
      reload,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'event_confirmations', filter },
      reload,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'event_tombstones', filter },
      () => void loadTombstones(),
    )
    .subscribe()

  return () => {
    if (channel) {
      void client.removeChannel(channel)
      channel = null
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

function draftColumns(draft: EventDraft): Record<string, unknown> {
  return {
    kind: draft.kind,
    title: draft.title,
    starts_on: draft.startsOn,
    ends_on: draft.endsOn,
    start_time: draft.startTime,
    end_time: draft.endTime,
    location: draft.location === '' ? null : draft.location,
    notes: draft.notes === '' ? null : draft.notes,
    colour: draft.colour,
  }
}

/**
 * Writes a new event and returns its id, or null if it couldn't be written.
 *
 * Not optimistic, unlike tapping a shopping tile. Adding an event is a sheet
 * you filled in and a Save you pressed, so a moment's wait is expected and
 * showing a card that might vanish would be worse than showing one a beat late.
 */
export async function addEvent(draft: EventDraft): Promise<string | null> {
  if (!supabase || !household.id || !auth.userId) return null

  const clean = cleanDraft(draft)
  if (clean === null) return null

  const { data, error } = await supabase
    .from('events')
    .insert({
      ...draftColumns(clean),
      household_id: household.id,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    calendar.error = strings.calendar.saveFailed
    return null
  }

  const id = (data as { id: string }).id
  await setAttendees(id, clean.attendees)
  await loadEvents()
  return id
}

export async function updateEvent(id: string, draft: EventDraft): Promise<boolean> {
  if (!supabase || !household.id) return false

  const clean = cleanDraft(draft)
  if (clean === null) return false

  const { error } = await supabase
    .from('events')
    .update(draftColumns(clean))
    .eq('id', id)
    .eq('household_id', household.id)

  if (error) {
    calendar.error = strings.calendar.saveFailed
    return false
  }

  await setAttendees(id, clean.attendees)
  await loadEvents()
  return true
}

/**
 * Replaces an event's attendee list.
 *
 * Delete-then-insert rather than a diff: the list is at most a handful of rows
 * and working out which two changed costs more code than rewriting all of them.
 */
async function setAttendees(eventId: string, userIds: readonly string[]): Promise<void> {
  if (!supabase || !household.id) return

  await supabase.from('event_attendees').delete().eq('event_id', eventId)

  if (userIds.length === 0) return

  await supabase.from('event_attendees').insert(
    userIds.map((userId) => ({
      event_id: eventId,
      user_id: userId,
      household_id: household.id,
    })),
  )
}

export async function removeEvent(id: string): Promise<boolean> {
  if (!supabase || !household.id) return false

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .eq('household_id', household.id)

  if (error) {
    calendar.error = strings.calendar.deleteFailed
    return false
  }

  // Dropped locally straight away. The delete is the one write worth being
  // optimistic about: the row is gone on the server, and waiting for realtime
  // to say so leaves the card sitting there looking like the tap missed.
  calendar.events = calendar.events.filter((event) => event.id !== id)
  await loadTombstones()
  return true
}

/** Ticks a reminder off, or puts it back. Events have nothing to tick. */
export async function setDone(id: string, done: boolean): Promise<void> {
  if (!supabase || !household.id || !auth.userId) return

  const { error } = await supabase
    .from('events')
    .update({
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? auth.userId : null,
    })
    .eq('id', id)
    .eq('household_id', household.id)

  if (error) {
    calendar.error = strings.calendar.saveFailed
    return
  }

  await loadEvents()
}

/* -------------------------------------------------------------------------- */
/* Confirmation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Asks everyone else in the household to confirm.
 *
 * One RPC rather than "read the members, work out who isn't me, insert a row
 * each": one round trip on a phone that is usually on mobile data, and the
 * database is the thing that already knows who is in the household.
 */
export async function askToConfirm(eventId: string): Promise<boolean> {
  if (!supabase) return false

  const { error } = await supabase.rpc('ask_to_confirm', { event: eventId })

  if (error) {
    calendar.error = strings.calendar.askFailed
    return false
  }

  await loadEvents()
  return true
}

/** Answers a request. Yours only — the database refuses anyone else's row. */
export async function answerConfirmation(eventId: string, answer: 'yes' | 'no'): Promise<void> {
  if (!supabase || !auth.userId) return

  const { error } = await supabase
    .from('event_confirmations')
    .update({ answer, answered_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('user_id', auth.userId)

  if (error) {
    calendar.error = strings.calendar.answerFailed
    return
  }

  await loadEvents()
}

/**
 * Withdraws the question, putting the event back to plain.
 *
 * Also what an edit uses when the time or place moved: the old answers are
 * about a different evening, so they are cleared and the question re-asked
 * rather than left standing as a yes to something that is no longer true.
 */
export async function unaskConfirmation(eventId: string): Promise<void> {
  if (!supabase || !household.id) return

  await supabase.from('event_confirmations').delete().eq('event_id', eventId)
  await supabase
    .from('events')
    .update({ confirm_requested: false })
    .eq('id', eventId)
    .eq('household_id', household.id)

  await loadEvents()
}

/** Clears state on sign-out so nothing leaks into the next session. */
export function clearCalendar(): void {
  calendar.events = []
  calendar.tombstones = []
  calendar.error = null
  calendar.loading = false
  calendar.from = todayKey()
  calendar.to = todayKey()
}

/** A day key from the URL, or today. Used by the screen's deep link. */
export function dayFromHash(value: string | null): string {
  return isDayKey(value) ? value : todayKey()
}
