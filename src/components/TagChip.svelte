<!--
  One "part of a meal" — the coloured pill a dish wears.

  The colour arrives as a *name* ('clay'), never a value: tagStyle() turns it
  into a pair of custom properties pointing at the token file, which is the only
  place in this project a colour is written down. That is what lets the user
  pick a colour without a hex value ever reaching a component.

  Three sizes of the same thing rather than three components:
    chip   the default, with its label — in the editor and on a dish card
    dot    colour only, for where there is no room for words
  and `on` for the editor's selected state, which fills the pill rather than
  outlining it so a chosen part reads as chosen at arm's length.
-->
<script lang="ts">
  import { type DishTag, tagStyle } from '../lib/dish-tags'

  let {
    tag,
    size = 'chip',
    on = false,
    onclick,
    onlongpress,
  }: {
    tag: DishTag
    size?: 'chip' | 'dot'
    /** Selected. Only meaningful where the chip is a control. */
    on?: boolean
    onclick?: (() => void) | undefined
    onlongpress?: (() => void) | undefined
  } = $props()

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
    if (fired) {
      fired = false
      return
    }
    onclick?.()
  }
</script>

{#if onclick || onlongpress}
  <button
    class="tag {size}"
    class:on
    style={tagStyle(tag.colour)}
    aria-pressed={onclick ? on : undefined}
    onclick={handleClick}
    onpointerdown={start}
    onpointerup={cancel}
    onpointerleave={cancel}
    onpointercancel={cancel}
    oncontextmenu={(event) => {
      if (onlongpress) event.preventDefault()
    }}
  >
    {#if size === 'chip'}{tag.name}{/if}
  </button>
{:else}
  <span class="tag {size}" class:on style={tagStyle(tag.colour)} title={tag.name}>
    {#if size === 'chip'}{tag.name}{/if}
  </span>
{/if}

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--tag-ink);
    border-radius: var(--radius-full);
    background: var(--tag-fill);
    color: var(--tag-ink);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    line-height: var(--leading-tight);
    transition:
      background var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease);
  }

  .chip {
    min-height: 2.25rem;
    padding: 0 var(--space-3);
  }

  /* Filled, not outlined: at arm's length an outlined pill and a filled one are
     the difference between "this exists" and "this is chosen". */
  .tag.on {
    background: var(--tag-ink);
    color: var(--color-surface);
  }

  .dot {
    width: var(--space-2);
    height: var(--space-2);
    padding: 0;
    background: var(--tag-ink);
    border: none;
  }

  button.tag:active {
    transform: scale(0.96);
  }
</style>
