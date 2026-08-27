<!--
  The month, as a grid of days.

  §4.3: "Default view: month grid." On a 412px screen a cell is about 52px wide,
  which is room for a number and a row of dots and nothing else — so the grid's
  job is *where*, not *what*. What is on a day is answered by the list below it,
  which is why tapping a cell selects rather than navigates.

  Three things the design has to get right at this size:

   - **The dots are the event colours**, up to three, then a "+n". Three dots is
     the most that reads as countable at a glance; a fourth is just texture.
   - **Today is a filled circle, the selected day is a ring.** Two different
     marks because they are two different facts and they are usually on
     different days — a single style would make "today" disappear the moment you
     looked at next week.
   - **Days either side of the month are dimmed, not hidden.** A holiday that
     runs from the 30th to the 2nd has to be visible on both.

  Swiping between months is deliberately not here: the whole screen scrolls
  vertically and a horizontal swipe on the grid would fight the browser's own
  back gesture at the screen edge, which on Android is the one gesture you
  cannot afford to break.
-->
<script lang="ts">
  import type { CalendarEvent } from '../lib/calendar'
  import { isUnconfirmed } from '../lib/calendar'
  import { monthGrid, monthKey, WEEKDAY_INITIALS } from '../lib/dates'
  import { tagStyle } from '../lib/dish-tags'
  import { strings } from '../lib/strings'

  let {
    month,
    selected,
    today,
    byDay,
    onselect,
  }: {
    /** 'YYYY-MM'. */
    month: string
    selected: string
    today: string
    byDay: Map<string, CalendarEvent[]>
    onselect: (day: string) => void
  } = $props()

  let days = $derived(monthGrid(month))

  /** At most three dots; the rest become a count. */
  function dots(day: string): CalendarEvent[] {
    return (byDay.get(day) ?? []).slice(0, 3)
  }

  function extra(day: string): number {
    return Math.max(0, (byDay.get(day) ?? []).length - 3)
  }

  function labelFor(day: string): string {
    const count = byDay.get(day)?.length ?? 0
    const date = Number(day.slice(8))
    return count === 0 ? `${date}` : `${date}, ${count}`
  }
</script>

<div class="grid-wrap">
  <div class="headings" aria-hidden="true">
    {#each WEEKDAY_INITIALS as initial, i (i)}
      <span class="heading">{initial}</span>
    {/each}
  </div>

  <div class="grid" role="grid" aria-label={strings.calendar.title}>
    {#each days as day (day)}
      {@const outside = monthKey(day) !== month}
      <button
        class="cell"
        class:outside
        class:today={day === today}
        class:selected={day === selected}
        role="gridcell"
        aria-selected={day === selected}
        aria-label={labelFor(day)}
        onclick={() => onselect(day)}
      >
        <span class="date">{Number(day.slice(8))}</span>
        <span class="dots">
          {#each dots(day) as event (event.id)}
            <span
              class="dot"
              class:waiting={isUnconfirmed(event)}
              class:done={event.doneAt !== null}
              style={tagStyle(event.colour)}
            ></span>
          {/each}
          {#if extra(day) > 0}<span class="more">+{extra(day)}</span>{/if}
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .grid-wrap {
    padding: 0 var(--space-2);
  }

  .headings,
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }

  .heading {
    text-align: center;
    padding-bottom: var(--space-1);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    color: var(--color-text-faint);
  }

  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-1);
    /* Not --tap-min: seven of those across 412px is 384px of grid and the row
       still has to breathe. 44px is what fits, and it is a comfortable target
       when the whole cell is the button. */
    min-height: 2.75rem;
    padding: var(--space-1) 0 var(--space-2);
    border: none;
    background: none;
    color: var(--color-text);
    font-size: var(--text-sm);
    border-radius: var(--radius-md);
  }

  .cell.outside .date {
    color: var(--color-text-faint);
  }

  .date {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-full);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  /* Today is filled; the day you are looking at is ringed. Two marks, because
     they are two facts and usually two different days. */
  .cell.today .date {
    background: var(--color-tab-calendar);
    color: var(--color-accent-ink);
    font-weight: var(--weight-bold);
  }

  .cell.selected {
    background: var(--color-surface-sunken);
  }

  .cell.selected .date {
    box-shadow: 0 0 0 2px var(--color-tab-calendar);
  }

  .cell.today.selected .date {
    box-shadow: 0 0 0 2px var(--color-surface-sunken), 0 0 0 4px var(--color-tab-calendar);
  }

  .dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 0.375rem;
  }

  .dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: var(--radius-full);
    background: var(--tag-ink);
  }

  /* An unanswered event is a ring — the same "not settled yet" idea the dashed
     card in the list uses, in the only form a dot this size can carry it.

     The hole is the *page* colour rather than the tag's own soft fill. At 7px a
     tinted hole inside a tinted ring is a slightly muddy dot, not a ring; the
     first attempt at this was invisible on a phone. */
  .dot.waiting {
    width: 0.4375rem;
    height: 0.4375rem;
    background: var(--color-bg);
    box-shadow: inset 0 0 0 2px var(--tag-ink);
  }

  /* Inside the selected cell the ground is the sunken colour, so the hole has
     to match that instead or the ring picks up a pale halo. */
  .cell.selected .dot.waiting {
    background: var(--color-surface-sunken);
  }

  .dot.done {
    opacity: 0.35;
  }

  .more {
    font-size: 0.625rem;
    line-height: 1;
    color: var(--color-text-faint);
  }

  .cell:active {
    background: var(--color-surface-sunken);
  }
</style>
