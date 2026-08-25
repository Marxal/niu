/*
 * Reads the two Supabase settings out of the build and decides whether Niu is
 * connected to a backend at all.
 *
 * Both values are compiled into the public JavaScript bundle — that's what the
 * VITE_ prefix means, and it is fine: the project URL and the *anon* key are
 * designed to be public. What actually keeps one household's data away from
 * another is Row Level Security in the database, never this file.
 *
 * The important job here is the opposite one: making sure a key that is NOT
 * safe to publish can never be shipped by accident. See looksLikeSecretKey.
 *
 * If either value is missing the app is "not configured" and degrades to the
 * signed-out-but-browsable state rather than crashing. That matters because
 * main deploys automatically: this can land before the Supabase project exists.
 */

/**
 * True if a key is one that must never reach the browser — a service-role key.
 * Pure string inspection, no network, so it's unit tested.
 *
 * Two shapes exist:
 *  - the newer `sb_secret_…` keys, which say so in the prefix
 *  - the legacy JWT keys, where the role is inside the base64 middle segment
 */
export function looksLikeSecretKey(key: string): boolean {
  const trimmed = key.trim()
  if (trimmed === '') return false

  if (trimmed.toLowerCase().startsWith('sb_secret_')) return true

  // Legacy keys are JWTs: header.payload.signature, each base64url.
  const segments = trimmed.split('.')
  if (segments.length !== 3) return false

  const payload = segments[1]
  if (payload === undefined) return false

  try {
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return /"role"\s*:\s*"service_role"/.test(decoded)
  } catch {
    // Not decodable means it isn't a JWT we can judge; treat it as not-secret
    // and let Supabase reject it. Being wrong here only costs a failed request.
    return false
  }
}

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

/**
 * A service-role key in the bundle would hand every visitor full read/write on
 * the whole database, bypassing every RLS policy. Refuse to start rather than
 * ship it. This throws on purpose — it is the one thing worth breaking loudly
 * for, and it can only ever fire on a developer's own build.
 */
if (anonKey !== '' && looksLikeSecretKey(anonKey)) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY looks like a service-role/secret key. ' +
      'That key bypasses Row Level Security and must never be in the bundle. ' +
      'Use the anon / publishable key from Supabase instead.',
  )
}

export const supabaseUrl = url
export const supabaseAnonKey = anonKey

/** False until the two values are filled in; the app stays usable either way. */
export const isConfigured = url !== '' && anonKey !== ''
