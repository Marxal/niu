/*
 * The two bits of app chrome a screen sometimes needs to get out of the way.
 *
 * Right now that is one thing: **the bottom nav, while a search is running.**
 *
 * The nav is a row of the shell's grid rather than something floating over it,
 * and `interactive-widget=resizes-content` (see keyboard.ts) shrinks the layout
 * viewport when the keyboard opens — so the nav rides up and sits on top of the
 * keyboard, taking 64px out of the little that is left. Marçal, round 14:
 * *"there's no need to carry up the bottom nav when searching is active."*
 * He is right: while you are typing a search you are not going to change tab,
 * and those 64px are the difference between three rows of results and two.
 *
 * A module of `$state` rather than props threaded through App.svelte, because
 * the screen that knows a search is running is three components below the nav
 * and has no other reason to talk to it.
 *
 * **Every screen that sets this must put it back.** An `$effect` returning
 * `() => setNavHidden(false)` does it for free on unmount, which is what the
 * shopping list does — a tab you cannot leave would be a much worse bug than
 * a nav in the way.
 */

class ShellState {
  /** True while the bottom nav should be out of the way. */
  navHidden = $state(false)
}

export const shell = new ShellState()

export function setNavHidden(hidden: boolean): void {
  shell.navHidden = hidden
}
