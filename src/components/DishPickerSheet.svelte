<!--
  "That belongs in a dish" — reached by long-pressing a tile on the shopping tab.

  It exists because of when you actually notice a dish is missing something:
  standing in the shop looking at chickpeas, not sitting in the dish editor. The
  round trip through Meals → find the dish → edit → search the catalogue → save
  is four screens to record one fact you already know.

  Deliberately the *only* thing this sheet does. There is no reordering, no
  editing, no removing — pick a dish, or write a new one that starts with this
  item already in it.
-->
<script lang="ts">
  import DishRow from './DishRow.svelte'
  import { sortDishes } from '../lib/dishes'
  import { dishes } from '../lib/dishes.svelte'
  import { strings } from '../lib/strings'

  let {
    itemName,
    onPick,
    onNew,
    onClose,
  }: {
    /** The tile being filed, shown so it is obvious what "this" is. */
    itemName: string
    onPick: (dishId: string) => void
    /** Write a new dish that starts with this item in it. */
    onNew: () => void
    onClose: () => void
  } = $props()

  let library = $derived(sortDishes(dishes.all))
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.dishes.pickTitle}>
  <header>
    <div>
      <h2>{strings.dishes.pickTitle}</h2>
      <p>{itemName} — {strings.dishes.pickHint}</p>
    </div>
    <button class="close" onclick={onClose} aria-label={strings.shopping.close}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </header>

  <div class="scroller">
    {#if library.length === 0}
      <p class="none">{strings.dishes.pickEmpty}</p>
    {:else}
      <div class="rows">
        {#each library as dish (dish.id)}
          <DishRow {dish} onclick={() => onPick(dish.id)} />
        {/each}
      </div>
    {/if}
  </div>

  <button class="new" onclick={onNew}>
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
    {strings.dishes.new}
  </button>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-sheet);
    background: var(--color-overlay);
  }

  .sheet {
    position: fixed;
    inset: auto 0 0 0;
    z-index: var(--z-sheet);
    display: grid;
    /* Header and the New button stay put; only the library scrolls. */
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-3);
    max-height: 78vh;
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
    background: var(--color-surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-2);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  header p {
    margin-top: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .close {
    display: grid;
    flex: none;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    margin-right: calc(var(--space-2) * -1);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
  }

  .scroller {
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .none {
    padding: var(--space-5) var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    text-align: center;
  }

  .new {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    border-radius: var(--radius-full);
    background: var(--color-tab-meals);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }
</style>
