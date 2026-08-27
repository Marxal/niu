/*
 * Which screen is showing, derived from the URL hash. No Svelte, no DOM, no
 * network — just string in, route out, so it can be unit tested.
 *
 * Why the hash and not real paths: the app is hosted on GitHub Pages, which is a
 * plain static file server. A request for /niu-/meals would 404 because there is
 * no meals.html on disk. Hash routes never hit the server, so refreshing the page
 * or reopening the installed app on any screen just works. It also means the
 * back button moves between tabs, which is what an Android user expects.
 *
 * Anything unrecognised falls back to Shopping rather than erroring — that's the
 * "fail soft" rule applied to routing.
 *
 * Since round 10 a route can have one sub-segment: `#/meals` is the planner and
 * `#/meals/dishes` is the dish library behind it. It is a second segment rather
 * than a fourth tab because the library is the raw material for the plan, not a
 * peer of it — and because going back from it should return you to the plan,
 * which the hash history does for free.
 */

import { strings } from './strings'

export type TabId = 'shopping' | 'meals' | 'calendar'
export type RouteId = TabId | 'settings'

export const DEFAULT_ROUTE: RouteId = 'shopping'

export interface Tab {
  readonly id: TabId
  /** Shown under the icon in the bottom nav. Keep it to one short word. */
  readonly label: string
  /** Read out by screen readers on the nav button. */
  readonly title: string
}

export const TABS: readonly Tab[] = [
  { id: 'shopping', ...strings.tabs.shopping },
  { id: 'meals', ...strings.tabs.meals },
  { id: 'calendar', ...strings.tabs.calendar },
]

const KNOWN_ROUTES: readonly RouteId[] = [...TABS.map((t) => t.id), 'settings']

function isRoute(value: string): value is RouteId {
  return (KNOWN_ROUTES as readonly string[]).includes(value)
}

/** The segments of a hash, lowercased and stripped of slashes and queries. */
function segments(hash: string): string[] {
  return hash
    .replace(/^#/, '')
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
    .split('/')
    .filter((part) => part !== '')
}

/**
 * Turn a `location.hash` into a route id.
 * Accepts '', '#', '#/meals', '#meals', '#/meals/', '#/Meals?x=1'.
 */
export function parseRoute(hash: string): RouteId {
  const first = segments(hash)[0] ?? ''
  return isRoute(first) ? first : DEFAULT_ROUTE
}

/**
 * The bit after the route, or null. `#/meals/dishes` → 'dishes'.
 *
 * Unvalidated on purpose: a screen knows which sub-routes it has and any other
 * value should read as "none of them", which is what a plain string comparison
 * at the call site does. Validating here would mean this file holding a list of
 * every screen's internals.
 */
export function parseSubRoute(hash: string): string | null {
  return segments(hash)[1] ?? null
}

/** The href to put on a link or nav button for a route. */
export function hrefFor(route: RouteId): string {
  return `#/${route}`
}
