/*
 * Niu's service worker. It caches nothing, and since round 17 it shows
 * notifications.
 *
 * Two jobs, and caching is still not one of them:
 *
 *   1. **Existing at all.** Chrome on Android will only offer "Install app"
 *      for a site that has a registered service worker with a fetch handler.
 *      Offline support is deliberately deferred (NIU.md §9) because Niu is
 *      server-first — a stale shopping list is worse than no shopping list.
 *   2. **Receiving a push.** A notification that arrives while the app is
 *      closed can only be drawn by a worker: there is no page to draw it. This
 *      is the half of round 17 that runs on the phone; the other half is the
 *      Edge Function that sends it.
 *
 * The fetch handler below is intentionally empty. It never calls
 * respondWith(), which means every request goes to the network exactly as it
 * would with no worker at all. Chrome recognises the empty handler and skips
 * starting the worker for it, so it costs nothing at runtime.
 *
 * When offline caching does arrive, this is the file it goes in — and the
 * CACHE_VERSION below is what gets bumped to evict the old one.
 *
 * ## Plain JavaScript, on purpose
 *
 * This file is served as-is from /public and never goes through Vite, so it
 * cannot import anything from src/ and gets no type checking. Keep it small
 * and keep the logic in modules that can be tested.
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

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

/*
 * The Edge Function sends `{ title, body, tag, action? }` as JSON. Everything a
 * person reads was looked up in the database there rather than sent by the
 * phone that caused it — see the note at the top of
 * supabase/functions/niu-push/index.ts.
 *
 * `action`, present only on "somebody is asking you to confirm", carries a
 * `confirmUrl` and a signed `token` — not something this worker can read or
 * needs to; it is only ever handed back unchanged in notificationclick below.
 * Its presence is what puts Yes / Can't buttons on the notification (round
 * 17.1: answering without opening the app).
 *
 * Chrome requires that a push results in a visible notification: a handler that
 * decides not to show one gets the browser's own "this site was updated in the
 * background" instead, which is worse than anything we would have written. So
 * every path here shows something, including the path where the payload is
 * missing or unreadable.
 */
self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    // Not JSON. Fall through to the generic notification below.
  }

  const title = message.title || 'Niu'
  const body = message.body || 'Something needs you in the calendar.'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: './icons/icon-192.png',
      badge: './icons/badge-96.png',
      // Replaces an earlier notification about the same event rather than
      // stacking a second one under it. Asked twice because the time moved,
      // you want the new question, not both.
      tag: message.tag || 'niu',
      renotify: Boolean(message.tag),
      // A calendar question is not urgent enough to override a silent phone,
      // but it is worth a buzz when the phone is not silent.
      vibrate: [80, 40, 80],
      // Carried through to notificationclick untouched. Only an "ask" push
      // sets it, which is what makes the two buttons below appear only there.
      data: message.action || null,
      actions: message.action
        ? [
            { action: 'yes', title: 'Yes' },
            { action: 'no', title: "Can't" },
          ]
        : [],
    }),
  )
})

/*
 * Tapping the body of the notification opens the calendar. Tapping Yes or
 * Can't answers straight from here, no window opened — that's the whole point
 * of round 17.1. If that background answer fails for any reason (offline,
 * expired token, the function being unreachable), it falls back to opening the
 * app instead of leaving the tap looking like it did nothing.
 *
 * Focusing a window that is already open matters more than it sounds: opening a
 * second one leaves the person with two copies of an installed app and no idea
 * which is which. So we look for an existing window first and only open one as
 * a last resort.
 *
 * The URL is built from the worker's own scope rather than hard-coded, for the
 * same reason vite.config.ts uses a relative base — nothing in this project
 * knows the folder it is served from.
 */
async function openCalendar() {
  const url = self.registration.scope + '#/calendar'
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

  for (const client of windows) {
    // Same app, already open: bring it forward and move it to the calendar.
    if (client.url.startsWith(self.registration.scope)) {
      if ('navigate' in client) await client.navigate(url)
      if ('focus' in client) return await client.focus()
      return
    }
  }

  await self.clients.openWindow(url)
}

/** Answers straight from the notification. Never throws — see the caller. */
async function answerFromNotification(action, data) {
  const response = await fetch(data.confirmUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: data.token, answer: action }),
  })
  if (!response.ok) throw new Error(`confirm failed: ${response.status}`)
  return await response.json()
}

self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event
  notification.close()

  if (action !== 'yes' && action !== 'no') {
    event.waitUntil(openCalendar())
    return
  }

  event.waitUntil(
    (async () => {
      try {
        const result = await answerFromNotification(action, notification.data)
        // Visible proof the tap worked, without ever opening the app.
        await self.registration.showNotification(result.title || 'Niu', {
          body:
            action === 'yes'
              ? `You said Yes${result.when ? ` · ${result.when}` : ''}`
              : `You said you can't${result.when ? ` · ${result.when}` : ''}`,
          icon: './icons/icon-192.png',
          badge: './icons/badge-96.png',
          tag: notification.tag,
        })
      } catch {
        // The answer didn't go through silently — open the app so the person
        // can still answer, rather than leaving the tap looking like it worked.
        await openCalendar()
      }
    })(),
  )
})
