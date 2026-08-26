<!--
  One grocery glyph, in whichever of the three styles is in force.

  Resolution order, and the order matters:

    1. a picture someone picked for this item by hand — always wins, in the
       style they picked it in (see icon-ref.ts for why that is stored)
    2. the icon style preference applied to the item's defaults:
         Lines  the line drawing
         Emoji  the phone's own emoji, if the item has one
         Inked  OpenMoji's drawing of that emoji, if we ship one
    3. the line drawing
    4. the item's outlined initial

  The letter is stroked, not filled — same weight, same colour, same round caps
  as the icons. That is the whole point of the fallback: a tile with a letter has
  to look like a deliberate member of the set, not a missing image.

  On the two colour styles: both are pictures we don't control and both arrive
  more saturated than anything else in the app, so both go through the same
  desaturating filter. Emoji are the phone's own font, so they look different on
  every device; OpenMoji are files we ship, so they look the same everywhere —
  that consistency is the reason Inked exists.
-->
<script lang="ts">
  import { ICONS, hasIcon } from '../lib/icons'
  import { parseIconRef } from '../lib/icon-ref'
  import { initialFor } from '../lib/list-view'
  import { openmojiSrc } from '../lib/openmoji'
  import { prefs } from '../lib/prefs.svelte'

  let {
    icon = null,
    emoji = null,
    name,
    size = 28,
  }: {
    /** Stored icon value: a bare line slug, or a hand-picked 'kind:value'. */
    icon?: string | null
    /** The item's own emoji, used by the Emoji and Inked styles. */
    emoji?: string | null
    /** Item name — supplies the letter when there is nothing else. */
    name: string
    size?: number
  } = $props()

  let ref = $derived(parseIconRef(icon))

  /** The emoji to draw, if this glyph ends up being an emoji at all. */
  let glyph = $derived.by<{ kind: 'emoji' | 'inked'; char: string } | null>(() => {
    // A hand-picked emoji or OpenMoji beats the style preference outright.
    if (ref?.explicit && ref.kind !== 'line') return { kind: ref.kind, char: ref.value }
    // A hand-picked line drawing likewise: they asked for that drawing.
    if (ref?.explicit) return null

    if (!emoji) return null
    if (prefs.iconStyle === 'emoji') return { kind: 'emoji', char: emoji }
    if (prefs.iconStyle === 'inked') return { kind: 'inked', char: emoji }
    return null
  })

  // Inked falls back to the phone's emoji if we don't ship that drawing — better
  // a picture from the font than nothing, and it keeps the grid consistent.
  let inkedSrc = $derived(glyph?.kind === 'inked' ? openmojiSrc(glyph.char) : null)

  let paths = $derived(ref?.kind === 'line' && hasIcon(ref.value) ? ICONS[ref.value] : null)
</script>

{#if inkedSrc}
  <img class="inked" src={inkedSrc} width={size} height={size} alt="" aria-hidden="true" />
{:else if glyph}
  <span class="emoji" style="font-size: {size * 0.86}px" aria-hidden="true">{glyph.char}</span>
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
    filter: var(--icon-emoji-filter);
  }

  .inked {
    display: block;
    /* OpenMoji's palette is flatter than the phone's emoji to begin with, so it
       needs a lighter touch — but it still sits next to a very quiet interface. */
    filter: var(--icon-inked-filter);
  }
</style>
