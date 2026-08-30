/*
 * Pushing this household's events into *this member's* Google calendar, and
 * removing the copies of the ones that were deleted.
 *
 * The arithmetic — what still owes Google a push, what the body looks like,
 * what a Google event id is — lives in google-event.ts and is tested. This file
 * is the part that talks to the network and to Supabase, which is the part that
 * cannot be.
 *
 * ## One way, and only ever one way
 *
 * Niu writes to Google and never reads back (§4.3). If somebody edits an event
 * inside Google Calendar, the next push overwrites it. That is not an oversight
 * — two-way sync is a different project — and it is why the description on
 * every pushed event says where it came from.
 *
 * ## The queue is idempotent, which is what makes it safe to retry
 *
 * Every event's Google id is derived from its Niu id, so a push that half-fails
 * can simply be run again: the retry hits the same id and updates rather than
 * making a second copy. That means this file needs no transaction, no lock and
 * no cleanup pass — it just runs again on the next tap.
 *
 * ## Nothing here ever throws at the user
 *
 * A failed push leaves the event exactly where it was, still in the queue, with
 * a count on the Sync pill. Niu's own database is the truth; Google is a copy
 * that is sometimes a few minutes behind.
 */

import { auth } from './auth.svelte'
import { calendar } from './calendar.svelte'
import { type SyncPlan, type SyncRow, googleEventId, pendingCount, syncPlan, toGoogleEvent } from './google-event'
import { connectGoogle, deviceTimeZone, ensureCalendar, google, googleFetch } from './google.svelte'
import { household } from './household.svelte'
import { strings } from './strings'
import { supabase } from './supabase'

class SyncState {
  /** What this member has already told Google, from the database. */
  rows = $state<SyncRow[]>([])
  running = $state(false)
  error = $state<string | null>(null)
  /** When the last successful drain finished, as epoch ms. Zero if never. */
  lastRunAt = $state(0)

  /** What is still owed. Recomputed whenever an event or a row changes. */
  plan = $derived<SyncPlan>(
    syncPlan(calendar.events, calendar.tombstones, this.rows),
  )

  /** The number on the Sync pill. Zero hides it. */
  pending = $derived(pendingCount(this.plan))
}

export const sync = new SyncState()

/* -------------------------------------------------------------------------- */
/* Bookkeeping                                                                 */
/* -------------------------------------------------------------------------- */

interface SyncRowShape {
  event_id: string
  pushed_at: string | null
  removed_at: string | null
}

export async function loadSyncRows(): Promise<void> {
  if (!supabase || !household.id || !auth.userId) return

  const { data, error } = await supabase
    .from('event_sync')
    .select('event_id, pushed_at, removed_at')
    .eq('household_id', household.id)
    .eq('user_id', auth.userId)

  if (error || !data) return

  sync.rows = (data as SyncRowShape[]).map((row) => ({
    eventId: row.event_id,
    pushedAt: row.pushed_at,
    removedAt: row.removed_at,
  }))
}

async function recordPushed(eventId: string, pushedAt: string): Promise<void> {
  if (!supabase || !household.id || !auth.userId) return

  await supabase.from('event_sync').upsert(
    {
      event_id: eventId,
      user_id: auth.userId,
      household_id: household.id,
      pushed_at: pushedAt,
      removed_at: null,
    },
    { onConflict: 'event_id,user_id' },
  )
}

async function recordRemoved(eventId: string): Promise<void> {
  if (!supabase || !auth.userId) return

  await supabase
    .from('event_sync')
    .update({ removed_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('user_id', auth.userId)
}

/* -------------------------------------------------------------------------- */
/* The drain                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Sends everything outstanding.
 *
 * `interactive` says whether this was started by a tap. Only an interactive run
 * may ask Google for a token, because only a tap can open the popup Google
 * needs — a background run with no live token simply stops and leaves the pill
 * showing, which is the honest thing to do rather than opening a popup the
 * browser will block anyway.
 *
 * Sequential rather than parallel on purpose. A phone on mobile data does
 * better with one request at a time than with twenty at once, and the Calendar
 * API's per-user rate limit is easy to trip with a burst.
 */
export async function runSync(interactive = false): Promise<void> {
  if (sync.running) return
  if (!google.available) return

  const plan = sync.plan
  if (pendingCount(plan) === 0) {
    sync.error = null
    return
  }

  sync.running = true
  sync.error = null

  try {
    if (!google.live) {
      if (!interactive) return
      const connected = await connectGoogle()
      if (!connected) {
        sync.error = google.error ?? strings.google.tokenFailed
        return
      }
    }

    const calendarId = await ensureCalendar()
    if (calendarId === null) {
      sync.error = google.error ?? strings.google.calendarFailed
      return
    }

    const path = `/calendars/${encodeURIComponent(calendarId)}/events`
    const timeZone = deviceTimeZone()
    let failed = 0

    for (const event of plan.push) {
      const googleId = googleEventId(event.id)
      if (googleId === null) continue

      const body = { ...toGoogleEvent(event, timeZone), id: googleId }

      // Insert first. A 409 means Google already has this id, which is exactly
      // what a retry or an edit looks like, so that case updates instead. Doing
      // it this way round rather than "look it up, then decide" halves the
      // requests for the common case, which is a brand-new event.
      let result = await googleFetch(path, { method: 'POST', body: JSON.stringify(body) })

      if (result.status === 409) {
        result = await googleFetch(`${path}/${googleId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }

      if (result.ok) {
        await recordPushed(event.id, event.updatedAt)
      } else {
        failed += 1
        // A dead token is not this event's fault and every following request
        // would fail the same way. Stop and let the next tap re-connect.
        if (result.status === 401 || result.status === 403) break
      }
    }

    for (const { eventId, googleId } of plan.remove) {
      const result = await googleFetch(`${path}/${googleId}`, { method: 'DELETE' })

      // 404 means somebody removed it in Google already. That is the outcome we
      // wanted, so it counts as done rather than as a failure to retry forever.
      if (result.ok || result.status === 404) {
        await recordRemoved(eventId)
      } else {
        failed += 1
        if (result.status === 401 || result.status === 403) break
      }
    }

    await loadSyncRows()

    if (failed > 0) sync.error = strings.google.someFailed
    else sync.lastRunAt = Date.now()
  } finally {
    sync.running = false
  }
}

/**
 * A quiet attempt after something changed.
 *
 * Only does anything when a token is already live, which is the case for the
 * hour after the first tap — so in practice everything written during a normal
 * session reaches Google within a second of being saved, without a second tap.
 */
export function syncSoon(): void {
  if (!google.live) return
  void runSync(false)
}

/**
 * Tries a quiet sync the moment the app is opened or brought back to the
 * foreground, on top of the after-every-edit calls above.
 *
 * This is what makes "open the app" the usual way sync happens rather than
 * the Sync tap — but it is still bound by the same hour-long token window as
 * everything else here (see google.svelte.ts): open the app the next morning
 * and there is nothing to piggyback on, so the pill and the tap are still
 * there for that case.
 */
export function watchAutoSync(): () => void {
  syncSoon()

  const onVisible = () => {
    if (document.visibilityState === 'visible') syncSoon()
  }
  document.addEventListener('visibilitychange', onVisible)

  return () => document.removeEventListener('visibilitychange', onVisible)
}

export function clearSync(): void {
  sync.rows = []
  sync.error = null
  sync.running = false
  sync.lastRunAt = 0
}
