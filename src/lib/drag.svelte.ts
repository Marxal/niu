/*
 * Picking a planned meal up and putting it somewhere else.
 *
 * Marçal chose long-press-and-drag over the safer tap-to-lift-tap-to-drop, so
 * this is the real gesture rather than an approximation of it, and the awkward
 * parts of doing that in a phone browser are all handled here rather than being
 * sprinkled through the components.
 *
 * ## The four things that make touch dragging hard, and what each costs
 *
 * 1. **The browser wants to scroll.** A finger moving down a scrolling page is a
 *    scroll until proved otherwise. Proof is the long press: the timer is
 *    cancelled the moment the finger moves more than a few pixels, so by the time
 *    a drag starts the page has not begun scrolling and there is nothing to
 *    fight. From then on a non-passive `touchmove` listener calls
 *    preventDefault() and the page stays put. Both halves are needed — the
 *    listener alone arrives too late, the timer alone doesn't stop the scroll.
 *
 * 2. **The card must not move in the layout.** Dragging the real element would
 *    reflow the day it came from under the finger. So the element stays exactly
 *    where it is (dimmed) and the screen draws a fixed-position copy that follows
 *    the pointer. The copy has `pointer-events: none`, which is what lets
 *    elementFromPoint see the drop target underneath rather than the copy itself.
 *
 * 3. **The target is often off screen.** Dragging Monday's dinner to Friday means
 *    scrolling while holding. Hence the auto-scroll near the top and bottom
 *    edges — and, less obviously, re-testing what is under the finger on every
 *    frame while that happens, because the finger is still and the page is what
 *    is moving.
 *
 * 4. **A long press is also a tap.** Without suppressing it, letting go fires a
 *    click and opens the sheet for whatever the card landed on. The `click`
 *    handler below eats exactly one click after a lift.
 *
 * Pointer events throughout, not touch events: one code path covers a finger, a
 * mouse and a stylus, and `setPointerCapture` means a fast drag that outruns the
 * finger still delivers its move and up events to the card that started it.
 */

import { type Meal, isMeal } from './plan'

/** Long enough not to fire while scrolling, short enough not to feel stuck. */
const LONG_PRESS_MS = 380

/** Movement before the press is judged a scroll instead. */
const MOVE_TOLERANCE = 10

/** How close to the edge of the scroller the finger starts pulling the page. */
const EDGE = 76

/** Pixels per frame at the edge. About 700/s, which is a brisk but followable scroll. */
const SCROLL_STEP = 12

export interface DragSlot {
  date: string
  meal: Meal
}

/** One string per meal, so a template can compare without an object. */
export function slotKey(date: string, meal: string): string {
  return `${date}|${meal}`
}

class DragState {
  /** True from the moment the press succeeds until the finger lifts. */
  active = $state(false)
  /** The entry being carried. */
  entryId = $state<string | null>(null)
  /** Where to draw the copy, in viewport coordinates. */
  x = $state(0)
  y = $state(0)
  width = $state(0)
  height = $state(0)
  /** The slot under the finger right now, as a key, or null over nothing. */
  overKey = $state<string | null>(null)
}

export const drag = new DragState()

function scroller(): HTMLElement | null {
  return document.getElementById('main')
}

/** The slot under a point, by asking the DOM rather than by keeping a map. */
function slotAt(x: number, y: number): DragSlot | null {
  const element = document.elementFromPoint(x, y)
  const holder = element?.closest('[data-slot-date]')
  if (!holder) return null

  const date = holder.getAttribute('data-slot-date')
  const meal = holder.getAttribute('data-slot-meal')
  if (!date || !meal || !isMeal(meal)) return null

  return { date, meal }
}

/** A short tick when the card lifts. Silently absent on iOS, which is fine. */
function buzz(): void {
  try {
    navigator.vibrate?.(12)
  } catch {
    // Some browsers throw rather than ignoring it. It is a nicety either way.
  }
}

export interface DraggableOptions {
  /** The entry this card stands for. */
  id: string
  /** Called with the slot the card was let go over. Never called for a no-move. */
  onDrop: (id: string, slot: DragSlot) => void
  /** Set false to make a card inert — used while a sheet is open over the plan. */
  enabled?: boolean
}

/**
 * Makes one card draggable. `use:draggable={{ id, onDrop }}`.
 *
 * Everything it adds to the document — the touchmove block, the body class, the
 * scroll loop, the pointer capture — is undone in `finish()`, which every exit
 * path goes through, including the component being destroyed mid-drag.
 */
export function draggable(node: HTMLElement, options: DraggableOptions) {
  let current = options
  let timer: ReturnType<typeof setTimeout> | null = null
  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let offsetX = 0
  let offsetY = 0
  let lifted = false
  let swallowClick = false
  let frame: number | null = null
  let lastX = 0
  let lastY = 0

  const blockTouch = (event: TouchEvent) => event.preventDefault()

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function updateOver(): void {
    const slot = slotAt(lastX, lastY)
    drag.overKey = slot ? slotKey(slot.date, slot.meal) : null
  }

  /**
   * The auto-scroll loop. It also re-tests the drop target every frame: while
   * the page is moving under a still finger, nothing else would notice that the
   * card is now over Thursday.
   */
  function tick(): void {
    frame = requestAnimationFrame(tick)
    const main = scroller()
    if (!main) return

    const rect = main.getBoundingClientRect()
    let moved = false

    if (lastY < rect.top + EDGE && main.scrollTop > 0) {
      main.scrollTop -= SCROLL_STEP
      moved = true
    } else if (
      lastY > rect.bottom - EDGE &&
      main.scrollTop + main.clientHeight < main.scrollHeight
    ) {
      main.scrollTop += SCROLL_STEP
      moved = true
    }

    if (moved) updateOver()
  }

  function lift(): void {
    const rect = node.getBoundingClientRect()
    lifted = true
    timer = null

    /*
     * Capture here, at the moment of lifting — not on pointerdown, and not on
     * the first move afterwards.
     *
     * Not on pointerdown, because that would steal the move events the browser
     * needs in order to decide the gesture is a scroll.
     *
     * Not on the first move either, which is what this did first and which was
     * wrong in a way only a real drag showed: a quick flick's first move event
     * can already be a hundred pixels away, so it never lands on this element,
     * capture is never taken, and every subsequent move and the pointerup go to
     * whatever is under the finger instead. The card then sits still, the drop
     * target never lights up, and — worst of all — `finish()` never runs, so the
     * ghost stays on screen until the page is reloaded.
     *
     * At lift time the pointer is by definition still on this element: any
     * movement past MOVE_TOLERANCE would have cancelled the timer.
     */
    if (pointerId !== null) {
      try {
        node.setPointerCapture?.(pointerId)
      } catch {
        // Capture can be refused if the pointer has already gone. The window
        // listeners below are what make that survivable rather than fatal.
      }
    }

    offsetX = startX - rect.left
    offsetY = startY - rect.top

    drag.active = true
    drag.entryId = current.id
    drag.width = rect.width
    drag.height = rect.height
    drag.x = rect.left
    drag.y = rect.top
    updateOver()

    buzz()

    window.addEventListener('touchmove', blockTouch, { passive: false })
    /*
     * The belt to capture's braces. If capture is ever refused or lost — a
     * system gesture, the element being re-rendered out from under it — these
     * guarantee the drag still ends. A stranded drag leaves a card stuck to the
     * finger and the page unscrollable, which is the one failure here bad enough
     * to need a reload, so it gets two independent ways not to happen.
     */
    window.addEventListener('pointerup', onWindowEnd)
    window.addEventListener('pointercancel', onWindowEnd)
    document.body.classList.add('dragging')
    frame = requestAnimationFrame(tick)
  }

  function finish(): void {
    clearTimer()

    if (frame !== null) {
      cancelAnimationFrame(frame)
      frame = null
    }

    if (lifted) {
      window.removeEventListener('touchmove', blockTouch)
      window.removeEventListener('pointerup', onWindowEnd)
      window.removeEventListener('pointercancel', onWindowEnd)
      document.body.classList.remove('dragging')
    }

    if (pointerId !== null && node.hasPointerCapture?.(pointerId)) {
      node.releasePointerCapture(pointerId)
    }

    pointerId = null
    lifted = false
    drag.active = false
    drag.entryId = null
    drag.overKey = null
  }

  /**
   * The last word on a drag, wherever the pointer ended up. Runs the same drop
   * as onPointerUp; whichever fires first wins, because finish() clears `lifted`
   * and the other then has nothing to do.
   */
  function onWindowEnd(event: PointerEvent): void {
    if (!lifted || pointerId !== event.pointerId) return
    drop()
  }

  /** Works out where the card was let go, tidies up, and reports the move. */
  function drop(): void {
    const slot = slotAt(lastX, lastY)
    const id = current.id

    finish()

    // The click that follows belongs to the drag, not to the card. Eat one.
    swallowClick = true
    if (slot) current.onDrop(id, slot)
  }

  function onPointerDown(event: PointerEvent): void {
    if (current.enabled === false) return
    // Secondary mouse buttons are a context menu, not a drag.
    if (event.pointerType === 'mouse' && event.button !== 0) return

    pointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    lastX = startX
    lastY = startY

    clearTimer()
    timer = setTimeout(lift, LONG_PRESS_MS)
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return

    lastX = event.clientX
    lastY = event.clientY

    if (!lifted) {
      // Still deciding. Enough movement and this was a scroll all along.
      const far =
        Math.abs(lastX - startX) > MOVE_TOLERANCE || Math.abs(lastY - startY) > MOVE_TOLERANCE
      if (far) {
        clearTimer()
        pointerId = null
      }
      return
    }

    event.preventDefault()
    drag.x = lastX - offsetX
    drag.y = lastY - offsetY
    updateOver()
  }

  function onPointerUp(event: PointerEvent): void {
    if (pointerId !== event.pointerId) {
      finish()
      return
    }

    if (lifted) drop()
    else finish()
  }

  function onPointerCancel(): void {
    finish()
  }

  function onClick(event: MouseEvent): void {
    if (!swallowClick) return
    swallowClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  /**
   * A long press on a touch screen raises the context menu on some Android
   * builds, which cancels the pointer stream mid-drag.
   */
  function onContextMenu(event: Event): void {
    if (lifted) event.preventDefault()
  }

  node.addEventListener('pointerdown', onPointerDown)
  node.addEventListener('pointermove', onPointerMove)
  node.addEventListener('pointerup', onPointerUp)
  node.addEventListener('pointercancel', onPointerCancel)
  node.addEventListener('click', onClick, true)
  node.addEventListener('contextmenu', onContextMenu)

  return {
    update(next: DraggableOptions) {
      current = next
    },
    destroy() {
      finish()
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', onPointerUp)
      node.removeEventListener('pointercancel', onPointerCancel)
      node.removeEventListener('click', onClick, true)
      node.removeEventListener('contextmenu', onContextMenu)
    },
  }
}
