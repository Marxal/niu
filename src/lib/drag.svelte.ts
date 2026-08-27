/*
 * Everything a planned meal card does under a finger, and the one thing an
 * ingredient does: hold to move it, swipe to throw it away, drop it on the bin.
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
 *
 * ## Three gestures on one card, and how they stay apart
 *
 * A card sits in a vertically scrolling page and answers to all three of:
 *
 *   scroll   a finger moving mostly *up or down* — the browser's, untouched
 *   swipe    a finger moving mostly *sideways* — takes the card away
 *   drag     a finger that stays still long enough — picks the card up
 *
 * They are told apart by the first thing the finger does, and only once: the
 * gesture is decided at the first movement past MOVE_TOLERANCE (or by the timer
 * firing before there is any) and never revisited. That is what stops a drag
 * turning into a swipe halfway across the screen, and it is why the swipe test
 * asks for movement that is clearly sideways — 1.4× more horizontal than
 * vertical — rather than merely more sideways than not. A diagonal flick is much
 * more likely to be a scroll than a delete, and deleting is the one outcome
 * here that loses something.
 *
 * ### The bug that made swiping not work on a real phone
 *
 * Round 10.1 shipped the swipe with all of the above and it still failed on
 * Marçal's phone: the card moved a few pixels and sprang back. It passed every
 * test here because those drove it with a *mouse*, and a mouse never has this
 * problem.
 *
 * The cause is `touch-action`. Left at its default of `auto`, the card promises
 * the compositor nothing, so the compositor keeps the right to take the gesture
 * for a pan in either direction. On a real device, the moment a horizontal drag
 * looks like it might be a pan, the compositor claims it and the page fires
 * `pointercancel` at the element — which sprang the card back, mid-swipe,
 * exactly as described.
 *
 * `touch-action: pan-y` on the card (see PlanCard.svelte) is the fix, and it is
 * a statement of intent rather than a workaround: *vertical panning is yours,
 * horizontal is mine.* The compositor then never steals a sideways drag, so the
 * cancel never happens, and vertical scrolling over a card still works natively.
 *
 * As a second guarantee, `pointercancel` no longer rewinds the card to where it
 * started. It ends the swipe at the last position the finger was actually seen
 * at, so a cancel arriving after a long, deliberate swipe still removes the card
 * rather than silently undoing it.
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

/**
 * How much more horizontal than vertical a movement has to be before it is a
 * swipe rather than the start of a scroll. See the header.
 */
const SWIPE_BIAS = 1.4

/** How far across the card has to end up for the swipe to actually remove it. */
const SWIPE_AWAY = 96

/** How long the card takes to fly off, or to spring back. Matches motion.ts. */
const SWIPE_MS = 190

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
  /** True while the finger is over the bin. */
  overTrash = $state(false)
}

export const drag = new DragState()

/**
 * Something picked up somewhere else and carried onto the plan — today, an
 * ingredient long-pressed in the "What's home" sheet.
 *
 * Kept apart from `drag` above and driven entirely from `window`, because the
 * sheet it was picked up in has to get out of the way immediately — you cannot
 * aim at a week you cannot see.
 *
 * ## Why the source sheet is *hidden* rather than unmounted
 *
 * The first version closed the sheet outright and the carry died on the first
 * move. A touch pointer is **implicitly captured by the element it started on**,
 * and when that element leaves the DOM the browser releases the capture and
 * fires `pointercancel`. Every subsequent move went nowhere. Window-level
 * listeners do not help: there is no longer a path from the detached row up to
 * the window for anything to bubble along.
 *
 * So the sheet stays mounted, invisible and inert, until the finger lifts —
 * which keeps the capture target alive — and only then unmounts. `onEnd` is what
 * tells the screen it may finally close it.
 */
class CarryState {
  active = $state(false)
  itemId = $state<string | null>(null)
  name = $state('')
  icon = $state<string | null>(null)
  emoji = $state<string | null>(null)
  x = $state(0)
  y = $state(0)
  overKey = $state<string | null>(null)
}

export const carry = new CarryState()

function scroller(): HTMLElement | null {
  return document.getElementById('main')
}

function trashElement(): HTMLElement | null {
  return document.querySelector('[data-trash]')
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

/** True when a point is over the bin. */
function overTrashAt(x: number, y: number): boolean {
  const element = document.elementFromPoint(x, y)
  return Boolean(element?.closest('[data-trash]'))
}

/** A short tick when the card lifts. Silently absent on iOS, which is fine. */
function buzz(): void {
  try {
    navigator.vibrate?.(12)
  } catch {
    // Some browsers throw rather than ignoring it. It is a nicety either way.
  }
}

/**
 * One frame of edge scrolling, shared by the card drag and the carry.
 *
 * The bin complicates the bottom edge, and this is where that is resolved. The
 * bin sits in the very strip the downward scroll band would otherwise occupy,
 * so the band is moved to sit *above* it: the bottom EDGE pixels of whatever
 * space is left over the bin still scroll, and the bin itself is a drop target
 * rather than an accelerator. That is what keeps "you can still scroll down
 * while dragging" true with a bin on screen.
 *
 * Returns true if the page actually moved, which is the caller's cue to re-test
 * what is under a finger that has not itself moved.
 */
function edgeScroll(y: number): boolean {
  const main = scroller()
  if (!main) return false

  const rect = main.getBoundingClientRect()
  const trash = trashElement()
  // The floor for scrolling: the top of the bin when there is one, otherwise the
  // bottom of the scroller.
  const floor = trash ? trash.getBoundingClientRect().top : rect.bottom

  if (y < rect.top + EDGE && main.scrollTop > 0) {
    main.scrollTop -= SCROLL_STEP
    return true
  }

  if (
    y > floor - EDGE &&
    y <= floor &&
    main.scrollTop + main.clientHeight < main.scrollHeight
  ) {
    main.scrollTop += SCROLL_STEP
    return true
  }

  return false
}

export interface DraggableOptions {
  /** The entry this card stands for. */
  id: string
  /** Called with the slot the card was let go over. Never called for a no-move. */
  onDrop: (id: string, slot: DragSlot) => void
  /**
   * Called once the card has finished flying off sideways, or when it was
   * dropped on the bin. Leave it out and the card simply won't swipe — which is
   * what the copy under the finger wants.
   */
  onSwipeAway?: ((id: string) => void) | undefined
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

  /**
   * What this touch turned out to be. Decided once, at the first movement past
   * the tolerance or by the long-press timer, and never revisited.
   */
  let gesture: 'undecided' | 'drag' | 'swipe' | 'scroll' = 'undecided'

  const blockTouch = (event: TouchEvent) => event.preventDefault()

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function slide(x: number, animated: boolean): void {
    node.style.transition = animated
      ? `transform ${SWIPE_MS}ms ease-out, opacity ${SWIPE_MS}ms ease-out`
      : ''
    node.style.transform = x === 0 ? '' : `translateX(${x}px)`
    // Fades as it goes, so the card reads as leaving rather than as sliding to
    // reveal something. There is nothing underneath but the bin.
    node.style.opacity =
      x === 0 ? '' : `${Math.max(0.35, 1 - Math.abs(x) / (SWIPE_AWAY * 2.4))}`
  }

  function resetSlide(animated: boolean): void {
    slide(0, animated)
    if (animated) {
      window.setTimeout(() => {
        node.style.transition = ''
      }, SWIPE_MS)
    }
  }

  function updateOver(): void {
    const trash = overTrashAt(lastX, lastY)
    drag.overTrash = trash
    const slot = trash ? null : slotAt(lastX, lastY)
    drag.overKey = slot ? slotKey(slot.date, slot.meal) : null
  }

  /**
   * The auto-scroll loop. It also re-tests the drop target every frame: while
   * the page is moving under a still finger, nothing else would notice that the
   * card is now over Thursday.
   */
  function tick(): void {
    frame = requestAnimationFrame(tick)
    if (edgeScroll(lastY)) updateOver()
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

    if (lifted || gesture === 'swipe') {
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
    gesture = 'undecided'
    drag.active = false
    drag.entryId = null
    drag.overKey = null
    drag.overTrash = false
  }

  /**
   * The last word on a drag, wherever the pointer ended up. Runs the same drop
   * as onPointerUp; whichever fires first wins, because finish() clears `lifted`
   * and the other then has nothing to do.
   */
  function onWindowEnd(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return
    if (gesture === 'swipe') releaseSwipe()
    else if (lifted) drop()
  }

  /** Works out where the card was let go, tidies up, and reports the move. */
  function drop(): void {
    const onBin = overTrashAt(lastX, lastY)
    const slot = onBin ? null : slotAt(lastX, lastY)
    const id = current.id

    finish()

    // The click that follows belongs to the drag, not to the card. Eat one.
    swallowClick = true

    if (onBin) current.onSwipeAway?.(id)
    else if (slot) current.onDrop(id, slot)
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
    gesture = 'undecided'

    clearTimer()
    timer = setTimeout(() => {
      if (gesture !== 'undecided') return
      gesture = 'drag'
      lift()
    }, LONG_PRESS_MS)
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return

    lastX = event.clientX
    lastY = event.clientY

    if (gesture === 'swipe') {
      event.preventDefault()
      slide(lastX - startX, false)
      return
    }

    if (!lifted) {
      const dx = lastX - startX
      const dy = lastY - startY
      const far = Math.abs(dx) > MOVE_TOLERANCE || Math.abs(dy) > MOVE_TOLERANCE
      if (!far) return

      clearTimer()

      // Clearly sideways, and this card can be thrown away: a swipe.
      if (current.onSwipeAway && Math.abs(dx) > Math.abs(dy) * SWIPE_BIAS) {
        gesture = 'swipe'
        try {
          node.setPointerCapture?.(event.pointerId)
        } catch {
          // Same story as in lift(): the window listeners below cover it.
        }
        window.addEventListener('touchmove', blockTouch, { passive: false })
        window.addEventListener('pointerup', onWindowEnd)
        window.addEventListener('pointercancel', onWindowEnd)
        event.preventDefault()
        slide(dx, false)
        return
      }

      // Anything else this far out was the page scrolling all along.
      gesture = 'scroll'
      pointerId = null
      return
    }

    event.preventDefault()
    drag.x = lastX - offsetX
    drag.y = lastY - offsetY
    updateOver()
  }

  /**
   * The end of a sideways gesture: far enough across and the card flies off and
   * is reported gone; short of that it springs back.
   *
   * The removal is reported *after* the card has left rather than immediately,
   * so what you see is the card going and then the row closing, rather than the
   * row closing under a card that is still visibly mid-flight.
   */
  function releaseSwipe(): void {
    const dx = lastX - startX
    const id = current.id
    const away = Math.abs(dx) > SWIPE_AWAY

    window.removeEventListener('touchmove', blockTouch)
    window.removeEventListener('pointerup', onWindowEnd)
    window.removeEventListener('pointercancel', onWindowEnd)
    document.body.classList.remove('dragging')

    if (pointerId !== null && node.hasPointerCapture?.(pointerId)) {
      node.releasePointerCapture(pointerId)
    }

    pointerId = null
    gesture = 'undecided'
    swallowClick = true

    if (!away) {
      resetSlide(true)
      return
    }

    const off = dx > 0 ? node.offsetWidth + 40 : -(node.offsetWidth + 40)
    node.style.transition = `transform ${SWIPE_MS}ms ease-in, opacity ${SWIPE_MS}ms ease-in`
    node.style.transform = `translateX(${off}px)`
    node.style.opacity = '0'
    window.setTimeout(() => current.onSwipeAway?.(id), SWIPE_MS)
  }

  function onPointerUp(event: PointerEvent): void {
    if (pointerId !== event.pointerId) {
      finish()
      return
    }

    if (gesture === 'swipe') releaseSwipe()
    else if (lifted) drop()
    else finish()
  }

  /**
   * A cancel does *not* rewind a swipe.
   *
   * It used to reset the card to where the finger started, which is what made
   * swiping look broken on a real phone: the compositor claimed the gesture,
   * fired a cancel, and the card sprang back mid-swipe. `touch-action: pan-y` on
   * the card should stop that happening at all now — this is the second line of
   * defence. Ending at the last position the finger was actually seen at means a
   * cancel arriving after a long, deliberate swipe still removes the card, and
   * one arriving after a small nudge still springs it back, which is the right
   * answer in both cases.
   */
  function onPointerCancel(): void {
    if (gesture === 'swipe') {
      releaseSwipe()
      return
    }
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
    if (lifted || gesture === 'swipe') event.preventDefault()
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
      window.removeEventListener('pointerup', onWindowEnd)
      window.removeEventListener('pointercancel', onWindowEnd)
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

/* -------------------------------------------------------------------------- */
/* Carrying something in from a sheet                                          */
/* -------------------------------------------------------------------------- */

export interface CarriedItem {
  itemId: string
  name: string
  icon: string | null
  emoji: string | null
}

let carryFrame: number | null = null
let carryDrop: ((itemId: string, slot: DragSlot) => void) | null = null
let carryEnded: (() => void) | null = null
const blockCarryTouch = (event: TouchEvent) => event.preventDefault()

function carryMove(event: PointerEvent): void {
  event.preventDefault()
  carry.x = event.clientX
  carry.y = event.clientY
  carryOver()
}

function carryOver(): void {
  const slot = slotAt(carry.x, carry.y)
  carry.overKey = slot ? slotKey(slot.date, slot.meal) : null
}

function carryTick(): void {
  carryFrame = requestAnimationFrame(carryTick)
  if (edgeScroll(carry.y)) carryOver()
}

function carryEnd(event: PointerEvent): void {
  const slot = slotAt(event.clientX, event.clientY)
  const itemId = carry.itemId
  const drop = carryDrop

  stopCarry()

  if (slot && itemId && drop) drop(itemId, slot)
}

/** A cancel drops nothing, but still has to let the source sheet close. */
function carryCancelled(): void {
  stopCarry()
}

/**
 * Picks something up from inside a sheet and carries it onto the plan.
 *
 * Called from a long press on a row in the "What's home" sheet. The sheet closes
 * immediately — that is the point, you need to see the week to aim at it — so
 * every listener here is on `window` and nothing holds a reference to the row
 * that started it. A pointer capture would be worse than useless: it would be
 * taken on an element that is about to be removed.
 */
export function startCarry(
  item: CarriedItem,
  at: { x: number; y: number },
  handlers: {
    onDrop: (itemId: string, slot: DragSlot) => void
    /**
     * Called once the finger is up, however it ended. The source sheet must stay
     * mounted until this fires — see the header for why.
     */
    onEnd: () => void
  },
): void {
  stopCarry()

  carry.active = true
  carry.itemId = item.itemId
  carry.name = item.name
  carry.icon = item.icon
  carry.emoji = item.emoji
  carry.x = at.x
  carry.y = at.y
  carryDrop = handlers.onDrop
  carryEnded = handlers.onEnd
  carryOver()

  buzz()

  window.addEventListener('pointermove', carryMove, { passive: false })
  window.addEventListener('pointerup', carryEnd)
  window.addEventListener('pointercancel', carryCancelled)
  window.addEventListener('touchmove', blockCarryTouch, { passive: false })
  document.body.classList.add('dragging')
  carryFrame = requestAnimationFrame(carryTick)
}

/** Ends a carry without dropping anything. Safe to call twice. */
export function stopCarry(): void {
  if (carryFrame !== null) {
    cancelAnimationFrame(carryFrame)
    carryFrame = null
  }

  window.removeEventListener('pointermove', carryMove)
  window.removeEventListener('pointerup', carryEnd)
  window.removeEventListener('pointercancel', carryCancelled)
  window.removeEventListener('touchmove', blockCarryTouch)
  document.body.classList.remove('dragging')

  const ending = carryEnded

  carry.active = false
  carry.itemId = null
  carry.overKey = null
  carryDrop = null
  carryEnded = null

  ending?.()
}
