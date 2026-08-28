/*
 * "Yes, I know we've got that" — What's home rows pushed off the sheet.
 *
 * Round 15. The What's home sheet already had one answer to each row ("out of
 * it", which puts the thing on the shopping list) and Marçal wanted the other
 * one: a way to get rid of a row you *agree* with. Something you bought a week
 * ago and know perfectly well is in the cupboard has nothing to tell you, and a
 * sheet you have to read past the same six known things to reach the useful
 * ones is a sheet you stop opening.
 *
 * ## Why this is device-local rather than a table
 *
 * A dismissal is not a fact about the household, it is a fact about the person
 * looking: *I have read this row.* Both people can reasonably have their own
 * answer to it, the same argument prefs.svelte.ts makes about density and shop.
 * It also costs nothing and works instantly, which matters for a gesture you
 * make six times in a row.
 *
 * Muting a *suggestion* is the opposite call — that one is a household decision
 * and lives in the database (0015_suggestion_mutes.sql). The difference is what
 * the two mean: "stop offering us this, ever" is something you decide together;
 * "I have looked at this row" is not.
 *
 * ## Why it expires on its own
 *
 * Each dismissal is stored **against the purchase it was about** — the item's
 * `last_bought_at` at the moment it was swiped. Buy the thing again and that
 * timestamp changes, the stored one no longer matches, and the row comes back
 * by itself. So there is nothing to clean up and no way to permanently blind
 * yourself to an item by accident: the next shop undoes it.
 *
 * Storage key is `niu.athome.dismissed`, and per the storage rule it never
 * changes name however the app is renamed.
 */

const STORAGE_KEY = 'niu.athome.dismissed'

/**
 * A cap, so a household that swipes a lot doesn't grow this without limit.
 *
 * Two hundred is far more than the sheet ever shows at once; the oldest go
 * first, and the worst case of dropping one is that a row you had dismissed
 * comes back.
 */
const MAX_ENTRIES = 200

/** itemId → the `last_bought_at` it was dismissed against. */
type Dismissals = Record<string, string>

function read(): Dismissals {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}

    const out: Dismissals = {}
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === 'string') out[id] = at
    }
    return out
  } catch {
    // Unreadable, unparseable, or storage refused outright in a privacy mode.
    // An empty record is always valid — the sheet simply shows everything.
    return {}
  }
}

function write(value: Dismissals): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Nothing here is worth breaking a swipe for.
  }
}

class DismissedState {
  /** Kept in a rune so the sheet redraws the moment a row is swiped. */
  entries = $state<Dismissals>({})
}

export const dismissed = new DismissedState()

/** Reads what this device remembers. Called once, at start-up. */
export function loadDismissed(): void {
  dismissed.entries = read()
}

/**
 * Is this row one the user has already waved away *for this purchase*?
 *
 * `lastBoughtAt` is what makes it self-expiring: a dismissal recorded against
 * one shop says nothing about the next.
 */
export function isDismissed(itemId: string, lastBoughtAt: string | null): boolean {
  if (lastBoughtAt === null) return false
  return dismissed.entries[itemId] === lastBoughtAt
}

/** Records a swipe. A no-op for an item with no purchase behind it. */
export function dismiss(itemId: string, lastBoughtAt: string | null): void {
  if (lastBoughtAt === null) return

  const next = { ...dismissed.entries, [itemId]: lastBoughtAt }

  // Oldest first out. Object key order is insertion order for string keys,
  // which is exactly the order they were swiped in.
  const keys = Object.keys(next)
  if (keys.length > MAX_ENTRIES) {
    for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) delete next[key]
  }

  dismissed.entries = next
  write(next)
}

/** Puts one back — the Undo behind the message after a swipe. */
export function undismiss(itemId: string): void {
  const next = { ...dismissed.entries }
  delete next[itemId]
  dismissed.entries = next
  write(next)
}
