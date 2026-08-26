/*
 * URL resolution that's easy to get subtly wrong — see resolveBase below. Pure
 * string math, no DOM, so it can be unit tested instead of only caught by
 * clicking through a real sign-in on a real phone.
 */

/**
 * Resolves a *relative* base path (e.g. Vite's `BASE_URL`, `'./'`) against the
 * page's current location, and returns it as an absolute URL with no hash or
 * search string.
 *
 * The trap this exists to avoid: resolving against `location.origin` instead of
 * the full `location.href`. An origin has no path on it, so `new URL('./',
 * origin)` collapses straight to the domain root and silently drops whatever
 * folder the app is actually served from — which is exactly the bug that sent
 * Niu's Google sign-in to the wrong redirect URL.
 */
export function resolveBase(base: string, currentHref: string): string {
  const resolved = new URL(base, currentHref)
  resolved.hash = ''
  resolved.search = ''
  return resolved.toString()
}
