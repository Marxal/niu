<!--
  The moment the list empties.

  NIU.md §8 asks for satisfying motion and an empty list that celebrates, and
  this is the one place in the shopping tab where something genuinely ends. It
  fires when the last thing leaves the list — which, now that deletes sync,
  happens on both phones at once, so whoever is still in the shop sees it too.

  Deliberately not a dialog: nothing to dismiss, nothing to tap, no decision to
  make. It fades over the screen for two seconds and lets go. `pointer-events:
  none` means it can never swallow a tap meant for the list underneath.

  Reduced motion gets the same message without the burst — the ring and the tick
  simply appear. Everything here is a declared CSS animation, so the global
  prefers-reduced-motion rule in global.css already shortens them to nothing; the
  dots are hidden outright because a dozen things flying outwards is exactly what
  that preference is asking us not to do.
-->
<script lang="ts">
  import { strings } from '../lib/strings'

  let { onDone }: { onDone: () => void } = $props()

  /** Long enough to read the line, short enough not to be in the way. */
  const SHOW_MS = 2000

  // Twelve dots on a circle. Angles are computed rather than written out so the
  // spacing stays even if the count changes.
  const DOTS = Array.from({ length: 12 }, (_, i) => (i * 360) / 12)

  $effect(() => {
    const timer = setTimeout(onDone, SHOW_MS)
    return () => clearTimeout(timer)
  })
</script>

<div class="celebrate" role="status" aria-live="polite">
  <div class="burst">
    {#each DOTS as angle (angle)}
      <span class="dot" style="--angle: {angle}deg"></span>
    {/each}

    <svg class="ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle class="disc" cx="32" cy="32" r="26" />
      <path class="tick" d="M20 33.5 28.5 42 45 24" />
    </svg>
  </div>

  <p class="title">{strings.shopping.shoppingDone}</p>
  <p class="blurb">{strings.shopping.celebrate}</p>
</div>

<style>
  .celebrate {
    position: fixed;
    inset: 0;
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    /* Never in the way of a tap. */
    pointer-events: none;
    /* A wash rather than a scrim: you can still see the list emptying behind. */
    background: color-mix(in srgb, var(--color-bg) 78%, transparent);
    animation: wash var(--dur-base) var(--ease) both;
  }

  .burst {
    position: relative;
    display: grid;
    place-items: center;
    width: 9rem;
    height: 9rem;
  }

  .ring {
    width: 5rem;
    height: 5rem;
    overflow: visible;
    animation: pop 420ms var(--ease) both;
  }

  .disc {
    fill: var(--color-pick-soft);
    stroke: var(--color-pick);
    stroke-width: 2.5;
  }

  .tick {
    fill: none;
    stroke: var(--color-pick);
    stroke-width: 5;
    stroke-linecap: round;
    stroke-linejoin: round;
    /* Drawn on, left to right. 40 comfortably exceeds the path length. */
    stroke-dasharray: 40;
    stroke-dashoffset: 40;
    animation: draw 380ms var(--ease) 180ms both;
  }

  .dot {
    position: absolute;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: var(--radius-full);
    background: var(--color-pick);
    /* Each dot starts at the centre and is thrown out along its own angle. */
    transform: rotate(var(--angle)) translateY(0) scale(0);
    animation: throw 700ms var(--ease) 120ms both;
  }

  .dot:nth-child(even) {
    background: var(--color-accent);
  }

  .title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--color-pick);
    animation: rise 360ms var(--ease) 200ms both;
  }

  .blurb {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    animation: rise 360ms var(--ease) 280ms both;
  }

  @keyframes wash {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes pop {
    0% {
      transform: scale(0.4);
      opacity: 0;
    }
    60% {
      transform: scale(1.08);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes throw {
    0% {
      transform: rotate(var(--angle)) translateY(0) scale(0);
      opacity: 0;
    }
    35% {
      opacity: 1;
    }
    100% {
      transform: rotate(var(--angle)) translateY(-3.9rem) scale(0.7);
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      transform: translateY(0.5rem);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      display: none;
    }
  }
</style>
