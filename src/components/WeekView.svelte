<!--
  A week, as seven days stacked down the screen.

  Marçal asked for a week view in round 11.1. The obvious shape — seven columns
  and a clock down the side, the way Google draws it on a laptop — does not
  survive a 412px screen: a column is 55px, which is four characters, so every
  event becomes a coloured smudge you have to tap to read.

  So a week here is **seven day blocks, one under the other**, each with its
  events written out in full. That is the same shape the meal planner's week
  view settled on in round 10, for the same reason, and it means the two tabs
  read alike. It also lets the rows be the same EventRow the month view's day
  list uses, so an event looks identical wherever you meet it.

  What the week view is *for*, and the month view isn't: seeing Thursday and
  Saturday at the same time without tapping either. So today is marked, empty
  days still appear (an empty Wednesday is information), and the whole thing
  scrolls as one — but the week you are *in* starts at today, because three
  spent days above the one you opened the app for is three screens of nothing.
-->
<script lang="ts">
  import type { CalendarEvent } from '../lib/calendar'
  import { eventsOn } from '../lib/calendar'
  import { dayName, shortDate, weekDaysFrom } from '../lib/dates'
  import { strings } from '../lib/strings'
  import EventRow from './EventRow.svelte'

  let {
    weekStart,
    today,
    events,
    unsyncedIds,
    onopen,
    ontoggleDone,
    onadd,
  }: {
    /** The Monday. */
    weekStart: string
    today: string
    events: readonly CalendarEvent[]
    unsyncedIds: Set<string>
    onopen: (event: CalendarEvent) => void
    ontoggleDone: (event: CalendarEvent) => void
    /** Tapping an empty day, or the + on a day, starts an event there. */
    onadd: (day: string) => void
  } = $props()

  /**
   * The current week starts at today; any other week shows all seven. Same rule
   * as the meal planner, written down in dates.ts — three empty days above the
   * one you opened the app for is three screens of scrolling.
   */
  let days = $derived(weekDaysFrom(weekStart, today))
</script>

<div class="week">
  {#each days as day (day)}
    {@const onThisDay = eventsOn(events, day)}
    <section class="day" class:today={day === today} class:empty={onThisDay.length === 0}>
      <header class="head">
        <h2>
          <span class="name">{dayName(day, today)}</span>
          <span class="date">{shortDate(day)}</span>
        </h2>
        <button class="add" aria-label={strings.calendar.add} onclick={() => onadd(day)}>＋</button>
      </header>

      {#if onThisDay.length === 0}
        <button class="blank" onclick={() => onadd(day)}>{strings.calendar.nothingOn}</button>
      {:else}
        <div class="rows">
          {#each onThisDay as event (event.id)}
            <EventRow
              {event}
              unsynced={unsyncedIds.has(event.id)}
              onopen={() => onopen(event)}
              ontoggleDone={() => ontoggleDone(event)}
            />
          {/each}
        </div>
      {/if}
    </section>
  {/each}
</div>

<style>
  .week {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-3) 0;
  }

  .day {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  h2 {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }

  .name {
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }

  /* Today's heading is the tab's own colour and nothing else changes. A whole
     tinted block would fight the coloured rows inside it. */
  .day.today .name {
    color: var(--color-tab-calendar);
  }

  .date {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
  }

  .add {
    flex: none;
    width: var(--tap-min);
    height: var(--tap-min);
    margin: calc(var(--space-2) * -1) 0;
    border: none;
    background: none;
    color: var(--color-text-faint);
    font-size: var(--text-lg);
    line-height: 1;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* An empty day is still a row you can tap — the fastest way to put something
     on Thursday is to tap Thursday. Dashed, so it reads as a gap rather than a
     thing. */
  .blank {
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-faint);
    font-size: var(--text-sm);
    text-align: left;
  }

  button:active {
    background: var(--color-surface-sunken);
  }
</style>
