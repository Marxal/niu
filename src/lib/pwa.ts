/*
 * Registers the service worker. That registration is the only reason the worker
 * exists right now — it's what makes Chrome on Android offer "Install app".
 * There is deliberately no caching in it yet (see NIU.md §9); this round only
 * buys the install banner and the icon on the home screen.
 *
 * Fail soft: if registration is refused — private browsing, an unsupported
 * browser, a plain-http origin — the app carries on exactly as a normal website.
 * Nothing here is allowed to reach the user as an error.
 */

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  // The dev server doesn't serve sw.js from /public the way the built site does,
  // and a stale worker during development causes confusing reloads.
  if (import.meta.env.DEV) return

  try {
    // BASE_URL is '/niu-/' in production, so the worker's scope covers the app
    // and nothing else on marxal.github.io.
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    })
  } catch {
    // Intentionally silent. An app without a worker is still a working app.
  }
}
