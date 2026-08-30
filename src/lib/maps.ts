/*
 * Turning "where" into something you can tap.
 *
 * An event's location is free text — "Escola Sant Jordi", "Carrer Gran 14",
 * sometimes a link somebody pasted in. On a phone, the only thing you ever
 * actually want to do with it is open it in Maps and start walking, so it may
 * as well be a link.
 *
 * Two cases, and telling them apart is the whole job:
 *
 *  - it is already a link — a meeting URL, a venue's own page. Wrapping that in
 *    a Maps search would search Maps for a URL, which finds nothing. Opened as
 *    it is.
 *  - anything else. Handed to Google Maps as a search, which is the documented
 *    Maps URL scheme (`google.com/maps/search/?api=1&query=…`) and the one that
 *    hands off to the Maps app on Android rather than opening a web page.
 *
 * A search rather than a pinned coordinate because Niu never geocodes anything:
 * it does not know where "the school" is, and Maps does. Coordinates typed in
 * by hand work anyway — "41.3874, 2.1686" searches straight to the point.
 *
 * Pure and tested: the phone is not the place to find out that a place name
 * with a `#` in it silently lost half of itself.
 */

const MAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query='

/**
 * Where tapping a location should go, or null if there is nothing to tap.
 *
 * Only http and https count as "already a link". Anything else — a `javascript:`
 * that found its way in, a bare `mailto:` — is treated as text and searched
 * for, which is both safer and closer to what was meant.
 */
export function mapsUrl(location: string | null): string | null {
  const trimmed = location?.trim() ?? ''
  if (trimmed === '') return null

  if (/^https?:\/\/\S/i.test(trimmed)) return trimmed

  // encodeURIComponent, not encodeURI: this is one query parameter's value, and
  // the characters a street address is full of — &, #, +, spaces — all have to
  // survive as themselves rather than as URL punctuation.
  return MAPS_SEARCH + encodeURIComponent(trimmed)
}
