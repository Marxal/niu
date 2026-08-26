<!--
  One grocery tile: a line icon (or the item's outlined initial), a name, and
  optional badges.

  One colour, always. The icon, the letter and the label all take the tile's
  `color`, and the tile picks that from its state — accent while it's something
  you still need, muted once it's in the trolley, faint in the picker. Nothing
  inside sets a colour of its own, which is what keeps a grid of 40 mixed tiles
  looking like one set rather than a sticker album.

  Three states, and they mean different things in the two places this is used:
    list    something on the shopping list, still to buy
    checked in the trolley — greyed, struck through
    pick    a catalogue tile you can tap to add

  Sized so the whole tile is the tap target, never just the label.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import { strings } from '../lib/strings'

  let {
    name,
    icon = null,
    state = 'list',
    isNew = false,
    urgent = false,
    detail = null,
    onclick,
    onlongpress,
  }: {
    name: string
    /** Icon slug, or null for the outlined initial. */
    icon?: string | null
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
  class="tile {state}"
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
  <span class="glyph"><GroceryIcon {icon} {name} size={30} /></span>

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

  /* On the list and still needed: the accent. */
  .tile.list {
    color: var(--color-accent);
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }

  /* In the trolley: drained of colour, but still readable. */
  .tile.checked {
    color: var(--color-text-faint);
    background: var(--color-surface-sunken);
  }

  .tile.checked .name {
    text-decoration: line-through;
  }

  /* In the picker: quiet, so the list above stays the loud thing. */
  .tile.pick {
    color: var(--color-text-muted);
  }

  .tile:active {
    transform: scale(0.94);
  }

  .glyph {
    display: grid;
    place-items: center;
    height: 1.875rem;
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
