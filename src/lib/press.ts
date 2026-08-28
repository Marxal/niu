/*
 * Holding a finger on something to open a shortcut.
 *
 * The meal planner has had a long press since round 10 — hold a card and it
 * lifts — but that one is the front half of a drag and lives inside
 * drag.svelte.ts with three hundred lines of carrying and dropping behind it.
 * The calendar wants only the first half: hold a day in the month grid and the
 * "new event" sheet opens on it (Marçal, round 13). Sharing the planner's
 * machinery to get that would mean importing a drag to use a timer.
 *
 * ## The three things it has to get right
 *
 * **A hold is not a scroll.** The timer is cancelled the moment the finger
 * moves more than a few pixels, so a flick that starts on a Tuesday never opens
 * Tuesday. That is also what keeps it out of the swipe's way: a sideways drag
 * across the grid moves past MOVE_TOLERANCE almost immediately, and by then
 * this has already given up.
 *
 * **A hold is also a tap**, and the tap arrives *after* the press has acted.
 * By then a sheet has opened over the thing that was held, so the click lands
 * on the sheet's backdrop — whose job is to close it. Hold a day, and the sheet
 * would open and shut in the same gesture.
 *
 * Swallowing that click on the element that was held is therefore not enough:
 * the click never reaches it. So the press arms a one-shot listener on the
 * *window*, in the capture phase, which eats whatever the next click turns out
 * to be. It disarms itself after DEAD_CLICK_MS in case no click ever comes —
 * some builds do not send one — because a listener waiting forever would
 * eventually eat a real tap.
 *
 * **Android's context menu.** A long press on a touch screen raises it on some
 * builds, which would cover the sheet. Suppressed while a press is armed —
 * the same guard drag.svelte.ts needs for the same reason.
 *
 * Pointer events rather than touch events, so a finger, a mouse and a stylus
 * take one code path.
 */

/** Long enough not to fire while scrolling, short enough not to feel stuck.
 *  The same 380ms the planner's drag uses, so the two feel like one gesture. */
const PRESS_MS = 380

/** How far the finger may wander before it counts as a move rather than a hold. */
const MOVE_TOLERANCE = 8

/** A short buzz, where the phone has one, so the hold has a moment. */
const BUZZ_MS = 12

/** How long to wait for the click that follows a lift before giving up on it.
 *  It normally arrives within a frame or two; this is generous on purpose. */
const DEAD_CLICK_MS = 500

export interface LongPressOptions {
  onPress: () => void
  /** Off while something else owns the finger. */
  enabled?: boolean
}

export function longPress(node: HTMLElement, options: LongPressOptions) {
  let current = options
  let timer = 0
  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let disarm = 0

  /** Eats exactly one click, wherever it lands. See the header. */
  function swallowOnce(event: MouseEvent): void {
    unswallow()
    event.preventDefault()
    event.stopPropagation()
  }

  function unswallow(): void {
    if (disarm === 0) return
    window.clearTimeout(disarm)
    disarm = 0
    window.removeEventListener('click', swallowOnce, true)
  }

  function cancel(): void {
    if (timer !== 0) {
      window.clearTimeout(timer)
      timer = 0
    }
    pointerId = null
  }

  function fire(): void {
    timer = 0
    pointerId = null

    unswallow()
    window.addEventListener('click', swallowOnce, true)
    disarm = window.setTimeout(unswallow, DEAD_CLICK_MS)

    // Feedback that the hold registered, on the phones that can. Wrapped
    // because Safari and some Android builds throw rather than no-op.
    try {
      navigator.vibrate?.(BUZZ_MS)
    } catch {
      // A gesture is never worth an error.
    }
    current.onPress()
  }

  function onPointerDown(event: PointerEvent): void {
    if (current.enabled === false || pointerId !== null) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    timer = window.setTimeout(fire, PRESS_MS)
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return
    const moved =
      Math.abs(event.clientX - startX) > MOVE_TOLERANCE ||
      Math.abs(event.clientY - startY) > MOVE_TOLERANCE
    if (moved) cancel()
  }

  function onEnd(): void {
    cancel()
  }

  function onContextMenu(event: Event): void {
    if (timer !== 0 || disarm !== 0) event.preventDefault()
  }

  node.addEventListener('pointerdown', onPointerDown)
  node.addEventListener('pointermove', onPointerMove)
  node.addEventListener('pointerup', onEnd)
  node.addEventListener('pointercancel', onEnd)
  node.addEventListener('pointerleave', onEnd)
  node.addEventListener('contextmenu', onContextMenu)

  return {
    update(next: LongPressOptions) {
      current = next
    },
    destroy() {
      cancel()
      unswallow()
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', onEnd)
      node.removeEventListener('pointercancel', onEnd)
      node.removeEventListener('pointerleave', onEnd)
      node.removeEventListener('contextmenu', onContextMenu)
    },
  }
}
