<!--
  How much cooking a dish takes, as one small glyph.

  Its own component rather than a branch inside GroceryIcon: this draws from
  COOK_ICONS, which is deliberately not part of the grocery icon set, and it has
  none of that component's fallback chain — there are exactly three answers and
  all three have a drawing.
-->
<script lang="ts">
  import { COOK_ICONS } from '../lib/icons'
  import type { DishCook } from '../lib/dishes'

  let { cook, size = 20 }: { cook: DishCook; size?: number } = $props()
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
  {#each COOK_ICONS[cook] as d (d)}
    <path {d} />
  {/each}
</svg>
