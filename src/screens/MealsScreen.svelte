<!--
  The Meals tab, which for now is the dish library.

  NIU.md §4.2: "There is only one concept: a dish." Round 8 builds the dishes
  themselves and the shopping half of what they do — the weekly plan they get
  dropped into is the next round. So this screen is the library: write down what
  you cook, say what it's made of, and it turns up as a tappable tile in the
  shopping catalogue.

  There is no search box. A household has twenty-odd dishes, not three hundred,
  and a list of twenty is faster to look down than to type into. If the library
  ever gets long enough to need one, that is the moment to add it.
-->
<script lang="ts">
  import { flip } from 'svelte/animate'
  import DishRow from '../components/DishRow.svelte'
  import DishSheet from '../components/DishSheet.svelte'
  import Placeholder from '../components/Placeholder.svelte'
  import { auth } from '../lib/auth.svelte'
  import { isConfigured } from '../lib/config'
  import { type Dish, sortDishes } from '../lib/dishes'
  import { dishes } from '../lib/dishes.svelte'
  import { FLIP_MS, tileIn, tileOut } from '../lib/motion'
  import { strings } from '../lib/strings'

  /**
   * What the sheet is showing: nothing, a new dish, or one being edited.
   * Three states in one variable so they can't disagree — 'new' and a dish open
   * the same sheet with different contents.
   */
  let editing = $state<Dish | 'new' | null>(null)

  let library = $derived(sortDishes(dishes.all))
</script>

{#if !isConfigured}
  <Placeholder
    name="meals"
    heading={strings.screens.meals.heading}
    blurb={strings.screens.meals.blurb}
  />
{:else}
  <div class="screen">
    {#if dishes.error}
      <p class="error" role="alert">{dishes.error}</p>
    {/if}

    <p class="hint">{strings.dishes.hint}</p>

    <button class="new" onclick={() => (editing = 'new')}>
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

    {#if library.length === 0}
      <div class="empty">
        <h2>{strings.dishes.emptyTitle}</h2>
        <p>{strings.dishes.emptyBlurb}</p>
      </div>
    {:else}
      <div class="rows">
        {#each library as dish (dish.id)}
          <div animate:flip={{ duration: FLIP_MS }} in:tileIn out:tileOut>
            <DishRow {dish} onclick={() => (editing = dish)} />
          </div>
        {/each}
      </div>
    {/if}

    <p class="note">{strings.dishes.plannerNote}</p>
  </div>

  {#if editing}
    <!-- Keyed so opening a different dish mounts a fresh sheet: the draft fields
         inside snapshot their dish once and never re-sync. -->
    {#key editing === 'new' ? 'new' : editing.id}
      <DishSheet
        dish={editing === 'new' ? null : editing}
        userId={auth.userId}
        onClose={() => (editing = null)}
      />
    {/key}
  {/if}
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    padding-bottom: var(--space-7);
  }

  .hint {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .new {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--tap-min);
    border-radius: var(--radius-full);
    background: var(--color-tab-meals);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
    box-shadow: var(--shadow-1);
  }

  .new:active {
    transform: scale(0.98);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-4);
    text-align: center;
  }

  .empty h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  .empty p {
    max-width: 20rem;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .note {
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  .error {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-danger);
    font-size: var(--text-sm);
    text-align: center;
  }
</style>
