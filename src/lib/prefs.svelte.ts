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

import { strings } from './strings'

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

/**
 * The four orderings with their labels, in the order they are offered.
 *
 * Lives here rather than in either screen because there are now two controls
 * for the same preference — the one on the shopping list and the one in
 * Settings — and two hand-kept copies of this list is exactly how they end up
 * naming the same mode two different things.
 */
export const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: 'shop-order', label: strings.prefs.sortShopOrder },
  { id: 'recent', label: strings.prefs.sortRecent },
  { id: 'category', label: strings.prefs.sortCategory },
  { id: 'most-bought', label: strings.prefs.sortMostBought },
]

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
  /**
   * Whether a new event starts with "ask the others to confirm" already on.
   *
   * Off by default (Marçal, round 13). Confirmation is the feature the calendar
   * is really for, but most of what goes on a family calendar is a statement
   * rather than a question — and a switch that is on by default turns every
   * dentist appointment into something the other person has to answer.
   */
  askConfirm: boolean
}

const DEFAULTS: StoredPrefs = {
  iconStyle: 'line',
  viewMode: 'grid-4',
  sortMode: 'shop-order',
  shopId: null,
  weekNumbers: true,
  askConfirm: false,
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
      askConfirm: obj.askConfirm === true,
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
  askConfirm = $state<boolean>(DEFAULTS.askConfirm)
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
        askConfirm: prefs.askConfirm,
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
  prefs.askConfirm = stored.askConfirm
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

/** Whether the switch in the event sheet starts on. Not whether it exists. */
export function setAskConfirm(on: boolean): void {
  prefs.askConfirm = on
  save()
}
