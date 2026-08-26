/*
 * What "the icon for this item" can mean, now that there are three ways to draw
 * one.
 *
 * An item's icon starts life as a bare line-drawing slug from icons.ts — that is
 * what the seed catalogue carries and what a newly typed word gets (null, then a
 * letter). On top of that a household can pick something by hand, and since
 * round 6 that pick can be a line drawing, one of the phone's emoji, or an
 * OpenMoji drawing. So the stored value grew a prefix:
 *
 *   'carrot'          the item's own line drawing (no prefix, never written by
 *                     the picker — this is the default it starts from)
 *   'line:carrot'     someone chose that line drawing
 *   'emoji:🥕'        someone chose the phone's own emoji
 *   'inked:🥕'        someone chose the OpenMoji drawing of it
 *
 * The prefix is what separates a default from a choice, and that distinction is
 * the whole point: the icon *style* preference (Lines / Emoji / Inked) may
 * reinterpret a default — showing an item's emoji instead of its line drawing —
 * but it must never override a picture someone deliberately picked for one item.
 *
 * Kept as a pure module with no Svelte in it because both the renderer and the
 * picker need the same parsing, and because a format with a fallback path in it
 * is exactly the kind of thing that should be tested rather than eyeballed.
 */

export type IconKind = 'line' | 'emoji' | 'inked'

export interface IconRef {
  kind: IconKind
  /** A slug for 'line'; the emoji character for the other two. */
  value: string
  /** True when someone picked this by hand, so the style must not override it. */
  explicit: boolean
}

const PREFIXES: readonly IconKind[] = ['line', 'emoji', 'inked']

/**
 * Reads a stored icon value. Null, empty, or anything unrecognised comes back
 * null, which means "draw the item's initial" — a safe way to be wrong.
 */
export function parseIconRef(stored: string | null | undefined): IconRef | null {
  if (!stored) return null

  const colon = stored.indexOf(':')
  if (colon > 0) {
    const prefix = stored.slice(0, colon)
    const value = stored.slice(colon + 1)
    if (PREFIXES.includes(prefix as IconKind) && value !== '') {
      return { kind: prefix as IconKind, value, explicit: true }
    }
    // An unknown prefix is not a slug either — an icon name never has a colon.
    return null
  }

  return { kind: 'line', value: stored, explicit: false }
}

/** The value to store for a hand-picked icon. Always prefixed. */
export function formatIconRef(kind: IconKind, value: string): string {
  return `${kind}:${value}`
}
