/*
 * How much of the screen the phone's on-screen keyboard is covering.
 *
 * The problem this solves: a bottom sheet is `position: fixed; bottom: 0`, and
 * "the bottom" means the bottom of the *layout* viewport. Android's keyboard
 * doesn't change the layout viewport by default — it slides over the top of it —
 * so the sheet's Done button ends up underneath the keyboard, unreachable, which
 * is exactly what happened with the item detail sheet.
 *
 * There are two halves to the fix and both are here on purpose:
 *
 *  1. `interactive-widget=resizes-content` in index.html's viewport meta. This
 *     asks Chrome to shrink the layout viewport when the keyboard opens, which
 *     makes `bottom: 0` mean "above the keyboard" for free. It is the real fix
 *     and it covers Chrome on Android, which is the phone this app is for.
 *
 *  2. This module, for everything that ignores the meta tag. It measures the gap
 *     between the layout viewport and the visual one and publishes it as
 *     `--keyboard-inset` on <html>, so a sheet can lift itself by that much.
 *
 * They don't fight: where the meta tag works, the two viewports stay the same
 * height and the measurement here is zero, so nothing is lifted twice.
 *
 * No state is exported. This writes one CSS variable and that is the whole API —
 * a component that cares reads it in CSS rather than re-rendering on every frame
 * of the keyboard animation.
 */

const VAR = '--keyboard-inset'

function measure(): void {
  const view = window.visualViewport
  if (!view) return

  // The visual viewport is what you can actually see; window.innerHeight is the
  // layout box. The keyboard is the difference, minus however far the page has
  // been scrolled up inside it.
  const covered = window.innerHeight - view.height - view.offsetTop

  // Tiny differences show up from browser chrome and rounding. Under a finger's
  // worth of pixels is not a keyboard.
  const inset = covered > 24 ? Math.round(covered) : 0

  document.documentElement.style.setProperty(VAR, `${inset}px`)
}

/**
 * Starts following the keyboard. Returns a teardown function, so an `$effect`
 * can call it directly.
 */
export function watchKeyboard(): () => void {
  const view = window.visualViewport
  if (!view) {
    // No visualViewport: nothing can be measured, and 0 is the honest answer.
    document.documentElement.style.setProperty(VAR, '0px')
    return () => {}
  }

  measure()
  view.addEventListener('resize', measure)
  view.addEventListener('scroll', measure)

  return () => {
    view.removeEventListener('resize', measure)
    view.removeEventListener('scroll', measure)
    document.documentElement.style.setProperty(VAR, '0px')
  }
}
