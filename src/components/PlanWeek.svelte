<!--
  The whole week on one screen: seven rows, one column per meal.

  Its job is different from the day view's, and that difference is the reason
  both exist. The day view answers "what are we having tonight" and has room to
  say it properly. This answers "what does the week look like" — where the gaps
  are, whether there are three fish nights in a row, which evenings are already
  spoken for. It is also where a drag is worth the effort, because Monday and
  Friday are both on screen at once and the card only has to travel an inch.

  So the cards here are the compact ones: a picture and a name, no cooking glyph
  and no note. Anything you want to *read* is one tap away in the day view.

  Every cell is a drop target, empty ones included — an empty Thursday you can
  drop Wednesday's dinner onto is the whole point.
-->
<script lang="ts">
  import PlanCard from './PlanCard.svelte'
  import type { Dish } from '../lib/dishes'
  import type { DishTag } from '../lib/dish-tags'
  import { type DragSlot, carry, drag, slotKey } from '../lib/drag.svelte'
  import {
    MEAL_LABELS,
    type Meal,
    type PlanEntry,
    type Rhythm,
    dayName,
    entriesIn,
    shortDayName,
  } from '../lib/plan'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    days,
    today,
    meals,
    entries,
    dishesById,
    itemsById,
    tags,
    rhythm,
    onAdd,
    onOpen,
    onDrop,
    onSwipeAway,
    freshId = null,
  }: {
    days: string[]
    today: string
    meals: readonly Meal[]
    entries: readonly PlanEntry[]
    dishesById: ReadonlyMap<string, Dish>
    itemsById: ReadonlyMap<string, CatalogueItem>
    tags: DishTag[]
    rhythm: ReadonlyMap<string, Rhythm>
    onAdd: (date: string, meal: Meal) => void
    onOpen: (entry: PlanEntry) => void
    onDrop: (id: string, slot: DragSlot) => void
    onSwipeAway: (id: string) => void
    /** The entry this phone just planted, so it can play its arrival once. */
    freshId?: string | null
  } = $props()

  let columns = $derived(`2.75rem repeat(${meals.length}, minmax(0, 1fr))`)
</script>

<div class="week" style={`--columns: ${columns}`}>
  <div class="head" role="presentation">
    <span></span>
    {#each meals as meal (meal)}
      <span class="meal-label">{MEAL_LABELS[meal]}</span>
    {/each}
  </div>

  {#each days as date (date)}
    <div class="row" class:today={date === today} class:past={date < today}>
      <span class="day" aria-label={dayName(date, today)}>
        <span class="short">{shortDayName(date)}</span>
      </span>

      {#each meals as meal (meal)}
        {@const cell = entriesIn(entries, { date, meal })}
        <div
          class="cell"
          class:over={(drag.active && drag.overKey === slotKey(date, meal)) ||
            (carry.active && carry.overKey === slotKey(date, meal))}
          data-slot-date={date}
          data-slot-meal={meal}
        >
          {#each cell as entry (entry.id)}
            <PlanCard
              {entry}
              dish={entry.dishId ? (dishesById.get(entry.dishId) ?? null) : null}
              item={entry.itemId ? (itemsById.get(entry.itemId) ?? null) : null}
              {tags}
              rhythm={rhythm.get(entry.id) ?? null}
              size="compact"
              dragging={drag.entryId === entry.id}
              fresh={entry.id === freshId}
              onclick={() => onOpen(entry)}
              {onDrop}
              {onSwipeAway}
            />
          {/each}

          <button
            class="add"
            onclick={() => onAdd(date, meal)}
            aria-label={strings.plan.addTo(MEAL_LABELS[meal])}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .week {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .head,
  .row {
    display: grid;
    grid-template-columns: var(--columns);
    gap: var(--space-1);
    align-items: stretch;
  }

  .head {
    padding-bottom: var(--space-1);
  }

  .meal-label {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: 0.03em;
    text-align: center;
    text-transform: uppercase;
  }

  .row {
    padding: var(--space-1) 0;
    border-top: 1px solid var(--color-border);
  }

  .row.past {
    opacity: 0.55;
  }

  /* Aligned to the top of the row rather than centred in it: a row whose cells
     hold two cards is tall, and a day name floating in the middle of it stops
     reading as the label for the card beside it. */
  .day {
    display: grid;
    place-items: start;
    padding-top: var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
  }

  .row.today .day {
    color: var(--color-tab-meals);
  }

  .cell {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-height: 2.75rem;
    padding: 2px;
    border: 2px dashed transparent;
    border-radius: var(--radius-sm);
  }

  .cell.over {
    border-color: var(--color-tab-meals);
    background: var(--color-surface-sunken);
  }

  /* Small, because seven days of them are on screen at once — but still the
     full height of the cell, so the tap target is the cell rather than the icon. */
  .add {
    display: grid;
    flex: 1 0 1.5rem;
    place-items: center;
    min-height: 1.5rem;
    border-radius: var(--radius-sm);
    color: var(--color-text-faint);
    opacity: 0.7;
  }

  .add:active {
    background: var(--color-surface-sunken);
    opacity: 1;
  }
</style>
