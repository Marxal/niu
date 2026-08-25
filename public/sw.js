/*
 * Niu's service worker. It caches nothing.
 *
 * Its whole job is to exist: Chrome on Android will only offer "Install app"
 * for a site that has a registered service worker with a fetch handler. Offline
 * support is deliberately deferred (NIU.md §9) because Niu is server-first —
 * a stale shopping list is worse than no shopping list.
 *
 * So the fetch handler below is intentionally empty. It never calls
 * respondWith(), which means every request goes to the network exactly as it
 * would with no worker at all. Chrome recognises the empty handler and skips
 * starting the worker for it, so it costs nothing at runtime.
 *
 * When offline caching does arrive, this is the file it goes in — and the
 * CACHE_VERSION below is what gets bumped to evict the old one.
 */

const CACHE_VERSION = 'niu-v1'

self.addEventListener('install', () => {
  // Take over immediately rather than waiting for every tab to close.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Defensive: if a future version ever caches, this clears anything left
      // behind by an older one.
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

// Required for installability. Deliberately a no-op — see the note above.
self.addEventListener('fetch', () => {})
