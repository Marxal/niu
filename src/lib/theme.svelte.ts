/*
 * Light / dark / follow-the-phone.
 *
 * Three states, not two. "System" is the default and is genuinely different
 * from either fixed choice: it has to keep tracking the phone if the phone
 * switches at sunset. So the stored value is one of three, and "system" is
 * represented by removing the attribute rather than by writing a guess into it.
 *
 * How it reaches the CSS: `data-theme` on <html>, read by tokens.css. When the
 * choice is "system" the attribute is absent, and the plain
 * prefers-color-scheme media query takes over.
 *
 * The key is `niu.theme` — permanent, per the storage-key rule. Reading and
 * writing are both wrapped: localStorage throws outright in some privacy modes,
 * and a theme preference is never worth breaking the app for.
 */

export type ThemeChoice = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'niu.theme'

function isChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark'
}

function read(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isChoice(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

class ThemeState {
  /** What the user picked. 'system' means "whatever the phone says". */
  choice = $state<ThemeChoice>('system')
  /** What is actually on screen right now — never 'system'. */
  resolved = $state<'light' | 'dark'>('light')
}

export const theme = new ThemeState()

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement

  if (choice === 'system') {
    // Absent, not "system" — the CSS falls through to the media query.
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', choice)
  }

  theme.resolved = choice === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : choice

  // Keep the Android status bar in step. index.html ships two theme-color tags
  // for the media-query case; once a choice is made they'd fight it, so the
  // matching one is pinned and the other disabled.
  for (const tag of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const forDark = tag.media.includes('dark')
    if (choice === 'system') {
      tag.media = forDark ? '(prefers-color-scheme: dark)' : '(prefers-color-scheme: light)'
    } else {
      // `not all` reliably disables a meta tag without removing it.
      tag.media = forDark === (choice === 'dark') ? '' : 'not all'
    }
  }
}

/** Applies the stored choice and keeps following the phone while on 'system'. */
export function watchTheme(): () => void {
  theme.choice = read()
  apply(theme.choice)

  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = () => {
    if (theme.choice === 'system') apply('system')
  }
  query.addEventListener('change', onSystemChange)

  return () => query.removeEventListener('change', onSystemChange)
}

/** Records a choice and applies it immediately. */
export function setTheme(choice: ThemeChoice): void {
  theme.choice = choice
  apply(choice)

  try {
    localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Private mode, or storage full. The choice still applies for this session.
  }
}
