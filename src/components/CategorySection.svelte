<!--
  One collapsible category in the picker — a header row that opens a grid of
  tiles under it.

  Collapsed by default, all of them. With ten categories and 360 items, open-by-
  default would bury the list itself under a wall of tiles you mostly don't want.
  The top row of suggestions is what covers the common case; these are for when
  it doesn't.

  Open/closed is per-category and lives in the parent, so opening Bakery doesn't
  close Dairy, and searching can force them all open without losing what you had
  open before.
-->
<script lang="ts">
  import { slide } from 'svelte/transition'
  import { flip } from 'svelte/animate'
  import GroceryIcon from './GroceryIcon.svelte'
  import ItemTile from './ItemTile.svelte'
  import { tileIn, tileOut } from '../lib/motion'
  import type { PickerItem } from '../lib/list-view'

  let {
    name,
    icon,
    items,
    open,
    onToggle,
    onAdd,
    onHide,
  }: {
    name: string
    icon: string | null
    items: PickerItem[]
    open: boolean
    onToggle: () => void
    onAdd: (id: string) => void
    onHide: (item: PickerItem) => void
  } = $props()
</script>

<section class="category" class:open>
  <button class="header" onclick={onToggle} aria-expanded={open}>
    <span class="lead">
      <GroceryIcon {icon} {name} size={22} />
      <span class="title">{name}</span>
    </span>
    <span class="right">
      <span class="count">{items.length}</span>
      <svg
        class="chevron"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </span>
  </button>

  {#if open}
    <div class="body" transition:slide={{ duration: 220 }}>
      <div class="grid">
        {#each items as item (item.id)}
          <div animate:flip={{ duration: 240 }} in:tileIn out:tileOut>
            <ItemTile
              name={item.name}
              icon={item.icon}
              state="pick"
              onclick={() => onAdd(item.id)}
              onlongpress={() => onHide(item)}
            />
          </div>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .category {
    border-bottom: 1px solid var(--color-border);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--tap-min);
    padding: var(--space-2) 0;
    color: var(--color-text);
    text-align: left;
  }

  .header:active {
    color: var(--color-accent);
  }

  .lead {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .title {
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-faint);
  }

  .count {
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .chevron {
    transition: transform var(--dur-base) var(--ease);
  }

  .category.open .chevron {
    transform: rotate(90deg);
  }

  .body {
    /* The slide transition animates height; overflow hides the tiles mid-slide
       so they don't spill past the section while it opens. */
    overflow: hidden;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.75rem, 1fr));
    gap: var(--space-2);
    /* Rows size to the tallest tile in them, and each tile fills its cell, so a
       two-line name can't leave its neighbours short. */
    grid-auto-rows: 1fr;
    align-items: stretch;
    padding-bottom: var(--space-4);
  }
</style>
