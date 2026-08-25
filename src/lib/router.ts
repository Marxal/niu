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
 */

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
  { id: 'shopping', label: 'Compra', title: 'Llista de la compra' },
  { id: 'meals', label: 'Menús', title: 'Planificador de menús' },
  { id: 'calendar', label: 'Calendari', title: 'Calendari compartit' },
]

const KNOWN_ROUTES: readonly RouteId[] = [...TABS.map((t) => t.id), 'settings']

function isRoute(value: string): value is RouteId {
  return (KNOWN_ROUTES as readonly string[]).includes(value)
}

/**
 * Turn a `location.hash` into a route id.
 * Accepts '', '#', '#/meals', '#meals', '#/meals/', '#/Meals?x=1'.
 */
export function parseRoute(hash: string): RouteId {
  const cleaned = hash
    .replace(/^#/, '')
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()

  // Only the first segment matters for now; deeper paths arrive in later rounds.
  const first = cleaned.split('/')[0] ?? ''
  return isRoute(first) ? first : DEFAULT_ROUTE
}

/** The href to put on a link or nav button for a route. */
export function hrefFor(route: RouteId): string {
  return `#/${route}`
}
