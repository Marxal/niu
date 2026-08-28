<!--
  The month, as a grid of days with the events drawn on top of it.

  §4.3: "Default view: month grid." Round 11 drew one coloured dot per event;
  round 11.1 replaced them with small boxes carrying the title, and **a holiday
  running Friday to Tuesday as one unbroken bar**. Round 12 keeps both and lets
  the day choose between them.

  ## Boxes, bars and dots

  Marçal, after a busy fortnight: *"if there's more than one event it gets too
  crowded. one event show the text, more than one event show dots instead."*

  So a day with one thing on it says what that thing is, and a day with three
  says that there are three and leaves the reading to the list underneath. The
  exception is a multi-day event, which is always a bar — five dots on five days
  say five things happened, not that one thing lasted five days. The rule itself
  lives in grid-layout.ts, which is pure and tested; this file turns it into CSS.

  ## Why the bars are not inside the cells

  A box that spans five days cannot live inside a day cell — a cell cannot draw
  outside itself. So a week is two layers:

    .cells   seven buttons. The tap targets, the date numbers, the dots, the "+2".
    .bars    one CSS grid on top, where a box is `grid-column: 3 / span 5`.

  The bars layer is `pointer-events: none`, so every tap lands on the day
  underneath. That is deliberate rather than lazy: a 17px-tall box is not a
  touch target, and the list below the grid is where an event is meant to be
  read and opened. The grid answers *where*; the list answers *what*.

  Dots, by contrast, live inside their cell — a dot never spans anything, so it
  has no reason to leave.

  ## The week numbers

  A narrow column down the left, on by default and switchable off in Settings
  (round 12). It sits *outside* the seven-column grid rather than as an eighth
  column of it, which is what keeps the bars layer's arithmetic seven-based and
  unchanged whether the numbers are showing or not.

  ## Sizing

  One lane is `--lane-step` tall and a week reserves exactly as many as it uses,
  so a quiet week is short and a busy one is tall. That is worth more than a
  grid of equal rows: the month you are looking at is mostly quiet, and equal
  rows would size every week to the worst one.
-->
<script lang="ts">
  import type { CalendarEvent } from '../lib/calendar'
  import { isUnconfirmed } from '../lib/calendar'
  import { isoWeek, monthGrid, monthKey, WEEKDAY_INITIALS } from '../lib/dates'
  import { tagStyle } from '../lib/dish-tags'
  import { layOutGrid, showsTime } from '../lib/grid-layout'
  import { strings } from '../lib/strings'

  let {
    month,
    selected,
    today,
    events,
    byDay,
    weekNumbers = true,
    onselect,
  }: {
    /** 'YYYY-MM'. */
    month: string
    selected: string
    today: string
    /** Everything loaded. The layout picks out what each week needs. */
    events: readonly CalendarEvent[]
    /** Day key to the events on it, for the "+n" count and the labels. */
    byDay: Map<string, CalendarEvent[]>
    /** The ISO week down the left. A device preference — see prefs.svelte.ts. */
    weekNumbers?: boolean
    onselect: (day: string) => void
  } = $props()

  let days = $derived(monthGrid(month))
  let weeks = $derived(layOutGrid(days, events))

  function labelFor(day: string): string {
    const count = byDay.get(day)?.length ?? 0
    const date = Number(day.slice(8))
    return count === 0 ? `${date}` : `${date}, ${count}`
  }
</script>

<div class="grid-wrap" class:with-weeks={weekNumbers}>
  <div class="headings" aria-hidden="true">
    {#if weekNumbers}<span class="wk head-wk">{strings.calendar.weekAbbrev}</span>{/if}
    <div class="heading-days">
      {#each WEEKDAY_INITIALS as initial, i (i)}
        <span class="heading">{initial}</span>
      {/each}
    </div>
  </div>

  <div class="grid" role="grid" aria-label={strings.calendar.title}>
    {#each weeks as week, w (w)}
      {@const weekDays = days.slice(w * 7, w * 7 + 7)}
      {@const monday = weekDays[0]}
      <div class="week" style="--lanes: {week.lanes}">
        {#if weekNumbers && monday}
          <span class="wk" aria-hidden="true">{isoWeek(monday)}</span>
        {/if}

        <div class="stack">
          <div class="cells" role="row">
            {#each weekDays as day, column (day)}
              <button
                class="cell"
                class:outside={monthKey(day) !== month}
                class:today={day === today}
                class:selected={day === selected}
                role="gridcell"
                aria-selected={day === selected}
                aria-label={labelFor(day)}
                onclick={() => onselect(day)}
              >
                <span class="date">{Number(day.slice(8))}</span>
                <span class="reserved"></span>
                {#if (week.dots[column] ?? []).length > 0}
                  <span class="dots">
                    {#each week.dots[column] ?? [] as event (event.id)}
                      <span
                        class="dot"
                        class:waiting={isUnconfirmed(event)}
                        class:done={event.doneAt !== null}
                        style={tagStyle(event.colour)}
                      ></span>
                    {/each}
                  </span>
                {/if}
                {#if (week.overflow[column] ?? 0) > 0}
                  <span class="more">+{week.overflow[column]}</span>
                {/if}
              </button>
            {/each}
          </div>

          <div class="bars" aria-hidden="true">
            {#each week.segments as segment (segment.event.id)}
              <span
                class="bar"
                class:waiting={isUnconfirmed(segment.event)}
                class:done={segment.event.doneAt !== null}
                class:all-day={segment.event.startTime === null}
                class:from-before={segment.clippedStart}
                class:into-after={segment.clippedEnd}
                style="{tagStyle(segment.event.colour)}; --col: {segment.column}; --span: {segment.span}; --lane: {segment.lane}"
              >
                {#if showsTime(segment)}<b class="at">{segment.event.startTime}</b>{/if}
                <span class="text">{segment.event.title}</span>
              </span>
            {/each}
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .grid-wrap {
    /* The tokens that turn the layout numbers into pixels. One place. */
    --lane-h: 1.0625rem;
    --lane-gap: 0.125rem;
    --lane-step: calc(var(--lane-h) + var(--lane-gap));
    /* The date number and the gap under it — where the bars layer starts. */
    --date-block: 1.5rem;
    /* The week-number column. Zero when it is switched off, so nothing else in
       here has to know whether it is there. */
    --wk-col: 0rem;
    padding: 0 var(--space-2);
  }

  .grid-wrap.with-weeks {
    --wk-col: 1.375rem;
  }

  .headings,
  .week {
    display: flex;
    align-items: stretch;
  }

  .heading-days,
  .cells {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }

  /* Outside the seven columns, not an eighth one — see the header. */
  .wk {
    flex: none;
    width: var(--wk-col);
    padding-top: 2px;
    text-align: center;
    font-size: 0.625rem;
    font-variant-numeric: tabular-nums;
    line-height: 1.375rem;
    color: var(--color-text-faint);
  }

  .head-wk {
    line-height: 1;
    padding-top: 0;
  }

  .heading {
    text-align: center;
    padding-bottom: var(--space-1);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    color: var(--color-text-faint);
  }

  /* The cells and the bars share one box, so a bar's columns are the cells'. */
  .stack {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 2px 1px 3px;
    border: none;
    background: none;
    color: var(--color-text);
    font-size: var(--text-sm);
    border-radius: var(--radius-sm);
  }

  /* Holds open exactly the space the bars layer will cover. Without it the
     boxes would sit on top of the next week's numbers. */
  .reserved {
    height: calc(var(--lanes) * var(--lane-step));
  }

  .cell.outside .date {
    color: var(--color-text-faint);
  }

  .date {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.375rem;
    height: 1.375rem;
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

  /* A busy day, in one line instead of three. The colour is the whole message:
     which events they are is the list's job, and the cell's job is to say the
     day is not empty and roughly how full it is. */
  .dots {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: nowrap;
    gap: 3px;
    height: 0.5rem;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--tag-ink);
  }

  /* Hollow while somebody has not answered — the same "outlined means not
     settled yet" the bars and the list rows use. */
  .dot.waiting {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--tag-ink);
  }

  .dot.done {
    opacity: 0.4;
  }

  .more {
    font-size: 0.625rem;
    line-height: 1;
    color: var(--color-text-faint);
  }

  /* The layer the boxes live on. Never takes a tap: the day underneath does. */
  .bars {
    position: absolute;
    inset: var(--date-block) 0 auto 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    height: calc(var(--lanes) * var(--lane-step));
    pointer-events: none;
  }

  .bar {
    /* The whole multi-day trick, in one line: a box is a grid item that spans
       as many columns as it covers days. */
    grid-row: 1;
    grid-column: calc(var(--col) + 1) / span var(--span);
    align-self: start;
    margin-top: calc(var(--lane) * var(--lane-step));
    margin-inline: 1px;
    display: flex;
    align-items: center;
    gap: 2px;
    height: var(--lane-h);
    padding: 0 3px;
    border-radius: var(--radius-sm);
    background: var(--tag-ink);
    color: var(--color-accent-ink);
    font-size: 0.6875rem;
    font-weight: var(--weight-medium);
    line-height: var(--lane-h);
    white-space: nowrap;
    overflow: hidden;
  }

  .text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* The time reads as the label's quieter half — same size, less weight than
     the title would suggest, so the eye lands on the words. */
  .at {
    font-weight: var(--weight-bold);
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }

  /* A timed event is a slim tinted box; an all-day one is solid. The difference
     is the same one the day list draws with a bar down the left: something that
     owns the whole day looks heavier than something at six o'clock. */
  .bar:not(.all-day) {
    background: var(--tag-fill);
    color: var(--tag-ink);
    box-shadow: inset 2px 0 0 var(--tag-ink);
    padding-left: 5px;
  }

  /* Waiting on somebody: dashed, exactly as the row in the list below is. */
  .bar.waiting {
    background: transparent;
    color: var(--tag-ink);
    border: 1px dashed var(--tag-ink);
    box-shadow: none;
    padding-left: 3px;
  }

  .bar.done {
    opacity: 0.45;
    text-decoration: line-through;
  }

  /* A bar that carries on past the edge of the week loses its rounding there,
     so the two halves read as one thing continuing rather than two events. */
  .bar.from-before {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    margin-left: 0;
    box-shadow: none;
    padding-left: 3px;
  }

  .bar.into-after {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    margin-right: 0;
  }

  .cell:active {
    background: var(--color-surface-sunken);
  }
</style>
