<!--
  One dish in the library: its picture, its name, and one line saying what it is.

  A row rather than a tile, and that is the whole design decision here. The
  shopping catalogue is a grid because tapping is the point and forty things
  have to fit on a screen. The library is a reference: twenty-odd dishes you
  read rather than scan, each of which has three facts worth showing — what part
  of a meal it is, how much cooking it takes, how many things it needs — and a
  grid tile has room for none of them.

  It is deliberately in the Meals tint rather than the shopping list's green,
  because tapping here opens the dish for editing. Tapping a dish to *add* its
  ingredients happens on the shopping tab, where it is a green tile like
  everything else you can add.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import { type Dish, describeDish } from '../lib/dishes'

  let { dish, onclick }: { dish: Dish; onclick: () => void } = $props()
</script>

<button class="row" {onclick}>
  <span class="glyph">
    <GroceryIcon icon={dish.icon} name={dish.name} size={26} />
  </span>
  <span class="text">
    <span class="name">{dish.name}</span>
    <span class="meta">{describeDish(dish)}</span>
  </span>
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
</button>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--tap-min);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-tab-meals);
    text-align: left;
    transition: transform var(--dur-fast) var(--ease);
  }

  .row:active {
    transform: scale(0.98);
  }

  .glyph {
    display: grid;
    place-items: center;
    flex: none;
    width: 2.25rem;
    height: 2.25rem;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
    min-width: 0;
  }

  .name {
    color: var(--color-text);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    overflow-wrap: anywhere;
  }

  .meta {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }

  .chevron {
    flex: none;
    color: var(--color-text-faint);
  }
</style>
