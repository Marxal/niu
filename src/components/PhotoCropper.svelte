<!--
  Choosing which square of a photo becomes somebody's face. Drag to move, pinch
  to zoom, tap Use.

  Round 11.2 took the middle square without asking, on the reasoning that a
  phone photo of a person has the person in the middle. Marçal's note after
  using it: most photos came back wrong. The middle is a decent *guess* and a
  poor *decision* — a photo of two people has neither of them in the middle, and
  a picture taken in portrait of somebody standing up has their face in the top
  third.

  So the middle is now where the cropper opens, and it opens on exactly the
  square round 11.2 would have taken. Somebody who does not touch it gets the
  old behaviour; everybody else gets their face.

  ## The gestures

  One finger pans, two pinch. Both go through crop.ts, which is pure and tested
  and holds the one rule that matters: **the image always covers the hole.** No
  gap, at any zoom, in any position — so there is no way to produce an avatar
  with a transparent corner.

  `touch-action: none` on the stage is what stops the browser scrolling the
  sheet while you drag inside it. It has to be the CSS property rather than
  preventDefault alone: on Android the scroll is handed to the compositor before
  the first event reaches us.

  Pointer capture is the other half. Without it, a finger that leaves the stage
  mid-drag stops sending events and the image sticks halfway.
-->
<script lang="ts">
  import {
    type View,
    centeredView,
    cropRect,
    distance,
    panBy,
    zoomAround,
  } from '../lib/crop'
  import type { Decoded } from '../lib/photo.svelte'
  import type { CropRect } from '../lib/crop'
  import { strings } from '../lib/strings'

  let {
    decoded,
    busy = false,
    onuse,
    oncancel,
  }: {
    decoded: Decoded
    busy?: boolean
    onuse: (crop: CropRect) => void
    oncancel: () => void
  } = $props()

  /** The square hole, in CSS pixels. Measured, because it is width-driven. */
  let viewport = $state(280)
  let stage = $state<HTMLElement | null>(null)

  // svelte-ignore state_referenced_locally
  let view = $state<View>(centeredView(decoded.width, decoded.height, viewport))

  /** Live pointers, so one finger can be told from two. */
  const points = new Map<number, { x: number; y: number }>()
  /** The span between two fingers when the current pinch started. */
  let pinchFrom = 0
  let pinchScale = 1

  /**
   * The stage is as wide as the sheet lets it be, and square. Measuring rather
   * than assuming keeps the maths in real pixels — a gesture arrives in those,
   * and converting in the middle of a pinch is where the jitter comes from.
   */
  $effect(() => {
    const element = stage
    if (!element) return

    const observer = new ResizeObserver(() => {
      const size = element.clientWidth
      if (size <= 0 || size === viewport) return
      viewport = size
      // Re-centre rather than trying to preserve the view: this fires on mount
      // and on rotation, and both are moments where the middle is the right
      // place to be.
      view = centeredView(decoded.width, decoded.height, size)
    })

    observer.observe(element)
    return () => observer.disconnect()
  })

  function midpoint(): { x: number; y: number } {
    const [a, b] = [...points.values()]
    if (!a || !b) return { x: viewport / 2, y: viewport / 2 }
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  function span(): number {
    const [a, b] = [...points.values()]
    return a && b ? distance(a.x, a.y, b.x, b.y) : 0
  }

  function local(event: PointerEvent): { x: number; y: number } {
    const box = stage?.getBoundingClientRect()
    return {
      x: event.clientX - (box?.left ?? 0),
      y: event.clientY - (box?.top ?? 0),
    }
  }

  function onDown(event: PointerEvent) {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    points.set(event.pointerId, local(event))

    if (points.size === 2) {
      pinchFrom = span()
      pinchScale = view.scale
    }
  }

  function onMove(event: PointerEvent) {
    const previous = points.get(event.pointerId)
    if (!previous) return

    const next = local(event)
    points.set(event.pointerId, next)

    if (points.size >= 2) {
      // Two fingers: scale by how much the span has grown, around the point
      // between them, so the picture stays put under both.
      if (pinchFrom <= 0) return
      const centre = midpoint()
      view = zoomAround(
        view,
        (pinchScale * span()) / pinchFrom,
        centre.x,
        centre.y,
        decoded.width,
        decoded.height,
        viewport,
      )
      return
    }

    view = panBy(
      view,
      next.x - previous.x,
      next.y - previous.y,
      decoded.width,
      decoded.height,
      viewport,
    )
  }

  function onUp(event: PointerEvent) {
    points.delete(event.pointerId)
    // Lifting one finger of a pinch leaves the other one panning. Re-seeding
    // from the survivor's current position is what stops the image jumping by
    // the distance between the two.
    if (points.size < 2) pinchFrom = 0
  }

  function use() {
    onuse(cropRect(view, decoded.width, decoded.height, viewport))
  }

  function reset() {
    view = centeredView(decoded.width, decoded.height, viewport)
  }
</script>

<div class="backdrop" role="presentation"></div>

<div class="cropper" role="dialog" aria-modal="true" aria-label={strings.people.cropTitle}>
  <header class="head">
    <h2>{strings.people.cropTitle}</h2>
    <button class="text-button" onclick={oncancel}>{strings.people.cancel}</button>
  </header>

  <!-- The stage takes the gestures; the mask is drawn over it and takes none. -->
  <div
    class="stage"
    role="application"
    aria-label={strings.people.cropHint}
    bind:this={stage}
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
  >
    <img
      class="picture"
      src={decoded.url}
      alt=""
      draggable="false"
      style="
        width: {decoded.width * view.scale}px;
        height: {decoded.height * view.scale}px;
        transform: translate({view.offsetX}px, {view.offsetY}px);
      "
    />
    <div class="mask" aria-hidden="true"></div>
  </div>

  <p class="hint">{strings.people.cropHint}</p>

  <footer class="foot">
    <button class="text-button" onclick={reset}>{strings.people.cropReset}</button>
    <button class="use" disabled={busy} onclick={use}>
      {busy ? strings.people.faceUploading : strings.people.cropUse}
    </button>
  </footer>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    z-index: var(--z-sheet);
  }

  /* Above the person sheet it was opened from, and centred rather than a bottom
     sheet: a square you are aiming at with two fingers wants to be in the
     middle of the screen, not under the thumb. */
  .cropper {
    position: fixed;
    inset: auto 0 0 0;
    z-index: calc(var(--z-sheet) + 1);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0 auto;
    max-width: var(--content-max);
    padding: var(--space-4) var(--space-4)
      calc(env(safe-area-inset-bottom, 0px) + var(--space-4));
    background: var(--color-surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-2);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
    /* Stops Android handing the drag to the scroller before we see it. */
    touch-action: none;
    user-select: none;
  }

  .picture {
    position: absolute;
    top: 0;
    left: 0;
    max-width: none;
    transform-origin: 0 0;
    /* A dragged image must never be the browser's own drag-and-drop. */
    -webkit-user-drag: none;
    user-select: none;
  }

  /* The circle the avatar will actually show, as a hole punched in a scrim.
     One element, one radial gradient — a real circular clip would need either
     an SVG mask or four divs, and this is the same picture.

     `closest-side` is load-bearing. A radial gradient defaults to
     `farthest-corner`, which on a square makes 100% reach the *corner* — about
     1.41× the half-width — so the clear circle came out noticeably bigger than
     the rim drawn below it and the mask showed as two mismatched rings.
     `closest-side` makes 100% the inscribed circle, which is the one the avatar
     will actually crop to. */
  .mask {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      circle closest-side at 50% 50%,
      transparent 0,
      transparent 99.5%,
      var(--color-overlay) 99.5%
    );
  }

  /* The rim of the hole, so the edge of the circle is a line rather than the
     end of a fade. Inset by the same amount the gradient stops at, so the two
     land on each other. */
  .mask::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--radius-full);
    box-shadow: inset 0 0 0 2px var(--color-surface);
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
    line-height: var(--leading-normal);
    text-align: center;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .text-button {
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
    border: none;
    background: none;
    color: var(--color-text-muted);
    font-size: var(--text-base);
  }

  .use {
    min-height: var(--tap-min);
    padding: 0 var(--space-6);
    border: none;
    border-radius: var(--radius-full);
    background: var(--color-tab-calendar);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }

  .use:disabled {
    opacity: 0.5;
  }

  button:active:not(:disabled) {
    transform: scale(0.98);
  }
</style>
