/*
 * Swiping a row off a list.
 *
 * There are two sideways gestures in the app already and neither one fits here.
 * `swipeable` in swipe.ts turns a page — it is about the whole screen, and it
 * gives back a direction rather than removing anything. The swipe inside
 * `draggable` does remove a card, but it is one branch of a gesture that is
 * mostly about lifting and dropping, and it needs a slot to drop into.
 *
 * This is the third, smallest case: a row in a sheet that you push away. It
 * coexists with a long press on the same element — What's home has one — by
 * doing nothing at all until the finger has moved decisively sideways, at which
 * point the press has already been cancelled by its own move tolerance.
 *
 * ## The two lessons that are already written down, applied again
 *
 * **`touch-action: pan-y` on the row, or none of this works.** Round 10.1
 * shipped a swipe that did nothing on a real phone: the element moved a few
 * pixels and sprang back, because `touch-action: auto` lets the compositor
 * claim any drag as a pan and fire `pointercancel`. The action sets it on the
 * node itself rather than trusting a stylesheet to remember, since a swipe that
 * silently does nothing is the exact bug this project has already paid for once.
 *
 * **A `pointercancel` does not rewind.** It ends the gesture where the finger
 * was last actually seen, so a cancel arriving after a long, deliberate swipe
 * still removes the row rather than quietly undoing it.
 *
 * ## Deciding once
 *
 * The gesture is called at the first movement past MOVE_TOLERANCE and never
 * revisited — the rule drag.svelte.ts and swipe.ts both settled on. A finger
 * that starts downwards is scrolling the sheet and stays scrolling however far
 * sideways it wanders.
 *
 * `sidewaysEnough` and `farEnough` are pure and tested; the listeners are
 * tested on the phone.
 */

/** How far the finger must move before the gesture is judged at all. */
const MOVE_TOLERANCE = 10

/** How much more horizontal than vertical it has to be. Matches drag.svelte.ts. */
const SWIPE_BIAS = 1.4

/**
 * How far across the row has to end up to actually go.
 *
 * Smaller than the planner card's 96px, because a row in a sheet is shorter
 * than the screen and a thumb has less room to travel inside it — but still far
 * enough that it cannot happen while scrolling.
 */
const AWAY_DISTANCE = 72

/** How long the row takes to fly off, or to spring back. Matches motion.ts. */
const AWAY_MS = 190

/** Is this movement clearly a sideways one rather than the start of a scroll? */
export function sidewaysEnough(dx: number, dy: number): boolean {
  if (Math.abs(dx) <= MOVE_TOLERANCE && Math.abs(dy) <= MOVE_TOLERANCE) return false
  return Math.abs(dx) > Math.abs(dy) * SWIPE_BIAS
}

/** Has it gone far enough to count as thrown away rather than nudged? */
export function farEnough(dx: number, distance: number = AWAY_DISTANCE): boolean {
  return Math.abs(dx) > distance
}

export interface SwipeAwayOptions {
  /** Called once the row has finished flying off. */
  onAway: () => void
  /** Turns the gesture off without unmounting anything. */
  enabled?: boolean
}

/**
 * Svelte action: `<li use:swipeAway={{ onAway }}>`.
 *
 * The element is moved with `transform` only. Nothing here changes layout, so
 * the rest of the list is completely still while one row is being pushed, and
 * the row's own contents keep working — the "Out of it" button inside a What's
 * home row is still tappable, because a tap never passes the move tolerance.
 */
export function swipeAway(node: HTMLElement, options: SwipeAwayOptions) {
  let current = options

  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let lastX = 0
  let decided: 'none' | 'swipe' | 'scroll' = 'none'

  node.style.touchAction = 'pan-y'

  /** Blocks the page scrolling under a swipe that has already been claimed. */
  const blockTouch = (event: TouchEvent) => event.preventDefault()

  function follow(dx: number, animate: boolean): void {
    node.style.transition = animate ? `transform ${AWAY_MS}ms ease-out` : ''
    node.style.transform = `translateX(${dx}px)`
    // Fades as it goes, so "this is leaving" is legible before it has left.
    node.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / (AWAY_DISTANCE * 3)))
  }

  function reset(animate: boolean): void {
    node.style.transition = animate ? `transform ${AWAY_MS}ms ease-out, opacity ${AWAY_MS}ms ease-out` : ''
    node.style.transform = ''
    node.style.opacity = ''
  }

  function stopListening(): void {
    window.removeEventListener('touchmove', blockTouch)
    window.removeEventListener('pointerup', onEnd)
    window.removeEventListener('pointercancel', onEnd)
  }

  function onPointerDown(event: PointerEvent): void {
    if (current.enabled === false) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    lastX = startX
    decided = 'none'
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return
    if (decided === 'scroll') return

    lastX = event.clientX
    const dx = lastX - startX
    const dy = event.clientY - startY

    if (decided === 'none') {
      if (Math.abs(dx) <= MOVE_TOLERANCE && Math.abs(dy) <= MOVE_TOLERANCE) return

      if (!sidewaysEnough(dx, dy)) {
        // It was the sheet being scrolled all along.
        decided = 'scroll'
        pointerId = null
        return
      }

      decided = 'swipe'
      try {
        node.setPointerCapture?.(event.pointerId)
      } catch {
        // Capture is a convenience; the window listeners below are the promise.
      }
      window.addEventListener('touchmove', blockTouch, { passive: false })
      window.addEventListener('pointerup', onEnd)
      window.addEventListener('pointercancel', onEnd)
    }

    event.preventDefault()
    follow(dx, false)
  }

  /**
   * The end of it: far enough across and the row flies off and is reported
   * gone; short of that it springs back.
   *
   * The report comes *after* the row has left rather than immediately, so what
   * you see is the row going and then the list closing up, rather than the list
   * closing under a row still visibly mid-flight.
   */
  function onEnd(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return

    const dx = lastX - startX
    const gone = decided === 'swipe' && farEnough(dx)

    stopListening()
    if (node.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture(event.pointerId)

    pointerId = null
    decided = 'none'

    if (!gone) {
      reset(true)
      return
    }

    const off = dx > 0 ? node.offsetWidth + 40 : -(node.offsetWidth + 40)
    node.style.transition = `transform ${AWAY_MS}ms ease-in, opacity ${AWAY_MS}ms ease-in`
    node.style.transform = `translateX(${off}px)`
    node.style.opacity = '0'
    window.setTimeout(() => current.onAway(), AWAY_MS)
  }

  node.addEventListener('pointerdown', onPointerDown)
  node.addEventListener('pointermove', onPointerMove)
  node.addEventListener('pointerup', onEnd)
  node.addEventListener('pointercancel', onEnd)

  return {
    update(next: SwipeAwayOptions) {
      current = next
    },
    destroy() {
      stopListening()
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', onEnd)
      node.removeEventListener('pointercancel', onEnd)
    },
  }
}
