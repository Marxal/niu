<!--
  One grocery tile: a line icon (or the item's outlined initial), a name, and
  optional badges.

  Three states, each with its own colour, so the two grids can be told apart at
  a glance from arm's length mid-shop:
    list    still to buy — red
    checked in the trolley — grey, struck through, faded
    pick    a catalogue tile you can tap to add — green

  Everything inside takes the tile's `color`; nothing sets a colour of its own.
  That is what keeps forty tiles reading as one set rather than a sticker album,
  and it is why swapping the icon style to emoji only changes the glyph.

  `layout` switches between the tile shape and a single row, for the List view.

  Sized so the whole tile is the tap target, never just the label.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import { strings } from '../lib/strings'

  let {
    name,
    icon = null,
    emoji = null,
    state = 'list',
    isNew = false,
    urgent = false,
    detail = null,
    layout = 'tile',
    onclick,
    onlongpress,
  }: {
    name: string
    /** Icon slug, or null for the outlined initial. */
    icon?: string | null
    /** The item's emoji, used only under the Colour icon style. */
    emoji?: string | null
    /** Tile grid, or a single full-width row. */
    layout?: 'tile' | 'row'
    state?: 'list' | 'checked' | 'pick'
    isNew?: boolean
    urgent?: boolean
    /** Small line under the name — quantity, or a note. */
    detail?: string | null
    onclick?: () => void
    /** Press and hold. Details on the list; remove-for-good in the picker. */
    onlongpress?: () => void
  } = $props()

  // Tap does the frequent thing; press-and-hold does the rare one.
  const LONG_PRESS_MS = 450

  let timer: ReturnType<typeof setTimeout> | null = null
  let fired = false

  function cancel() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function start() {
    if (!onlongpress) return
    fired = false
    cancel()
    timer = setTimeout(() => {
      fired = true
      timer = null
      onlongpress?.()
    }, LONG_PRESS_MS)
  }

  function handleClick() {
    // A completed long press already did its thing; don't also fire the tap.
    if (fired) {
      fired = false
      return
    }
    onclick?.()
  }
</script>

<button
  class="tile {state} {layout}"
  onclick={handleClick}
  onpointerdown={start}
  onpointerup={cancel}
  onpointerleave={cancel}
  onpointercancel={cancel}
  oncontextmenu={(event) => {
    // Android pops a text-selection menu on long press otherwise, right on top
    // of whatever the long press just opened.
    if (onlongpress) event.preventDefault()
  }}
  aria-label={name}
>
  <span class="glyph"><GroceryIcon {icon} {emoji} {name} size={layout === 'row' ? 26 : 30} /></span>

  <span class="name">{name}</span>

  {#if detail}
    <span class="detail">{detail}</span>
  {/if}

  {#if isNew}
    <span class="badge new">{strings.shopping.newTag}</span>
  {/if}
  {#if urgent}
    <span class="badge urgent" aria-label={strings.shopping.urgent}>!</span>
  {/if}
</button>

<style>
  .tile {
    position: relative;
    /* A button sizes to its content even as a flex container, so without these
       the tiles come out different widths and heights inside equal grid cells. */
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-1);
    min-height: 5.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    text-align: center;
    transition:
      transform var(--dur-fast) var(--ease),
      background var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease);
  }

  /* Still to buy: red. */
  .tile.list {
    color: var(--color-need);
    border-color: var(--color-need-border);
    background: var(--color-need-soft);
  }

  /* In the trolley: grey and faded, so it reads as done and temporary. */
  .tile.checked {
    color: var(--color-done);
    border-color: var(--color-done-border);
    background: var(--color-done-soft);
    opacity: 0.62;
  }

  .tile.checked .name {
    text-decoration: line-through;
  }

  /* In the picker: green, and quieter than the list above it. */
  .tile.pick {
    color: var(--color-pick);
    border-color: var(--color-pick-border);
    background: var(--color-pick-soft);
  }

  .tile:active {
    transform: scale(0.94);
  }

  .glyph {
    display: grid;
    place-items: center;
    height: 1.875rem;
  }

  /* ---- Row layout, for the List view ------------------------------------ */

  .tile.row {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-3);
    min-height: var(--tap-min);
    padding: var(--space-2) var(--space-3);
    text-align: left;
  }

  .tile.row .glyph {
    flex: none;
    height: 1.625rem;
  }

  .tile.row .name {
    flex: 1;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    font-size: var(--text-base);
  }

  .tile.row .detail {
    flex: none;
    font-size: var(--text-sm);
  }

  .tile.row .badge {
    position: static;
    flex: none;
  }

  .name {
    font-size: var(--text-xs);
    line-height: var(--leading-tight);
    /* Two lines then ellipsis, so a long name can't stretch the grid row. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .detail {
    opacity: 0.75;
    font-size: 0.6875rem;
    font-weight: var(--weight-medium);
    line-height: var(--leading-tight);
  }

  .badge {
    position: absolute;
    top: calc(var(--space-1) * -1);
    right: calc(var(--space-1) * -1);
    padding: 0 var(--space-1);
    border-radius: var(--radius-full);
    font-size: 0.625rem;
    font-weight: var(--weight-bold);
    line-height: 1.4;
  }

  .badge.new {
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }

  .badge.urgent {
    left: calc(var(--space-1) * -1);
    right: auto;
    display: grid;
    place-items: center;
    min-width: 1.1rem;
    height: 1.1rem;
    background: var(--color-danger);
    color: var(--color-accent-ink);
  }
</style>
