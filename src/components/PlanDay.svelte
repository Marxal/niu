<!--
  One day in the day view: its name, its date, and its meals.

  "Vertical scrolling days by default (the Daily Meal Planner shape)" — §4.2. So
  this is the generous version: full names, the cooking glyph, the note, room to
  drop something on. The week view next door is the compact one.

  Today gets a marked heading rather than a coloured card. The planner is looked
  at on a Sunday to plan the week as often as it is looked at on a Tuesday to see
  what's for dinner, and a card that shouts on one of those is in the way on the
  other.
-->
<script lang="ts">
  import PlanMeal from './PlanMeal.svelte'
  import type { Dish } from '../lib/dishes'
  import type { DishTag } from '../lib/dish-tags'
  import type { DragSlot } from '../lib/drag.svelte'
  import {
    type Meal,
    type PlanEntry,
    type Rhythm,
    dayName,
    entriesIn,
    shortDate,
  } from '../lib/plan'
  import type { CatalogueItem } from '../lib/shopping.svelte'

  let {
    date,
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
  }: {
    date: string
    today: string
    meals: readonly Meal[]
    /** The whole loaded plan; this filters out its own day. */
    entries: readonly PlanEntry[]
    dishesById: ReadonlyMap<string, Dish>
    itemsById: ReadonlyMap<string, CatalogueItem>
    tags: DishTag[]
    rhythm: ReadonlyMap<string, Rhythm>
    onAdd: (date: string, meal: Meal) => void
    onOpen: (entry: PlanEntry) => void
    onDrop: (id: string, slot: DragSlot) => void
  } = $props()

  let isToday = $derived(date === today)
  let isPast = $derived(date < today)
</script>

<article class="day" class:today={isToday} class:past={isPast}>
  <header>
    <h3>{dayName(date, today)}</h3>
    <span class="date">{shortDate(date)}</span>
  </header>

  {#each meals as meal (meal)}
    <PlanMeal
      {date}
      {meal}
      entries={entriesIn(entries, { date, meal })}
      {dishesById}
      {itemsById}
      {tags}
      {rhythm}
      onAdd={(m) => onAdd(date, m)}
      {onOpen}
      {onDrop}
    />
  {/each}
</article>

<style>
  .day {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-1);
    padding: var(--space-3) var(--space-2) var(--space-3);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-1);
  }

  /* A day already gone is still worth having — it is where "we had that on
     Tuesday" gets answered — but it should not compete with the days ahead. */
  .day.past {
    opacity: 0.62;
  }

  header {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    padding: 0 var(--space-2);
  }

  h3 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    line-height: var(--leading-tight);
  }

  .today h3 {
    color: var(--color-tab-meals);
  }

  .date {
    color: var(--color-text-faint);
    font-size: var(--text-sm);
  }
</style>
