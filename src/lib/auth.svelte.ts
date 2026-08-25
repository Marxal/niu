/*
 * Who is signed in, as reactive state the whole app reads.
 *
 * The session comes from exactly one place: Supabase's onAuthStateChange
 * listener. It fires an INITIAL_SESSION event by itself as soon as it has
 * looked in storage, so there is no separate getSession() call to race with it
 * — subscribing is all it takes to go from 'loading' to a real answer.
 *
 * Statuses, and why there are four:
 *   loading      – we genuinely don't know yet; show a neutral screen
 *   unconfigured – no Supabase project wired up. The app stays browsable so an
 *                  automatic deploy can never leave a blank site behind.
 *   signed-out   – configured, nobody signed in; show the sign-in screen
 *   signed-in    – normal operation
 *
 * Fail soft: a sign-in that fails sets `error` and returns. Nothing here throws
 * at the user, and no Supabase error object ever reaches the UI — only a short
 * sentence they can act on.
 */

import { isConfigured } from './config'
import { strings } from './strings'
import { authRedirectTo, supabase } from './supabase'

export type AuthStatus = 'loading' | 'unconfigured' | 'signed-out' | 'signed-in'

class AuthState {
  status = $state<AuthStatus>(isConfigured ? 'loading' : 'unconfigured')
  /** Shown in Settings so you can tell which account you're on. */
  email = $state<string | null>(null)
  userId = $state<string | null>(null)
  /** A short, already-friendly message. Null when nothing is wrong. */
  error = $state<string | null>(null)
  /** True between tapping the button and the browser leaving for Google. */
  busy = $state(false)
}

export const auth = new AuthState()

/**
 * Starts listening for sign-in state. Call once, at boot.
 * Returns a function that stops listening — used by the app shell's effect.
 */
export function watchAuth(): () => void {
  if (!supabase) return () => {}

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    auth.userId = session?.user.id ?? null
    auth.email = session?.user.email ?? null
    auth.status = session ? 'signed-in' : 'signed-out'
    // Any successful state change means the previous complaint is stale.
    if (session) auth.error = null
    auth.busy = false
  })

  return () => data.subscription.unsubscribe()
}

/** Sends the browser to Google. On success this page is replaced entirely. */
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) return

  auth.busy = true
  auth.error = null

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectTo() },
  })

  if (error) {
    auth.busy = false
    auth.error = strings.auth.signInFailed
  }
}

/** Signs out on this device. */
export async function signOut(): Promise<void> {
  if (!supabase) return

  auth.error = null
  const { error } = await supabase.auth.signOut()

  if (error) {
    auth.error = strings.auth.signOutFailed
    return
  }

  // onAuthStateChange will flip the status; clear these now so nothing stale
  // flashes on screen in the meantime.
  auth.userId = null
  auth.email = null
}
