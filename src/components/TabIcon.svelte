<!--
  Every icon in the app, as inline SVG.

  Why not an icon package: it's one more dependency to keep up to date, and it
  ships hundreds of glyphs to use four. These are drawn on a 24x24 grid with a
  consistent 1.8 stroke so they sit together evenly.

  They inherit `currentColor`, so the nav colours an icon by setting `color` on the
  button — the icon never picks a colour itself. The one exception is the knobs on
  the settings icon, which are filled with the surface colour so the slider line
  appears to pass behind them.
-->
<script lang="ts">
  import type { RouteId } from '../lib/router'

  type Shape = { kind: 'path'; d: string } | { kind: 'knob'; cx: number; cy: number }

  const path = (d: string): Shape => ({ kind: 'path', d })
  const knob = (cx: number, cy: number): Shape => ({ kind: 'knob', cx, cy })

  let { name, size = 24 }: { name: RouteId; size?: number } = $props()

  const shapes: Record<RouteId, Shape[]> = {
    // A checklist: two ticked rows and one still to buy. A bag or a basket both
    // read as a bin at 24px; this doesn't.
    shopping: [
      path('M3.4 6.9l1.7 1.7 3.4-3.4'),
      path('M11.4 6.6h9.2'),
      path('M3.4 14.1l1.7 1.7 3.4-3.4'),
      path('M11.4 13.8h9.2'),
      path('M3.6 18.6h4.2v4.2H3.6Z'),
      path('M11.4 20.7h9.2'),
    ],
    // A fork and knife. A bowl with steam was the first try and read as a smiley
    // face at nav size.
    meals: [
      path('M6.6 3.4v3.8'),
      path('M9.4 3.4v3.8'),
      path('M12.2 3.4v3.8'),
      path('M6.6 7.2a2.8 2.8 0 0 0 5.6 0'),
      path('M9.4 10v10.6'),
      path('M17.6 3.4c1.7 1.5 2.4 3.9 2.4 6.4 0 1.5-1 2.5-2.4 2.5Z'),
      path('M17.6 12.3v8.3'),
    ],
    // A month grid.
    calendar: [
      path('M4 6.5h16v13.5H4Z'),
      path('M4 10.5h16'),
      path('M8.5 3.5v4'),
      path('M15.5 3.5v4'),
    ],
    // Sliders rather than a gear — a gear turns to mush at 24px.
    settings: [path('M4 8h16'), path('M4 16h16'), knob(9, 8), knob(15, 16)],
  }
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each shapes[name] as shape, i (i)}
    {#if shape.kind === 'path'}
      <path d={shape.d} />
    {:else}
      <circle cx={shape.cx} cy={shape.cy} r="2.4" fill="var(--color-surface)" />
    {/if}
  {/each}
</svg>
