<!--
  One grocery tile — an emoji (or a generated first-letter square), a name, and
  optional badges.

  Used in two places with different meanings, which is why `state` exists rather
  than the component reading anything global:
    - in the catalogue sheet, `on-list` means "already added, tapping does
      nothing", per NIU.md §4.1
    - on the list itself, `checked` means "in the trolley", greyed out

  Sized so three fit across a 412px phone with comfortable gutters, and the whole
  tile is the tap target — never just the label.
-->
<script lang="ts">
  import { initialFor } from '../lib/list-view'
  import { strings } from '../lib/strings'

  let {
    name,
    icon = null,
    state = 'default',
    isNew = false,
    urgent = false,
    detail = null,
    onclick,
    onlongpress,
  }: {
    name: string
    icon?: string | null
    state?: 'default' | 'on-list' | 'checked'
    isNew?: boolean
    urgent?: boolean
    /** Small line under the name — quantity, or a note. */
    detail?: string | null
    onclick?: () => void
    /** Press and hold. Used for the optional details, which are rarely needed. */
    onlongpress?: () => void
  } = $props()

  // Tap ticks an item off; press-and-hold opens its details. Tap gets the
  // frequent action because it's the one done a dozen times per shop.
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
    // A completed long press already did its thing; don't also tick the item.
    if (fired) {
      fired = false
      return
    }
    onclick?.()
  }
</script>

<button
  class="tile"
  class:on-list={state === 'on-list'}
  class:checked={state === 'checked'}
  onclick={handleClick}
  onpointerdown={start}
  onpointerup={cancel}
  onpointerleave={cancel}
  onpointercancel={cancel}
  oncontextmenu={(event) => {
    // Android shows a text-selection menu on long press otherwise, which lands
    // on top of the sheet we just opened.
    if (onlongpress) event.preventDefault()
  }}
  disabled={state === 'on-list'}
  aria-label={state === 'on-list' ? `${name} — ${strings.shopping.alreadyOnList}` : name}
>
  <span class="glyph" aria-hidden="true">
    {#if icon}
      {icon}
    {:else}
      <span class="initial">{initialFor(name)}</span>
    {/if}
  </span>

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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-2);
    min-height: 5.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    text-align: center;
    transition:
      transform var(--dur-fast) var(--ease),
      opacity var(--dur-fast) var(--ease);
  }

  .tile:active:not(:disabled) {
    transform: scale(0.96);
    background: var(--color-surface-sunken);
  }

  /* Already on the list: visibly inert, because tapping it deliberately does
     nothing rather than adding a second copy. */
  .tile.on-list {
    opacity: 0.4;
    cursor: default;
  }

  /* In the trolley. */
  .tile.checked {
    opacity: 0.55;
    background: var(--color-surface-sunken);
  }

  .tile.checked .name {
    text-decoration: line-through;
  }

  .glyph {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    font-size: 1.6rem;
    line-height: 1;
  }

  .initial {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    border-radius: var(--radius-sm);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
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
  }

  .detail {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
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
