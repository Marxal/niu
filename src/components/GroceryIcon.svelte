<!--
  One grocery glyph. Three ways it can be drawn, in this order of preference:

    1. the household's own chosen icon, if someone picked one
    2. the item's line drawing, or its emoji when the Colour style is on
    3. the item's outlined initial

  The letter is stroked, not filled — same weight, same colour, same round caps
  as the icons. That is the whole point of the fallback: a tile with a letter has
  to look like a deliberate member of the set, not a missing image.

  On the Colour style: those are the phone's own emoji, so they are pictures we
  don't control and they arrive far more saturated than anything else in the
  app. `filter: saturate()` pulls them back towards the rest of the palette. Only
  about a third of items have an emoji at all, so Colour falls through to the
  line drawing rather than to a letter — it is a tint on top of the line set, not
  a replacement for it.
-->
<script lang="ts">
  import { ICONS, hasIcon } from '../lib/icons'
  import { initialFor } from '../lib/list-view'
  import { prefs } from '../lib/prefs.svelte'

  let {
    icon = null,
    emoji = null,
    name,
    size = 28,
  }: {
    /** Line-drawing slug, already resolved through any household override. */
    icon?: string | null
    /** The item's emoji, used only when the Colour style is on. */
    emoji?: string | null
    /** Item name — supplies the letter when there is nothing else. */
    name: string
    size?: number
  } = $props()

  let showEmoji = $derived(prefs.iconStyle === 'colour' && emoji !== null && emoji !== '')
  let paths = $derived(icon !== null && hasIcon(icon) ? ICONS[icon] : null)
</script>

{#if showEmoji}
  <span class="emoji" style="font-size: {size * 0.86}px" aria-hidden="true">{emoji}</span>
{:else}
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
{/if}

<style>
  .emoji {
    display: block;
    line-height: 1;
    /* Emoji are bitmaps drawn by the phone, and arrive far louder than the rest
       of the palette. This pulls them back so a grid of them isn't shouting. */
    filter: saturate(0.62) contrast(0.96);
  }
</style>
