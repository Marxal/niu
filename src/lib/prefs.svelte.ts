/*
 * Device-local display preferences: how tiles are drawn and how densely.
 *
 * These are per-device on purpose, not per-household. Two people can reasonably
 * want different densities on different-sized phones, and nothing here changes
 * what is on the list — only how it is shown. Keeping them out of the database
 * also means they apply instantly with no round trip.
 *
 * Stored as one JSON blob under `niu.prefs` — a permanent key, per the storage
 * rule. One key rather than three keeps the reads down and means a future
 * preference doesn't need a new key.
 *
 * Every read and write is wrapped: localStorage throws outright in some privacy
 * modes, and a display preference is never worth breaking the app for.
 */

/**
 * How a tile's picture is drawn:
 *   line   the house line drawings, one colour, the default
 *   emoji  the phone's own emoji where an item has one
 *   inked  OpenMoji's drawings — the same pictures on every phone
 * All three fall back to the line drawing, then to the item's initial.
 */
export type IconStyle = 'line' | 'emoji' | 'inked'

/** How many tiles across, or a single-column list. */
export type ViewMode = 'grid-4' | 'grid-3' | 'list'

/**
 * How the still-to-buy list is ordered. 'shop-order' is the learned one and the
 * default; the other three need no history to work. Defined here rather than in
 * list-view.ts because the choice is a stored preference, not a sorting rule.
 */
export type SortMode = 'shop-order' | 'recent' | 'category' | 'most-bought'

const STORAGE_KEY = 'niu.prefs'

interface StoredPrefs {
  iconStyle: IconStyle
  viewMode: ViewMode
  sortMode: SortMode
  /**
   * Which shop this phone is sorting for. Device-local on purpose: two people
   * can be in two different shops at once, and pushing the choice across would
   * reorder the other person's list mid-aisle. Null means "the main one".
   */
  shopId: string | null
  /**
   * Whether the calendar writes the ISO week number down the side of the month
   * and beside the week.
   *
   * On by default, because this household lives between two countries that both
   * count in weeks — "vecka 36" is how a Swedish school year is written down —
   * and a number you do not need is easier to ignore than one you cannot find.
   * Off is one tap away in Settings for anybody who does not think that way.
   */
  weekNumbers: boolean
}

const DEFAULTS: StoredPrefs = {
  iconStyle: 'line',
  viewMode: 'grid-4',
  sortMode: 'shop-order',
  shopId: null,
  weekNumbers: true,
}

function isIconStyle(v: unknown): v is IconStyle {
  return v === 'line' || v === 'emoji' || v === 'inked'
}

/**
 * Round 5 called the emoji style 'colour'. Renaming it in the type would have
 * quietly reset every phone that had chosen it back to Lines, so the old value
 * is translated on read instead. The storage key itself never changes.
 */
function migrateIconStyle(v: unknown): IconStyle | null {
  if (v === 'colour') return 'emoji'
  return isIconStyle(v) ? v : null
}

function isViewMode(v: unknown): v is ViewMode {
  return v === 'grid-4' || v === 'grid-3' || v === 'list'
}

function isSortMode(v: unknown): v is SortMode {
  return v === 'shop-order' || v === 'recent' || v === 'category' || v === 'most-bought'
}

function read(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS
    const obj = parsed as Record<string, unknown>
    return {
      iconStyle: migrateIconStyle(obj.iconStyle) ?? DEFAULTS.iconStyle,
      viewMode: isViewMode(obj.viewMode) ? obj.viewMode : DEFAULTS.viewMode,
      sortMode: isSortMode(obj.sortMode) ? obj.sortMode : DEFAULTS.sortMode,
      shopId: typeof obj.shopId === 'string' ? obj.shopId : DEFAULTS.shopId,
      // Anything but an explicit false is on, so a phone storing prefs from
      // before this existed keeps the default rather than silently opting out.
      weekNumbers: obj.weekNumbers !== false,
    }
  } catch {
    // Unreadable, unparseable, or storage refused. Defaults are always valid.
    return DEFAULTS
  }
}

class PrefsState {
  iconStyle = $state<IconStyle>(DEFAULTS.iconStyle)
  viewMode = $state<ViewMode>(DEFAULTS.viewMode)
  sortMode = $state<SortMode>(DEFAULTS.sortMode)
  shopId = $state<string | null>(DEFAULTS.shopId)
  weekNumbers = $state<boolean>(DEFAULTS.weekNumbers)
}

export const prefs = new PrefsState()

function save(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        iconStyle: prefs.iconStyle,
        viewMode: prefs.viewMode,
        sortMode: prefs.sortMode,
        shopId: prefs.shopId,
        weekNumbers: prefs.weekNumbers,
      }),
    )
  } catch {
    // The choice still applies for this session.
  }
}

/** Loads stored preferences. Call once, at boot. */
export function loadPrefs(): void {
  const stored = read()
  prefs.iconStyle = stored.iconStyle
  prefs.viewMode = stored.viewMode
  prefs.sortMode = stored.sortMode
  prefs.shopId = stored.shopId
  prefs.weekNumbers = stored.weekNumbers
}

export function setIconStyle(style: IconStyle): void {
  prefs.iconStyle = style
  save()
}

export function setViewMode(mode: ViewMode): void {
  prefs.viewMode = mode
  save()
}

export function setSortMode(mode: SortMode): void {
  prefs.sortMode = mode
  save()
}

/** Null means "whichever shop is the main one". */
export function setShopId(shopId: string | null): void {
  prefs.shopId = shopId
  save()
}

export function setWeekNumbers(on: boolean): void {
  prefs.weekNumbers = on
  save()
}
