/*
 * Swiping sideways to go to the next month or the previous week.
 *
 * ## Why this was deferred, and what changed
 *
 * Round 11 wrote it down as deliberately not done: *"a horizontal swipe on the
 * grid fights Android's own back gesture at the screen edges, which is the one
 * gesture that must keep working."* That is still true, and it is not a reason
 * to have no swipe — it is a description of where the swipe may not start.
 *
 * So a gesture beginning inside EDGE_GUARD of either side of the screen is not
 * ours. We never see it; Android takes it and goes back, exactly as it should.
 * Everywhere else — which is 90% of a 412px screen — is the calendar's.
 *
 * ## The other thing that broke a swipe once already
 *
 * Round 10.1 shipped swipe-to-remove on a planner card and it did nothing on a
 * real phone: the card moved a few pixels and sprang back. The cause was
 * `touch-action` left at `auto`, which promises the compositor nothing, so the
 * compositor claimed every sideways drag as a pan and fired `pointercancel`.
 *
 * The same trap is here, and the same fix: the swiping element declares
 * `touch-action: pan-y`. *Vertical panning is yours, horizontal is mine.* The
 * calendar is a scrolling page, so the vertical half matters as much as the
 * horizontal one — this must never become `touch-action: none`.
 *
 * ## Deciding once
 *
 * The gesture is decided at the first movement past MOVE_TOLERANCE and never
 * revisited, the same rule drag.svelte.ts settled on. A finger that starts
 * downwards is scrolling and stays scrolling however far sideways it wanders,
 * which is what stops a diagonal scroll flicking the month over.
 *
 * `direction` and `isEdgeStart` are pure and tested; everything else in here is
 * listeners and is tested on the phone.
 */

/** How far the finger must move before the gesture is called. */
const MOVE_TOLERANCE = 8

/**
 * How far past the tolerance it must go to count as a swipe rather than a
 * fidget. Roughly a fifth of a 412px screen — far enough to be deliberate,
 * short enough to do with a thumb without shifting your grip.
 */
const COMMIT_DISTANCE = 70

/**
 * How much more horizontal than vertical a swipe has to be.
 *
 * The same 1.4 the planner card uses. A diagonal flick is much more likely to
 * be a scroll than a page turn, and turning the page when somebody meant to
 * scroll loses their place.
 */
const HORIZONTAL_BIAS = 1.4

/**
 * How much of each edge belongs to Android, not to us.
 *
 * 24px is Android's own back-gesture inset (it exposes 20–40 depending on the
 * build and the user's setting, and errs generous). A gesture starting in here
 * is left completely alone — no listener, no preventDefault, nothing to
 * interfere with the system animation.
 */
const EDGE_GUARD = 24

/** How far the content leans while the finger is down, as a share of the drag. */
const FOLLOW = 0.35

/** How far it is allowed to lean, whatever the finger does. */
const FOLLOW_MAX = 44

export type SwipeDirection = 'next' | 'previous' | null

/**
 * Which way a finished gesture went, or null if it was not a swipe.
 *
 * "Next" is a drag to the *left*, because the content moves the way the finger
 * does and the next month arrives from the right — the same direction every
 * paged thing on a phone has used since the first one.
 */
export function direction(dx: number, dy: number): SwipeDirection {
  if (Math.abs(dx) < COMMIT_DISTANCE) return null
  if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) return null
  return dx < 0 ? 'next' : 'previous'
}

/** Whether a gesture started in the strip that belongs to Android's back swipe. */
export function isEdgeStart(x: number, width: number, guard: number = EDGE_GUARD): boolean {
  return x <= guard || x >= width - guard
}

export interface SwipeOptions {
  onNext: () => void
  onPrevious: () => void
  /** Off while something else owns the finger — a sheet, a drag. */
  enabled?: boolean
}

/**
 * A Svelte action: `<div use:swipeable={{ onNext, onPrevious }}>`.
 *
 * The element leans a little way with the finger and springs back, which is the
 * only feedback here — there is no half-drawn next month sliding in behind it.
 * That is a deliberate stop: two months rendered at once for the length of a
 * gesture doubles the work the grid does on every frame, to say something the
 * lean already says.
 */
export function swipeable(node: HTMLElement, options: SwipeOptions) {
  let current = options
  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let gesture: 'undecided' | 'swipe' | 'ignored' = 'undecided'
  /** Eats the click that a finger lifting after a swipe would otherwise fire. */
  let swallowClick = false

  function lean(px: number): void {
    node.style.transition = ''
    node.style.transform = px === 0 ? '' : `translateX(${px}px)`
  }

  function springBack(): void {
    node.style.transition = 'transform 160ms ease-out'
    node.style.transform = ''
  }

  function reset(): void {
    pointerId = null
    gesture = 'undecided'
  }

  function onPointerDown(event: PointerEvent): void {
    if (current.enabled === false || pointerId !== null) return
    // A mouse's secondary buttons are not a swipe; a second finger is a pinch.
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (isEdgeStart(event.clientX, window.innerWidth)) return

    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    gesture = 'undecided'
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId || gesture === 'ignored') return

    const dx = event.clientX - startX
    const dy = event.clientY - startY

    if (gesture === 'undecided') {
      if (Math.abs(dx) < MOVE_TOLERANCE && Math.abs(dy) < MOVE_TOLERANCE) return
      // Decided once and never revisited — see the header.
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) {
        gesture = 'ignored'
        return
      }
      gesture = 'swipe'
      node.setPointerCapture?.(event.pointerId)
    }

    // Damped, and capped, so a long drag says "yes, sideways" without the grid
    // ending up somewhere it cannot come back from.
    const offset = Math.max(-FOLLOW_MAX, Math.min(FOLLOW_MAX, dx * FOLLOW))
    lean(offset)
  }

  function finish(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return

    const wasSwipe = gesture === 'swipe'
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    reset()

    if (!wasSwipe) return

    springBack()
    const went = direction(dx, dy)
    if (went === null) return

    swallowClick = true
    if (went === 'next') current.onNext()
    else current.onPrevious()
  }

  /**
   * A cancel keeps whatever the finger had already earned, exactly as the
   * planner card does. `touch-action: pan-y` should mean this never arrives
   * mid-swipe; if it does, a long deliberate drag still turns the page rather
   * than silently springing back.
   */
  function onPointerCancel(event: PointerEvent): void {
    finish(event)
  }

  function onClick(event: MouseEvent): void {
    if (!swallowClick) return
    swallowClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  node.addEventListener('pointerdown', onPointerDown)
  node.addEventListener('pointermove', onPointerMove)
  node.addEventListener('pointerup', finish)
  node.addEventListener('pointercancel', onPointerCancel)
  node.addEventListener('click', onClick, true)

  return {
    update(next: SwipeOptions) {
      current = next
    },
    destroy() {
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', finish)
      node.removeEventListener('pointercancel', onPointerCancel)
      node.removeEventListener('click', onClick, true)
    },
  }
}
