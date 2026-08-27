<!--
  One meal on one day: the label, whatever is planned into it, and the way to add
  more. Also the drop target a dragged card lands on.

  The two `data-slot-*` attributes are how the drag finds it. drag.svelte.ts asks
  the DOM what is under the finger rather than keeping a register of rectangles,
  because a register goes stale the moment the page scrolls — which, during a
  drag across a week, it is doing constantly.

  A meal is a *bag*, not a set of slots (Marçal's call, round 10): it holds any
  number of things in the order they were put there, and there is no empty
  protein box demanding to be filled. See 0010_meal_plan.sql for the full
  reasoning. What the design does instead is let the colours do it — three cards
  in three tag colours reads as a balanced dinner without anything having to
  enforce one.
-->
<script lang="ts">
  import PlanCard from './PlanCard.svelte'
  import type { Dish } from '../lib/dishes'
  import type { DishTag } from '../lib/dish-tags'
  import { type DragSlot, drag, slotKey } from '../lib/drag.svelte'
  import { MEAL_LABELS, type Meal, type PlanEntry, type Rhythm } from '../lib/plan'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    date,
    meal,
    entries,
    dishesById,
    itemsById,
    tags,
    rhythm,
    onAdd,
    onOpen,
    onDrop,
  }: {
    date: string
    meal: Meal
    /** Already in order — see entriesIn() in plan.ts. */
    entries: PlanEntry[]
    dishesById: ReadonlyMap<string, Dish>
    itemsById: ReadonlyMap<string, CatalogueItem>
    tags: DishTag[]
    rhythm: ReadonlyMap<string, Rhythm>
    onAdd: (meal: Meal) => void
    onOpen: (entry: PlanEntry) => void
    onDrop: (id: string, slot: DragSlot) => void
  } = $props()

  let key = $derived(slotKey(date, meal))
  let over = $derived(drag.active && drag.overKey === key)
</script>

<section
  class="meal"
  class:over
  data-slot-date={date}
  data-slot-meal={meal}
  aria-label={`${MEAL_LABELS[meal]}, ${date}`}
>
  <h4 class="label">{MEAL_LABELS[meal]}</h4>

  <div class="cards">
    {#each entries as entry (entry.id)}
      <PlanCard
        {entry}
        dish={entry.dishId ? (dishesById.get(entry.dishId) ?? null) : null}
        item={entry.itemId ? (itemsById.get(entry.itemId) ?? null) : null}
        {tags}
        rhythm={rhythm.get(entry.id) ?? null}
        dragging={drag.entryId === entry.id}
        onclick={() => onOpen(entry)}
        {onDrop}
      />
    {/each}

    <button class="add" class:bare={entries.length === 0} onclick={() => onAdd(meal)}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {#if entries.length === 0}
        <span>{strings.plan.addTo(MEAL_LABELS[meal])}</span>
      {:else}
        <span class="sr">{strings.plan.addTo(MEAL_LABELS[meal])}</span>
      {/if}
    </button>
  </div>
</section>

<style>
  .meal {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-md);
    /* A transparent ring at rest, so lighting it up while dragging doesn't move
       anything by a pixel. */
    border: 2px dashed transparent;
  }

  /* The card is over this meal right now. Deliberately loud: at arm's length,
     mid-drag, with a finger covering a third of the screen, subtle is invisible. */
  .meal.over {
    border-color: var(--color-tab-meals);
    background: var(--color-surface-sunken);
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    border-radius: var(--radius-md);
    color: var(--color-text-faint);
    font-size: var(--text-sm);
  }

  /* Empty meal: the button is the meal, so it gets the dashed outline that says
     "something goes here" without pretending to be a slot that must be filled. */
  .add.bare {
    border: 1px dashed var(--color-border-strong);
  }

  /* With cards above it, it shrinks to a plus — the meal already reads as a
     meal and a full-width dashed bar under every one would double the noise. */
  .add:not(.bare) {
    min-height: 2rem;
  }

  .add:active {
    color: var(--color-text-muted);
    background: var(--color-surface-sunken);
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
