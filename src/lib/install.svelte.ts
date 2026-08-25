/*
 * Holds Chrome's install prompt so Settings can offer an "Install" button.
 *
 * The tricky bit: Chrome fires `beforeinstallprompt` once, early, and if you
 * don't call preventDefault() on it you lose the chance to trigger the prompt
 * yourself later. So we grab the event at startup and park it here. The saved
 * event can only be used once — after that Chrome refuses, so we drop it.
 *
 * This file is `.svelte.ts` because it uses runes ($state); that extension is
 * what tells the Svelte compiler to process a plain module.
 */

/** Not in TypeScript's DOM types — it's Chromium-only, so we describe it here. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null

class InstallState {
  /** True when Chrome has offered us a prompt we haven't used yet. */
  available = $state(false)
  /** True when the app is already running from the home screen. */
  installed = $state(false)
}

export const install = new InstallState()

export function watchInstallPrompt(): void {
  install.installed = window.matchMedia('(display-mode: standalone)').matches

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    install.available = true
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
    install.available = false
    install.installed = true
  })
}

/** Shows Chrome's install sheet. Safe to call when nothing is pending. */
export async function promptInstall(): Promise<void> {
  const event = deferred
  if (!event) return

  deferred = null
  install.available = false

  try {
    await event.prompt()
  } catch {
    // The prompt can be refused if it was already consumed. Nothing to show.
  }
}
