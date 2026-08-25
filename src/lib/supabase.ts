/*
 * The one Supabase client for the whole app.
 *
 * Two options here are not defaults and both matter:
 *
 * 1. flowType: 'pkce'. The library defaults to the *implicit* flow, which sends
 *    you back from Google with the session in the URL hash
 *    (`#access_token=…`). Niu routes on the hash — `#/shopping` — so an
 *    implicit callback would land on top of our router and the app would open
 *    on a garbage route. PKCE comes back as `?code=…` in the query string
 *    instead, and the library strips it with history.replaceState once the
 *    session is exchanged, leaving the hash untouched.
 *
 * 2. storageKey: 'niu.auth'. The default is 'supabase.auth.token'. Everything
 *    Niu keeps on the device is prefixed `niu.` and these keys are permanent —
 *    renaming this one later would sign everybody out.
 *
 * `supabase` is null when the project isn't configured yet. Every caller has to
 * handle that, which is deliberate: it is the same branch as "the backend is
 * unreachable", so handling it once covers both.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isConfigured, supabaseAnonKey, supabaseUrl } from './config'

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        storageKey: 'niu.auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/**
 * Where Google sends you back to. It has to be the app's own folder with no
 * hash, and it must be listed in Supabase under Authentication → URL
 * Configuration → Redirect URLs, or the sign-in will bounce.
 */
export function authRedirectTo(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}
