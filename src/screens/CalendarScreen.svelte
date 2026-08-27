<!--
  The shared household calendar.

  ## The shape of the screen

  A month grid on top, the selected day's list underneath, and two buttons
  floating above the nav — the same arrangement the planner settled on in round
  10.1, for the same reason: the answer to "what is happening" and the way to
  add to it should never be more than a thumb apart.

  The grid answers *where* and the list answers *what*. That split is what makes
  a 412px month grid work at all: a cell is 52px wide, which is room for a number
  and three dots, so anything more than "there is something on that day" has to
  live somewhere with room for words.

  ## Waiting on you

  Anything somebody has asked *you* to confirm floats to the top of the screen in
  its own card, above the grid, whatever day it is on — and it stays there until
  it is answered. That is deliberate: the whole point of asking is that it should
  not be possible to miss, and burying it inside the right day would mean finding
  the right day first.

  The tab itself carries a count, so it is visible from the shopping list too.
  Round 11.1 turns that into a real phone notification; this round makes sure the
  thing the notification will point at already exists and already works.

  ## What is not here

  Recurrence (§4.3 wants "repeats X times per week"), and typed quick-add
  ("Thursday 18:30 dinner", §11 question 1). Both were left out on purpose and
  both are written up in ROADMAP.md.
-->
<script lang="ts">
  import {
    type CalendarEvent,
    type EventDraft,
    type EventKind,
    eventsByDay,
    eventsOn,
    upcoming,
  } from '../lib/calendar'
  import {
    addEvent,
    answerConfirmation,
    askToConfirm,
    calendar,
    removeEvent,
    setDone,
    setWindow,
    unaskConfirmation,
    updateEvent,
  } from '../lib/calendar.svelte'
  import { addMonths, dayName, longDate, monthKey, monthName, todayKey } from '../lib/dates'
  import { google } from '../lib/google.svelte'
  import { runSync, sync, syncSoon } from '../lib/google-sync.svelte'
  import { household } from '../lib/household.svelte'
  import { strings } from '../lib/strings'
  import EventRow from '../components/EventRow.svelte'
  import EventSheet from '../components/EventSheet.svelte'
  import MonthGrid from '../components/MonthGrid.svelte'

  let today = $state(todayKey())
  let selected = $state(todayKey())
  let month = $state(monthKey(todayKey()))

  /** What the sheet is showing, or null when it is closed. */
  let sheet = $state<{ event: CalendarEvent | null; kind: EventKind } | null>(null)

  let byDay = $derived(eventsByDay(calendar.events, calendar.from, calendar.to))
  let dayEvents = $derived(eventsOn(calendar.events, selected))
  let next = $derived(upcoming(calendar.events, today, 3))

  /**
   * Ids Google has not been told about — the small cloud on a row.
   *
   * Empty until this phone has actually connected to Google. Before that every
   * event is "not in Google yet" and perfectly correct, and a cloud on all of
   * them would be a column of noise saying nothing.
   */
  let unsyncedIds = $derived(
    google.status === 'ready' || google.status === 'expired'
      ? new Set(sync.plan.push.map((event) => event.id))
      : new Set<string>(),
  )

  /**
   * Stepping to a month outside the loaded window widens it and re-reads.
   *
   * The loading and the realtime subscription live in App.svelte, not here: the
   * count on the Calendar tab has to be right while you are looking at the
   * shopping list, so the calendar cannot only exist while its own screen is
   * mounted. All this screen owns is which month is on show.
   */
  $effect(() => {
    if (!household.id) return
    void setWindow(month)
  })

  function step(months: number) {
    month = addMonths(month, months)
    // Keep the selection inside the month you are looking at, on the same date
    // where that date exists — stepping from the 31st to a 30-day month should
    // land on a real day rather than nothing.
    const date = selected.slice(8)
    const candidate = `${month}-${date}`
    selected = byDay.has(candidate) || candidate.slice(8) <= '28' ? candidate : `${month}-01`
  }

  function goToday() {
    today = todayKey()
    month = monthKey(today)
    selected = today
  }

  function select(day: string) {
    selected = day
    if (monthKey(day) !== month) month = monthKey(day)
  }

  function open(event: CalendarEvent) {
    sheet = { event, kind: event.kind }
  }

  function create(kind: EventKind) {
    sheet = { event: null, kind }
  }

  async function save(draft: EventDraft, reask: boolean) {
    const existing = sheet?.event ?? null
    sheet = null

    if (existing === null) {
      await addEvent(draft)
    } else {
      await updateEvent(existing.id, draft)
      // The evening moved, so the answers were about a different evening.
      if (reask) {
        await unaskConfirmation(existing.id)
        await askToConfirm(existing.id)
      }
    }

    // Quiet: only goes through if a token is already live, which it is for the
    // hour after the first Sync tap. Nothing waits on it either way.
    syncSoon()
  }

  async function remove() {
    const existing = sheet?.event ?? null
    sheet = null
    if (existing) {
      await removeEvent(existing.id)
      syncSoon()
    }
  }

  async function ask() {
    const existing = sheet?.event ?? null
    if (!existing) return
    await askToConfirm(existing.id)
    // Reopen on the freshly-loaded row so the sheet shows the new state.
    sheet = { event: calendar.events.find((e) => e.id === existing.id) ?? null, kind: existing.kind }
    syncSoon()
  }

  async function unask() {
    const existing = sheet?.event ?? null
    if (!existing) return
    await unaskConfirmation(existing.id)
    sheet = { event: calendar.events.find((e) => e.id === existing.id) ?? null, kind: existing.kind }
    syncSoon()
  }

  async function answer(event: CalendarEvent, reply: 'yes' | 'no') {
    await answerConfirmation(event.id, reply)
    syncSoon()
  }

  async function toggleDone(event: CalendarEvent) {
    await setDone(event.id, event.doneAt === null)
    syncSoon()
  }
</script>

<section class="calendar">
  <header class="head">
    <button
      class="step"
      aria-label={strings.calendar.previousMonth}
      onclick={() => step(-1)}>‹</button
    >
    <h1>{monthName(month, today)}</h1>
    <button
      class="step"
      aria-label={strings.calendar.nextMonth}
      onclick={() => step(1)}>›</button
    >
  </header>

  {#if calendar.waitingOnMe.length > 0}
    <div class="asked">
      <h2>{strings.calendar.confirmSheetTitle}</h2>
      {#each calendar.waitingOnMe as event (event.id)}
        <div class="ask-card">
          <button class="ask-body" onclick={() => open(event)}>
            <span class="ask-title">{event.title}</span>
            <span class="ask-when">
              {dayName(event.startsOn, today)} · {longDate(event.startsOn)}
              {#if event.startTime}· {event.startTime}{/if}
            </span>
          </button>
          <div class="ask-actions">
            <button class="yes" onclick={() => answer(event, 'yes')}>{strings.calendar.yes}</button>
            <button class="no" onclick={() => answer(event, 'no')}>{strings.calendar.no}</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <MonthGrid {month} {selected} {today} {byDay} onselect={select} />

  <div class="day">
    <div class="day-head">
      <h2>
        <span class="day-name">{dayName(selected, today)}</span>
        <span class="day-date">{longDate(selected)}</span>
      </h2>
      {#if month !== monthKey(today) || selected !== today}
        <button class="today" onclick={goToday}>{strings.calendar.today}</button>
      {/if}
    </div>

    {#if dayEvents.length === 0}
      <div class="empty">
        <p class="empty-line">{strings.calendar.nothingOn}</p>
        {#if next.length > 0}
          <p class="empty-hint">{strings.calendar.comingUp}</p>
          <div class="rows">
            {#each next as event (event.id)}
              <EventRow
                {event}
                unsynced={unsyncedIds.has(event.id)}
                onopen={() => open(event)}
                ontoggleDone={() => toggleDone(event)}
              />
            {/each}
          </div>
        {:else}
          <p class="empty-hint">{strings.calendar.nothingOnHint}</p>
        {/if}
      </div>
    {:else}
      <div class="rows">
        {#each dayEvents as event (event.id)}
          <EventRow
            {event}
            unsynced={unsyncedIds.has(event.id)}
            onopen={() => open(event)}
            ontoggleDone={() => toggleDone(event)}
          />
        {/each}
      </div>
    {/if}

    {#if calendar.error}<p class="error">{calendar.error}</p>{/if}
  </div>

  <div class="dock">
    {#if google.available && sync.pending > 0}
      <button class="sync" disabled={sync.running} onclick={() => runSync(true)}>
        {sync.running ? strings.google.syncing : strings.google.syncCount(sync.pending)}
      </button>
    {/if}
    <button class="add" onclick={() => create('reminder')}>
      <span aria-hidden="true">⏰</span> {strings.calendar.addReminder}
    </button>
    <button class="add primary" onclick={() => create('event')}>
      <span aria-hidden="true">＋</span> {strings.calendar.addEvent}
    </button>
  </div>

  {#if sync.error}<p class="error dock-error">{sync.error}</p>{/if}
</section>

{#if sheet}
  {#key sheet.event?.id ?? 'new'}
    <EventSheet
      event={sheet.event}
      kind={sheet.kind}
      day={selected}
      onsave={save}
      onremove={remove}
      onask={ask}
      onunask={unask}
      onclose={() => (sheet = null)}
    />
  {/key}
{/if}

<style>
  .calendar {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    /* Enough to clear the floating dock: its 48px buttons plus the padding
       above and below them. Without this the last event of a busy day sits
       permanently under the Add button. */
    padding-bottom: calc(var(--space-8) + var(--space-6));
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3) 0;
  }

  h1 {
    flex: 1;
    text-align: center;
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
  }

  .step {
    width: var(--tap-min);
    height: var(--tap-min);
    border: none;
    background: none;
    color: var(--color-text-muted);
    font-size: var(--text-2xl);
    line-height: 1;
  }

  /* Sits in the day heading rather than the month heading. It is the way back
     from wherever you have wandered to, and the day heading is the line that
     says where that is. */
  .today {
    flex: none;
    min-height: 2rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }

  /* Waiting on you: above the grid, whatever day it is on. Missing one of these
     is the one failure this feature cannot have. */
  .asked {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0 var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .asked h2 {
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    color: var(--color-warning);
  }

  .ask-card {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .ask-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-height: var(--tap-min);
    padding: 0;
    border: none;
    background: none;
    color: var(--color-text);
    text-align: left;
  }

  .ask-title {
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .ask-when {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .ask-actions {
    display: flex;
    flex: none;
    gap: var(--space-2);
  }

  .yes,
  .no {
    min-width: 3.5rem;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .yes {
    border: none;
    background: var(--color-success);
    color: var(--color-accent-ink);
  }

  .no {
    border: 1px solid var(--color-border-strong);
    background: var(--color-surface);
    color: var(--color-text-muted);
  }

  .day {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0 var(--space-3);
  }

  .day-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding-top: var(--space-2);
  }

  .day-head h2 {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }

  .day-name {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  .day-date {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4) 0;
  }

  .empty-line {
    font-size: var(--text-base);
    color: var(--color-text-muted);
  }

  .empty-hint {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
  }

  .error {
    font-size: var(--text-sm);
    color: var(--color-danger);
  }

  /* Floating over the content with a gradient fade behind, the same way the
     planner's two buttons and the shopping search field do it. */
  .dock {
    position: fixed;
    inset: auto 0 0 0;
    z-index: calc(var(--z-nav) - 1);
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-5) var(--space-3)
      calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + var(--space-3));
    background: linear-gradient(to top, var(--color-bg) 55%, transparent);
    pointer-events: none;
  }

  .dock > :global(button) {
    pointer-events: auto;
  }

  .add,
  .sync {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    box-shadow: var(--shadow-1);
  }

  .add.primary {
    border-color: var(--color-tab-calendar);
    background: var(--color-tab-calendar);
    color: var(--color-accent-ink);
    font-weight: var(--weight-bold);
  }

  .sync {
    margin-right: auto;
    border-color: var(--color-warning);
    color: var(--color-warning);
  }

  .sync:disabled {
    opacity: 0.5;
  }

  .dock-error {
    position: fixed;
    inset: auto var(--space-3)
      calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + var(--space-8)) var(--space-3);
    z-index: calc(var(--z-nav) - 1);
    max-width: var(--content-max);
    margin: 0 auto;
    text-align: center;
  }

  button:active:not(:disabled) {
    transform: scale(0.97);
  }
</style>
