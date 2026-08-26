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

/** Line drawings, or the phone's own emoji where an item has one. */
export type IconStyle = 'line' | 'colour'

/** How many tiles across, or a single-column list. */
export type ViewMode = 'grid-4' | 'grid-3' | 'list'

const STORAGE_KEY = 'niu.prefs'

interface StoredPrefs {
  iconStyle: IconStyle
  viewMode: ViewMode
}

const DEFAULTS: StoredPrefs = { iconStyle: 'line', viewMode: 'grid-4' }

function isIconStyle(v: unknown): v is IconStyle {
  return v === 'line' || v === 'colour'
}

function isViewMode(v: unknown): v is ViewMode {
  return v === 'grid-4' || v === 'grid-3' || v === 'list'
}

function read(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS
    const obj = parsed as Record<string, unknown>
    return {
      iconStyle: isIconStyle(obj.iconStyle) ? obj.iconStyle : DEFAULTS.iconStyle,
      viewMode: isViewMode(obj.viewMode) ? obj.viewMode : DEFAULTS.viewMode,
    }
  } catch {
    // Unreadable, unparseable, or storage refused. Defaults are always valid.
    return DEFAULTS
  }
}

class PrefsState {
  iconStyle = $state<IconStyle>(DEFAULTS.iconStyle)
  viewMode = $state<ViewMode>(DEFAULTS.viewMode)
}

export const prefs = new PrefsState()

function save(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ iconStyle: prefs.iconStyle, viewMode: prefs.viewMode }),
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
}

export function setIconStyle(style: IconStyle): void {
  prefs.iconStyle = style
  save()
}

export function setViewMode(mode: ViewMode): void {
  prefs.viewMode = mode
  save()
}
