/*
 * Getting a Google Calendar token in the browser, and making sure this member
 * has a calendar called "Niu" to push into.
 *
 * ## Why this is done in the browser at all
 *
 * The obvious route is the token Supabase already has: sign-in can ask Google
 * for extra scopes and the session comes back with a `provider_token`. It works
 * for about an hour and then stops, because Supabase hands the provider token
 * over once and never refreshes it — and refreshing a Google token needs the
 * OAuth *client secret*, which cannot go in a static bundle (config.ts).
 *
 * The alternative is a small server function holding that secret. That is the
 * right answer eventually and it is what round 11.1 will need anyway for push
 * notifications. It is not the right answer for this round, because it is a
 * deploy step and a stored refresh token in exchange for a problem that Google
 * Identity Services already solves for browser apps: ask for a token from the
 * page, get one that lasts an hour, ask again when it runs out. No secret, no
 * server, nothing stored.
 *
 * ## The cost, stated plainly
 *
 * `requestAccessToken` opens a popup, and a browser only allows that from a
 * real tap. So **the first sync after opening the app needs one tap**, and
 * everything for the next hour is silent. That is why the calendar screen has a
 * small "Sync" pill with a count on it rather than a hidden background job: the
 * tap is a real requirement, so it is shown as a real button.
 *
 * The token is kept in memory only — never localStorage. A bearer token in
 * storage outlives the tab and is exactly what an XSS would go looking for, and
 * the price of not storing it is the tap that was needed anyway.
 *
 * ## Fail soft
 *
 * Every failure here leaves `error` set and the app working. Niu's own database
 * is the source of truth (§4.3); Google is a copy. An event that has not
 * reached Google yet is not a lost event, it is an event with a small cloud
 * beside it.
 */

import { googleClientId } from './config'
import {
  GOOGLE_API,
  GOOGLE_SCOPE,
  NIU_CALENDAR_DESCRIPTION,
  NIU_CALENDAR_SUMMARY,
} from './google-event'
import { auth } from './auth.svelte'
import { household } from './household.svelte'
import { strings } from './strings'
import { supabase } from './supabase'

/* -------------------------------------------------------------------------- */
/* The bit of Google Identity Services we use                                  */
/* -------------------------------------------------------------------------- */

/**
 * Hand-written types for the four things we touch on the global `google`
 * object. Google ships no types with the script and the `@types` package would
 * be a dependency for four function signatures — see CLAUDE.md on not adding
 * packages. Verified against the live script rather than remembered.
 */
interface TokenResponse {
  access_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type?: string; message?: string }) => void
  }) => TokenClient
  revoke: (token: string, done?: () => void) => void
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } }
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client'

/** Loads the Google script once. Resolves false if it can't be reached. */
function loadGsi(): Promise<boolean> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(true)

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.addEventListener('load', () => resolve(true), { once: true })
    script.addEventListener('error', () => resolve(false), { once: true })
    document.head.appendChild(script)
  })
}

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * unavailable  no client id in the build — the push is switched off entirely
 * off          never connected on this device
 * connecting   a token request is in flight
 * ready        a live token; pushes go through with no further taps
 * expired      connected before, but this app launch has no token yet
 */
export type GoogleStatus = 'unavailable' | 'off' | 'connecting' | 'ready' | 'expired'

/**
 * That this device has connected before. Not the token — a flag, so the button
 * can say "Sync" rather than "Connect Google Calendar" every morning.
 * `niu.` prefixed and permanent, per the storage rule.
 */
const CONNECTED_KEY = 'niu.google.connected'

function rememberConnected(yes: boolean): void {
  try {
    if (yes) localStorage.setItem(CONNECTED_KEY, '1')
    else localStorage.removeItem(CONNECTED_KEY)
  } catch {
    // Private mode. The flag is a convenience; losing it costs a word on a button.
  }
}

function wasConnected(): boolean {
  try {
    return localStorage.getItem(CONNECTED_KEY) === '1'
  } catch {
    return false
  }
}

class GoogleState {
  /**
   * Which Google calendar this account pushes into. Null until it connects, or
   * until it has been read back.
   *
   * It lives on `household_members` rather than on the person, and that
   * distinction is round 11.2's whole point: a person can be a five-year-old,
   * and a five-year-old has no Google calendar. This is a fact about an
   * *account*.
   */
  calendarId = $state<string | null>(null)

  status = $state<GoogleStatus>(
    googleClientId === '' ? 'unavailable' : wasConnected() ? 'expired' : 'off',
  )
  /** A short, already-friendly sentence. Null when nothing is wrong. */
  error = $state<string | null>(null)
  /** When the current token dies, as epoch ms. Zero when there isn't one. */
  expiresAt = $state(0)

  /** True when a push would go through right now with no interaction. */
  live = $derived(this.status === 'ready')

  /** True when the feature exists at all for this build. */
  available = $derived(this.status !== 'unavailable')
}

export const google = new GoogleState()

/** Held here rather than in the class: reactive state is for what the UI draws,
 * and no part of the UI should ever be able to render a bearer token. */
let accessToken: string | null = null
let client: TokenClient | null = null

/** Reads back the calendar this account already made, if there is one. */
export async function loadCalendarId(): Promise<void> {
  if (!supabase || !household.id || !auth.userId) return

  const { data } = await supabase
    .from('household_members')
    .select('google_calendar_id')
    .eq('household_id', household.id)
    .eq('user_id', auth.userId)
    .maybeSingle()

  const row = data as { google_calendar_id: string | null } | null
  google.calendarId = row?.google_calendar_id ?? null
}

async function saveCalendarId(id: string | null): Promise<void> {
  if (!supabase || !household.id || !auth.userId) return

  await supabase
    .from('household_members')
    .update({ google_calendar_id: id })
    .eq('household_id', household.id)
    .eq('user_id', auth.userId)

  google.calendarId = id
}

/** The phone's own zone, sent alongside every wall-clock time. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/* -------------------------------------------------------------------------- */
/* Connecting                                                                  */
/* -------------------------------------------------------------------------- */

function tokenIsLive(): boolean {
  // A minute of slack: a token that dies mid-request is a failed push and a
  // confusing error, and asking for a fresh one a minute early costs nothing.
  return accessToken !== null && Date.now() < google.expiresAt - 60_000
}

/**
 * Asks Google for a token. **Must be called from a tap** — it opens a popup,
 * and browsers block popups that no gesture asked for.
 *
 * `prompt: ''` means "only ask the first time": the first connection shows the
 * consent screen, and every one after it returns straight away, which is what
 * makes the once-per-launch tap a tap rather than a dialogue.
 */
export async function connectGoogle(): Promise<boolean> {
  if (googleClientId === '') {
    google.status = 'unavailable'
    return false
  }
  if (tokenIsLive()) return true

  google.status = 'connecting'
  google.error = null

  const loaded = await loadGsi()
  const oauth2 = window.google?.accounts?.oauth2

  if (!loaded || !oauth2) {
    google.status = wasConnected() ? 'expired' : 'off'
    google.error = strings.google.scriptFailed
    return false
  }

  const token = await new Promise<string | null>((resolve) => {
    let settled = false
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    client ??= oauth2.initTokenClient({
      client_id: googleClientId,
      scope: GOOGLE_SCOPE,
      callback: (response) => {
        if (response.access_token) {
          google.expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000
          finish(response.access_token)
          return
        }
        google.error =
          response.error === 'access_denied'
            ? strings.google.denied
            : strings.google.tokenFailed
        finish(null)
      },
      // Fires when the popup is closed or blocked — which the callback above
      // never hears about, so without this the promise would hang forever and
      // the button would spin until the app was restarted.
      error_callback: () => {
        google.error = strings.google.popupFailed
        finish(null)
      },
    })

    client.requestAccessToken({ prompt: '' })
  })

  if (token === null) {
    accessToken = null
    google.expiresAt = 0
    google.status = wasConnected() ? 'expired' : 'off'
    return false
  }

  accessToken = token
  google.status = 'ready'
  google.error = null
  rememberConnected(true)
  return true
}

/** Forgets the token and the flag. The grant itself is withdrawn at Google. */
export function disconnectGoogle(): void {
  const token = accessToken
  accessToken = null
  client = null
  google.expiresAt = 0
  google.status = 'off'
  google.error = null
  rememberConnected(false)

  // Best effort. If it fails the grant simply stays, which the person can
  // remove at myaccount.google.com — and which the Settings copy says.
  try {
    if (token) window.google?.accounts?.oauth2?.revoke(token)
  } catch {
    // Nothing to do and nothing worth saying.
  }
}

/* -------------------------------------------------------------------------- */
/* Talking to the Calendar API                                                 */
/* -------------------------------------------------------------------------- */

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
}

/**
 * One authenticated request. Never throws — a network failure comes back as
 * `status: 0`, which callers treat exactly like any other failure.
 *
 * A 401 clears the token, so the next attempt asks for a fresh one instead of
 * quietly failing forever with a dead one in hand.
 */
export async function googleFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  if (!tokenIsLive()) {
    google.status = 'expired'
    return { ok: false, status: 401, data: null }
  }

  try {
    const response = await fetch(`${GOOGLE_API}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken ?? ''}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 401 || response.status === 403) {
      accessToken = null
      google.expiresAt = 0
      google.status = 'expired'
      return { ok: false, status: response.status, data: null }
    }

    // 204 and 410 both mean "it isn't there any more", which for a delete is
    // success. Neither has a body to parse.
    if (response.status === 204 || response.status === 410) {
      return { ok: true, status: response.status, data: null }
    }

    const data = (await response.json().catch(() => null)) as T | null
    return { ok: response.ok, status: response.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

/**
 * The id of this member's "Niu" calendar, making it if there isn't one.
 *
 * Stored on their own membership row — a fact about the account, not the
 * person — so the next device and the next app launch find it without making a
 * second one. If the stored id turns out
 * to be gone (they deleted the calendar in Google), a fresh one is made and the
 * old id replaced, rather than every push failing with a 404 forever.
 */
export async function ensureCalendar(): Promise<string | null> {
  const known = google.calendarId

  if (known !== null) {
    const check = await googleFetch<{ id: string }>(`/calendars/${encodeURIComponent(known)}`)
    if (check.ok) return known
    // 401 means the token died, not that the calendar did. Leave it alone.
    if (check.status === 401 || check.status === 403 || check.status === 0) return null
  }

  const made = await googleFetch<{ id: string }>('/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: NIU_CALENDAR_SUMMARY,
      description: NIU_CALENDAR_DESCRIPTION,
      timeZone: deviceTimeZone(),
    }),
  })

  if (!made.ok || !made.data?.id) {
    google.error = strings.google.calendarFailed
    return null
  }

  await saveCalendarId(made.data.id)
  return made.data.id
}
