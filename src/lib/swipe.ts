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
 * The two halves of a page turn: the month you are leaving slides out, the one
 * you are arriving at slides in from the other side.
 *
 * Out is quicker than in, which is the standard trick for making a transition
 * feel responsive rather than slow — the thing you asked to leave goes promptly
 * and the thing you asked for takes its time arriving.
 *
 * Only one month is ever rendered. The alternative — both on screen at once,
 * genuinely sliding past each other — means laying out two grids on every frame
 * of the gesture, and says nothing the swap does not.
 */
const OUT_MS = 130
const IN_MS = 190

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Slides a page out, swaps what is in it, and slides the new one in.
 *
 * Exported because the ‹ › buttons page the calendar too, and a swipe that
 * slides while a button jumps would read as two different features. `swap` is
 * called at the moment the old page is off screen — everything the screen does
 * to change month goes in there.
 *
 * Reduced motion swaps with no animation at all: this is decoration, and the
 * one thing it must not do is delay the answer for somebody who asked for less
 * movement. It is honoured here rather than in CSS because these transitions
 * are set from script, where the global media query in global.css cannot reach.
 */
export function slidePage(
  node: HTMLElement,
  went: Exclude<SwipeDirection, null>,
  swap: () => void,
): void {
  if (prefersReducedMotion()) {
    swap()
    return
  }

  // Already on its way somewhere. Swap immediately and let the animation in
  // flight carry the new content: tapping › three times to reach December has
  // to move three months, and dropping the taps that land mid-slide would make
  // the arrows feel broken. The flag is on the element rather than in a module
  // variable because two calendars could in principle be on screen.
  if (node.dataset.sliding === 'yes') {
    swap()
    return
  }
  node.dataset.sliding = 'yes'

  const distance = Math.round(node.offsetWidth * 0.35)
  const out = went === 'next' ? -distance : distance

  node.style.transition = `transform ${OUT_MS}ms ease-in, opacity ${OUT_MS}ms ease-in`
  node.style.transform = `translateX(${out}px)`
  node.style.opacity = '0'

  window.setTimeout(() => {
    swap()
    // Straight to the far side with no transition, so the new page has somewhere
    // to arrive from. Two frames, because a transform and the transition that
    // animates it set in the same frame are one jump, not an animation.
    node.style.transition = 'none'
    node.style.transform = `translateX(${-out}px)`
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        node.style.transition = `transform ${IN_MS}ms ease-out, opacity ${IN_MS}ms ease-out`
        node.style.transform = ''
        node.style.opacity = '1'
        window.setTimeout(() => {
          delete node.dataset.sliding
        }, IN_MS)
      })
    })
  }, OUT_MS)
}

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
 * The element leans with the finger while it is down. Let go far enough and it
 * carries on the way it was going, swaps, and the next month arrives from the
 * other side (slidePage above); let go short and it springs back.
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
    // A page is already on its way somewhere; let it get there.
    if (node.dataset.sliding === 'yes') return
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

    const went = direction(dx, dy)
    if (went === null) {
      springBack()
      return
    }

    // The finger already moved it part of the way; the slide carries on from
    // there rather than snapping back first.
    swallowClick = true
    slidePage(node, went, () => {
      if (went === 'next') current.onNext()
      else current.onPrevious()
    })
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
