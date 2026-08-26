<!--
  One grocery glyph: either a line drawing from the icon set, or the item's
  outlined initial when it has no drawing.

  The letter is stroked, not filled — same weight, same colour, same round caps
  as the icons. That is the whole point of the fallback: a tile with a letter has
  to look like a deliberate member of the set, not like a missing image. The
  reference app (Bring!) does the same thing and it reads fine among real icons.

  Everything takes its colour from `currentColor`, so the tile decides whether
  this is the normal ink or the muted trolley ink. The icon never picks a colour.
-->
<script lang="ts">
  import { ICONS, hasIcon } from '../lib/icons'
  import { initialFor } from '../lib/list-view'

  let {
    icon = null,
    name,
    size = 28,
  }: {
    /** Icon slug from the set, or null to fall back to the initial. */
    icon?: string | null
    /** Item name — supplies the letter when there's no icon. */
    name: string
    size?: number
  } = $props()

  let paths = $derived(icon !== null && hasIcon(icon) ? ICONS[icon] : null)
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if paths}
    {#each paths as d (d)}
      <path {d} />
    {/each}
  {:else}
    <!-- Outlined initial. `paint-order` puts the stroke behind the (absent)
         fill so the letterform stays crisp rather than thickening inward. -->
    <text
      x="12"
      y="12"
      text-anchor="middle"
      dominant-baseline="central"
      font-size="15"
      font-weight="700"
      font-family="var(--font-sans)"
      fill="none"
      stroke="currentColor"
      stroke-width="1.1"
      paint-order="stroke"
    >
      {initialFor(name)}
    </text>
  {/if}
</svg>
