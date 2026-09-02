<!--
  The shared household calendar.

  ## The shape of the screen

  Two views, switched at the top, and two buttons floating above the nav — the
  same arrangement the planner settled on in round 10.1, for the same reason:
  the answer to "what is happening" and the way to add to it should never be
  more than a thumb apart.

  **Month** is a grid with the events drawn on it as small boxes, and the
  selected day written out underneath. The grid answers *where* and the list
  answers *what*: a cell is 55px wide, so a box can carry a word or two and the
  rest has to live somewhere with room for it.

  **Week** is seven days down the screen, each written out in full. It exists
  for the question the month cannot answer at this size — what Thursday and
  Saturday both look like, without tapping either.

  ## Waiting on you

  Anything somebody has asked *you* to confirm floats to the top of the screen in
  its own card, above the grid, whatever day it is on — and it stays there until
  it is answered. That is deliberate: the whole point of asking is that it should
  not be possible to miss, and burying it inside the right day would mean finding
  the right day first.

  The tab itself carries a count, so it is visible from the shopping list too.
  Round 11.1 turns that into a real phone notification; this round makes sure the
  thing the notification will point at already exists and already works.

  ## Stepping through time

  Three ways, all doing the same thing: the ‹ › either side of the heading, and
  since round 12 a **sideways swipe** across the grid or the week. The swipe
  deliberately ignores anything starting within 24px of either edge, which is
  Android's own back gesture and the one that must keep working — see swipe.ts.

  ## What is not here

  Typed quick-add ("Thursday 18:30 dinner", §11 question 1), still. Recurrence
  arrived in round 12; the sheet writes the rows and the "this one or all of
  them?" question lives in EventSheet's footer.
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
    type EditScope,
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
  import {
    addDays,
    addMonths,
    dateRange,
    dayName,
    isoWeek,
    longDate,
    monthKey,
    monthName,
    shortDate,
    startOfWeek,
    timeLabel,
    todayKey,
  } from '../lib/dates'
  import { prefs } from '../lib/prefs.svelte'
  import { slidePage, swipeable } from '../lib/swipe'
  import { google } from '../lib/google.svelte'
  import { runSync, sync, syncSoon } from '../lib/google-sync.svelte'
  import { household } from '../lib/household.svelte'
  import { strings } from '../lib/strings'
  import EventRow from '../components/EventRow.svelte'
  import EventSheet from '../components/EventSheet.svelte'
  import MonthGrid from '../components/MonthGrid.svelte'
  import WeekView from '../components/WeekView.svelte'

  type View = 'month' | 'week'

  let today = $state(todayKey())
  let selected = $state(todayKey())
  let month = $state(monthKey(todayKey()))
  let view = $state<View>('month')

  /**
   * The week on show. Derived from the selected day rather than kept separately,
   * so switching views lands you where you already were: tap the 14th in the
   * month, switch to Week, and you get the week the 14th is in.
   */
  let weekStart = $derived(startOfWeek(selected))

  /** What the sheet is showing, or null when it is closed. */
  let sheet = $state<{ event: CalendarEvent | null; kind: EventKind } | null>(null)

  /** The element the swipe and the ‹ › both slide. */
  let pagesEl = $state<HTMLDivElement | null>(null)

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

  function step(delta: number) {
    if (view === 'week') {
      // A week step moves the selection with it, keeping the same weekday.
      selected = addDays(selected, delta * 7)
      month = monthKey(selected)
      return
    }

    month = addMonths(month, delta)
    // Keep the selection inside the month you are looking at, on the same date
    // where that date exists — stepping from the 31st to a 30-day month should
    // land on a real day rather than nothing.
    const date = selected.slice(8)
    const candidate = `${month}-${date}`
    selected = byDay.has(candidate) || candidate.slice(8) <= '28' ? candidate : `${month}-01`
  }

  /**
   * The ‹ › buttons page the calendar the same way a swipe does.
   *
   * Round 13 made the swipe slide; a button that jumped instead would read as
   * two different features doing one thing. slidePage falls back to a plain
   * swap when the element is not there or the person asked for less motion.
   */
  function page(delta: number) {
    if (pagesEl === null) {
      step(delta)
      return
    }
    slidePage(pagesEl, delta > 0 ? 'next' : 'previous', () => step(delta))
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

  /**
   * The first day of the run an event belongs to, or null for a one-off.
   *
   * The sheet needs it to say truthfully when a run would end, because changing
   * how many times rebuilds from the first day rather than from whichever
   * occurrence you opened.
   */
  function seriesStartFor(event: CalendarEvent | null): string | null {
    if (event === null || event.seriesId === null) return null
    const days = calendar.events
      .filter((e) => e.seriesId === event.seriesId)
      .map((e) => e.startsOn)
      .sort()
    return days[0] ?? event.startsOn
  }

  function open(event: CalendarEvent) {
    sheet = { event, kind: event.kind }
  }

  function create(kind: EventKind) {
    sheet = { event: null, kind }
  }

  /** The + on a day in the week view, tapping an empty day there, and holding
   *  a day in the month grid (round 13). */
  function addOn(day: string) {
    selected = day
    sheet = { event: null, kind: 'event' }
  }

  /**
   * Saves the sheet, and sends the event round if the switch says so.
   *
   * The confirmation used to be two buttons at the bottom of the sheet, pressed
   * after saving. Round 13 made it a switch in the ordinary flow, so this is
   * where "on" becomes an actual question and "off" withdraws one — including
   * on a brand new event, which is the case that never used to exist.
   *
   * For a series it asks about the **first** occurrence only. Confirmations are
   * per-occurrence by design (a yes to Thursday is not a yes to Saturday), so
   * asking about all ten would put ten identical questions at the top of the
   * other phone's calendar.
   */
  async function save(draft: EventDraft, reask: boolean, scope: EditScope) {
    const existing = sheet?.event ?? null
    sheet = null

    if (existing === null) {
      const id = await addEvent(draft)
      if (id !== null && draft.askConfirm) await askToConfirm(id)
    } else {
      await updateEvent(existing.id, draft, scope)

      if (!draft.askConfirm) {
        // Switched off: the question is withdrawn, answers and all.
        if (existing.confirmRequested) await unaskConfirmation(existing.id)
      } else if (reask) {
        // The evening moved, so the answers were about a different evening.
        await unaskConfirmation(existing.id)
        await askToConfirm(existing.id)
      } else if (!existing.confirmRequested) {
        await askToConfirm(existing.id)
      }
    }

    // Quiet: only goes through if a token is already live, which it is for the
    // hour after the first Sync tap. Nothing waits on it either way.
    syncSoon()
  }

  async function remove(scope: EditScope) {
    const existing = sheet?.event ?? null
    sheet = null
    if (existing) {
      await removeEvent(existing.id, scope)
      syncSoon()
    }
  }

  /** Answering from inside the detail view. Closes it — the question is done. */
  async function answerFromSheet(reply: 'yes' | 'no') {
    const existing = sheet?.event ?? null
    sheet = null
    if (existing) await answer(existing, reply)
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
      aria-label={view === 'week' ? strings.calendar.previousWeek : strings.calendar.previousMonth}
      onclick={() => page(-1)}>‹</button
    >
    <h1>
      {view === 'week'
        ? dateRange(weekStart, addDays(weekStart, 6))
        : monthName(month, today)}
      <!-- The week view's own week number. The month view writes one down the
           side of every row instead, which is where a month needs them. -->
      {#if view === 'week' && prefs.weekNumbers}
        <span class="wk">{strings.calendar.weekAbbrev}{isoWeek(weekStart)}</span>
      {/if}
    </h1>
    <button
      class="step"
      aria-label={view === 'week' ? strings.calendar.nextWeek : strings.calendar.nextMonth}
      onclick={() => page(1)}>›</button
    >
  </header>

  <div class="views" role="group" aria-label={strings.calendar.title}>
    <button
      class="view"
      class:on={view === 'month'}
      aria-pressed={view === 'month'}
      onclick={() => (view = 'month')}>{strings.calendar.viewMonth}</button
    >
    <button
      class="view"
      class:on={view === 'week'}
      aria-pressed={view === 'week'}
      onclick={() => (view = 'week')}>{strings.calendar.viewWeek}</button
    >
    {#if month !== monthKey(today) || selected !== today}
      <button class="today" onclick={goToday}>{strings.calendar.today}</button>
    {/if}
  </div>

  {#if calendar.waitingOnMe.length > 0}
    <div class="asked">
      <h2>{strings.calendar.confirmSheetTitle}</h2>
      {#each calendar.waitingOnMe as event (event.id)}
        <div class="ask-card">
          <!-- One line, not two. This card sits above the grid and its job is
               to be impossible to miss, not to be the whole screen. -->
          <!-- The whole date, not just the weekday (Marçal, round 13). "Can
               you make Thursday?" is not answerable if you cannot see which
               Thursday — and this card deliberately floats away from the day
               it belongs to, so it is the one place that has to say. -->
          <button class="ask-body" onclick={() => open(event)}>
            <span class="ask-title">{event.title}</span>
            <span class="ask-when">
              {dayName(event.startsOn, today)}
              <span class="ask-date">
                {#if event.endsOn > event.startsOn}
                  {dateRange(event.startsOn, event.endsOn)}
                {:else}
                  {longDate(event.startsOn)}
                {/if}{#if event.startTime}, {timeLabel(event.startTime, event.endTime)}{/if}
              </span>
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

  <!-- One swipe surface over whichever view is showing, so a sideways drag
       anywhere on the calendar turns the page. `touch-action: pan-y` below is
       what stops Android's compositor claiming the gesture — the lesson round
       10.2 learned the hard way and wrote down in drag.svelte.ts. -->
  <div
    class="pages"
    bind:this={pagesEl}
    use:swipeable={{
      onNext: () => step(1),
      onPrevious: () => step(-1),
      enabled: sheet === null,
    }}
  >
    {#if view === 'week'}
      <WeekView
        {weekStart}
        {today}
        events={calendar.events}
        {unsyncedIds}
        onopen={open}
        ontoggleDone={toggleDone}
        onadd={addOn}
      />
    {:else}
      <MonthGrid
        {month}
        {selected}
        {today}
        events={calendar.events}
        {byDay}
        weekNumbers={prefs.weekNumbers}
        onselect={select}
        onhold={addOn}
      />

      <div class="day">
        <div class="day-head">
          <h2>
            <span class="day-name">{dayName(selected, today)}</span>
            <span class="day-date">{longDate(selected)}</span>
          </h2>
        </div>

        {#if dayEvents.length === 0}
          <div class="empty">
            <p class="empty-line">{strings.calendar.nothingOn}</p>
            {#if next.length > 0}
              <p class="empty-hint">{strings.calendar.comingUp}</p>
              <!-- Each one says which day it is on (Marçal, round 11.1). Without
                   it "Coming up" is three events with no dates, which is the one
                   thing a calendar must never be. -->
              <div class="rows">
                {#each next as event (event.id)}
                  <div class="upcoming">
                    <span class="upcoming-day">
                      {dayName(event.startsOn, today)}
                      <span class="upcoming-date">{shortDate(event.startsOn)}</span>
                    </span>
                    <EventRow
                      {event}
                      unsynced={unsyncedIds.has(event.id)}
                      onopen={() => open(event)}
                      ontoggleDone={() => toggleDone(event)}
                    />
                  </div>
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
      </div>
    {/if}
  </div>

  {#if calendar.error}<p class="error day-error">{calendar.error}</p>{/if}

  <div class="dock">
    {#if google.available && sync.pending > 0}
      <button class="sync" disabled={sync.running} onclick={() => runSync(true)}>
        {sync.running ? strings.google.syncing : strings.google.syncCount(sync.pending)}
      </button>
    {/if}
    <button class="add" onclick={() => create('reminder')}>
      <!-- ✅ rather than round 20.1's ⏰: that icon now reads as the push
           reminder below, and this button makes a task, not an alarm. -->
      <span aria-hidden="true">✅</span> {strings.calendar.addReminder}
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
      seriesStart={seriesStartFor(sheet.event)}
      onsave={save}
      onremove={remove}
      onanswer={(reply) => answerFromSheet(reply)}
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
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: var(--space-2);
    text-align: center;
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
  }

  .wk {
    font-size: var(--text-sm);
    font-weight: var(--weight-regular);
    font-variant-numeric: tabular-nums;
    color: var(--color-text-faint);
  }

  /* The swipe surface. Vertical panning stays the browser's, horizontal is
     ours — without this line the compositor takes the sideways drag for a pan
     and cancels the gesture mid-way, which is exactly how round 10.1's swipe
     came to do nothing at all on a real phone. */
  .pages {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    touch-action: pan-y;
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

  /* The two views, as a segmented control beside Today. Not a third tab in the
     nav: this is a way of looking at one screen, not another screen. */
  .views {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
  }

  .view {
    min-height: 2rem;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .view.on {
    border-color: var(--color-tab-calendar);
    background: var(--color-tab-calendar);
    color: var(--color-accent-ink);
    font-weight: var(--weight-bold);
  }

  .today {
    margin-left: auto;
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
    gap: var(--space-1);
    margin: 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
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
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
    min-height: var(--tap-min);
    padding: 0;
    border: none;
    background: none;
    color: var(--color-text);
    text-align: left;
  }

  .ask-title {
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .ask-when {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .ask-date {
    color: var(--color-text-faint);
  }

  .ask-actions {
    display: flex;
    flex: none;
    gap: var(--space-2);
  }

  .yes,
  .no {
    min-width: 2.75rem;
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
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

  .upcoming {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .upcoming-day {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--color-text-muted);
  }

  .upcoming-date {
    font-weight: var(--weight-regular);
    color: var(--color-text-faint);
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

  .day-error {
    padding: 0 var(--space-3);
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
