/*
 * The transitions used when the tile grids change.
 *
 * The brief was: when something is added or ticked off, the grid should visibly
 * *change*, rather than items sliding up and down a list. So the motion is:
 *
 *   - a tile arriving or leaving scales and fades in place (below)
 *   - every other tile then glides to its new grid cell, via Svelte's
 *     `animate:flip` at the call site
 *
 * Together that reads as the grid rearranging itself, which is the point. A tile
 * never travels across the screen from one section to another; it fades out of
 * one grid and fades into the other while the neighbours close the gap.
 *
 * Durations are short on purpose. This happens a dozen times while shopping and
 * anything slower would start costing time rather than explaining anything.
 *
 * Reduced motion is honoured here rather than only in CSS, because a `css`
 * transition function bypasses the global `prefers-reduced-motion` rule in
 * global.css — that rule can only reach declared CSS animations, not these.
 */

import type { TransitionConfig } from 'svelte/transition'

const DURATION = 190

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** A tile appearing: grows the last of the way in, fading as it goes. */
export function tileIn(_node: Element): TransitionConfig {
  if (prefersReducedMotion()) return { duration: 0 }

  return {
    duration: DURATION,
    css: (t) => {
      const eased = t * t * (3 - 2 * t) // smoothstep
      return `opacity: ${eased}; transform: scale(${0.86 + 0.14 * eased});`
    },
  }
}

/**
 * A tile leaving: shrinks away in place.
 *
 * Slightly quicker than the entrance so the gap starts closing promptly — a
 * departure that lingers makes the whole grid feel sticky.
 */
export function tileOut(_node: Element): TransitionConfig {
  if (prefersReducedMotion()) return { duration: 0 }

  return {
    duration: DURATION - 40,
    css: (t) => `opacity: ${t}; transform: scale(${0.88 + 0.12 * t});`,
  }
}

/** How long the FLIP reflow should take. Matched to the tile transitions. */
export const FLIP_MS = prefersReducedMotion() ? 0 : 240
