<!--
  Writing an event or a reminder down. This is the screen §4.3 says is "where
  Google is worst and where we earn our keep", so the shape of it matters more
  than anything else in the round.

  **The target flow, in the spec's own words:** tap a day → type a title → set a
  time → tap avatars → done, with everything else behind one more tap.

  So the sheet opens with exactly four things visible — the title (focused), the
  time, the faces, and Save — and *More* holds the rest: the end time, more than
  one day, the place, the notes, the colour. Not because those are unimportant,
  but because on nine evenings out of ten they are empty, and a form that shows
  ten empty fields to collect two is a form people avoid.

  A **reminder** opens with even less: a title and a day. §4.3 asked for it to be
  "different and faster than an event", and the way to be faster is to ask less,
  not to ask the same things in a smaller font.

  **When, the way Google does it** (Marçal, round 13). One All-day switch, then
  two lines — a start date with a start time, an end date with an end time —
  and no label above them, because two dates and two times need no introducing.

  The thing that got simpler is **more than one day**: it is not a mode any
  more. Round 11 had a "More than one day" chip that revealed a second date;
  now the second date is always there, and a holiday is what happens when you
  change it. One control fewer, and the state it used to hold is now visible in
  the field itself.

  Round 12 had made a time optional by opening with none at all. This keeps that
  — the switch is right there and one tap — while going back to a timed default,
  because with an All-day switch in plain sight the untimed case no longer needs
  to be the one you land on. Midday to one o'clock; see DEFAULT_START_TIME.

  **Repeating** lives under More (round 13) and takes one row: Once / Daily /
  Weekly / Custom, with Custom opening the rest — every 2 weeks, monthly, and
  how many times. Most events repeat never or weekly, and the four-fifths of the
  control those two cases do not need was sitting in the middle of the sheet.
  It is offered only when writing a new one: ten Sunday gym sessions are ten real
  rows (recurrence.ts explains why), so the rule is something the sheet *makes*
  rather than something an existing event carries around.

  Two decisions worth knowing about:

  - **The draft is snapshotted on mount**, like PlanEntrySheet's note field. If
    the other phone edits the same event while this sheet is open, the fields do
    not move under the person typing. Last write wins (§3), which is the whole
    project's stance.
  - **Moving the time re-asks the question.** If people have already answered and
    the day, the time or the place changes, the old answers are about a
    different evening — so they are cleared and everyone is asked again, with a
    line saying so rather than silently.
-->
<script lang="ts">
  import {
    type CalendarEvent,
    type EventDraft,
    type EventKind,
    DEFAULT_END_TIME,
    DEFAULT_START_TIME,
    canSave,
    confirmState,
    draftFrom,
    isSeries,
    needsReconfirming,
    newDraft,
  } from '../lib/calendar'
  import { EVENT_COLOURS } from '../lib/calendar'
  import type { EditScope } from '../lib/calendar.svelte'
  import { addDays, daysBetween, longDate, shortDate, shortDayName } from '../lib/dates'
  import {
    MAX_OCCURRENCES,
    MIN_REPEAT_COUNT,
    type RepeatKind,
    clampCount,
    isNoChange,
    lastOccurrence,
  } from '../lib/recurrence'
  import { tagStyle, type TagColour } from '../lib/dish-tags'
  import { people, personName } from '../lib/people.svelte'
  import { auth } from '../lib/auth.svelte'
  import { prefs } from '../lib/prefs.svelte'
  import { strings } from '../lib/strings'
  import PersonAvatar from './PersonAvatar.svelte'
  import Toggle from './Toggle.svelte'

  let {
    event = null,
    kind = 'event',
    day,
    onsave,
    onremove,
    onclose,
  }: {
    /** Null when writing a new one. */
    event?: CalendarEvent | null
    /** Only read when `event` is null. */
    kind?: EventKind
    /** The day the sheet was opened from. Only read when `event` is null. */
    day: string
    onsave: (draft: EventDraft, reask: boolean, scope: EditScope) => void
    onremove: (scope: EditScope) => void
    onclose: () => void
  } = $props()

  // Snapshotted once — see the header. The confirmation switch on a *new* one
  // starts wherever Settings says (prefs.askConfirm), which is off unless this
  // household has decided otherwise.
  // svelte-ignore state_referenced_locally
  let draft = $state<EventDraft>(
    event ? draftFrom(event) : newDraft(kind, day, prefs.askConfirm),
  )
  // svelte-ignore state_referenced_locally
  const original: EventDraft = event ? draftFrom(event) : newDraft(kind, day, prefs.askConfirm)

  let more = $state(false)
  /**
   * The question in the footer: which occurrences does this apply to, or — for
   * a one-off — are you sure you want it gone.
   *
   * It replaces the footer rather than opening a second sheet on top of the
   * first, because a sheet over a sheet on a 412px screen is two backdrops and
   * a lost thread. Null means the footer is doing its ordinary job.
   */
  let asking = $state<'save' | 'remove' | null>(null)
  let titleField = $state<HTMLInputElement | null>(null)

  /**
   * Put the keyboard up on a new one, straight away (Marçal, round 11.1).
   *
   * `autofocus` alone is not enough on Chrome for Android: it focuses the field
   * but leaves the keyboard down, so you tap Add and then have to tap again to
   * type. A real `.focus()` call inside the tap that opened the sheet counts as
   * user activation and does raise it.
   *
   * Only for a *new* one. Opening something you already wrote to check the time
   * and getting a keyboard over half the screen is the opposite of helpful.
   */
  $effect(() => {
    if (event !== null) return
    const field = titleField
    if (!field) return
    field.focus({ preventScroll: true })
  })

  let isReminder = $derived(draft.kind === 'reminder')
  let editing = $derived(event !== null)
  let confirm = $derived(event ? confirmState(event) : 'settled')
  let asked = $derived(confirm !== 'settled')

  /** Whether saving would invalidate answers people have already given. */
  let willReask = $derived(asked && needsReconfirming(original, draft))

  let heading = $derived.by(() => {
    if (isReminder) return editing ? strings.calendar.editReminder : strings.calendar.newReminder
    return editing ? strings.calendar.editEvent : strings.calendar.newEvent
  })

  /**
   * Series facts about the event being edited. Null when writing a new one or
   * editing a one-off, which is what the whole footer question hangs off.
   *
   * The rule has to be there as well as the id — 0014's check constraint ties
   * the two together, so a row with one and not the other cannot exist, and
   * inventing a rhythm to display would be worse than showing nothing.
   */
  let series = $derived.by(() => {
    if (event === null || !isSeries(event)) return null
    const rule = event.seriesRule
    // 0014 ties the id and the rule together, so a real row always has both.
    // Narrowing here rather than inventing a rhythm to put on the screen.
    if (rule === null) return null
    return { rule, index: event.seriesIndex, count: event.seriesCount }
  })

  /** Whether Save would actually write anything different. */
  let unchanged = $derived(editing && isNoChange(original, draft))

  /** All day is the absence of a start time, not a column of its own (§7). */
  let allDay = $derived(draft.startTime === null)

  function setAllDay(on: boolean) {
    if (on) {
      draft.startTime = null
      draft.endTime = null
      return
    }
    draft.startTime = DEFAULT_START_TIME
    draft.endTime = DEFAULT_END_TIME
  }

  /**
   * Moving the start takes the end with it, keeping the gap.
   *
   * Round 12 collapsed a single-day event back to one day and left a multi-day
   * one alone, which meant moving a holiday's first day changed how long the
   * holiday was. Shifting is what a person means every time: a three-day trip
   * moved to the following week is still three days.
   *
   * `previousStart` is what makes that work rather than the draft's own start,
   * which `bind:value` has already overwritten by the time this runs. Reading
   * the gap off the *original* draft instead would be wrong the moment somebody
   * lengthens the event and then moves it — the extra days would vanish.
   */
  let previousStart = original.startsOn

  function onStartDayChange() {
    const gap = Math.max(0, daysBetween(previousStart, draft.endsOn))
    previousStart = draft.startsOn
    draft.endsOn = addDays(draft.startsOn, gap)
  }

  /** An end before its start is a typo, not an instruction. The `min` on the
   *  field stops most of them; a keyboard-typed date can still get through. */
  function onEndDayChange() {
    if (draft.endsOn < draft.startsOn) draft.endsOn = draft.startsOn
  }

  /* ---------------------------------------------------------------------- */
  /* Repeating                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * The four on the row, and everything else behind Custom.
   *
   * Once, Daily and Weekly cover almost everything and cost one tap each; the
   * two rarer rhythms and the number of times are one tap further in. The
   * summary line stays visible whichever route you took, so "Weekly" never
   * quietly means something you were not told.
   */
  const QUICK_REPEATS: readonly RepeatKind[] = ['none', 'daily', 'weekly']
  const CUSTOM_REPEATS: readonly RepeatKind[] = ['daily', 'weekly', 'fortnightly', 'monthly']

  let custom = $state(false)

  function setRepeat(repeat: RepeatKind) {
    custom = false
    draft.repeat = repeat
  }

  function openCustom() {
    custom = true
    if (draft.repeat === 'none') draft.repeat = 'weekly'
  }

  function nudgeCount(by: number) {
    draft.repeatCount = clampCount(draft.repeatCount + by)
  }

  /** "10 times · last one Sun 8 Nov" — the sentence the chips add up to. */
  let repeatSummary = $derived.by(() => {
    if (draft.repeat === 'none') return null
    const last = lastOccurrence(draft.startsOn, draft.repeat, draft.repeatCount)
    return strings.calendar.repeatSummary(
      draft.repeatCount,
      `${shortDayName(last)} ${shortDate(last)}`,
    )
  })

  function toggleAttendee(personId: string) {
    draft.attendees = draft.attendees.includes(personId)
      ? draft.attendees.filter((id) => id !== personId)
      : [...draft.attendees, personId]
  }

  function pickColour(colour: TagColour) {
    draft.colour = colour
  }

  /**
   * Save, or first ask which occurrences it applies to.
   *
   * The question is skipped in the two cases where it has only one answer: a
   * one-off, and an edit that changed nothing — where Save is a Cancel and
   * asking "all ten?" about nothing would be a question with no stakes.
   */
  function save() {
    if (!canSave(draft)) return
    if (series !== null && !unchanged) {
      asking = 'save'
      return
    }
    onsave(draft, willReask, 'one')
  }

  function saveWith(scope: EditScope) {
    asking = null
    onsave(draft, willReask, scope)
  }

  function removeWith(scope: EditScope) {
    asking = null
    onremove(scope)
  }

  /**
   * The one other *account*, when there is exactly one — so the button can say
   * "Ask Marta to confirm" rather than a pronoun-free "Ask to confirm".
   *
   * Accounts, not people: a five-year-old on the attendee row has no phone to
   * be asked on.
   */
  let theOther = $derived.by(() => {
    const others = people.accounts.filter((p) => p.userId !== auth.userId)
    return others.length === 1 ? others[0] : null
  })
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={heading}>
  <header class="head">
    <h2>{heading}</h2>
    <button class="text-button" onclick={onclose}>{strings.calendar.cancel}</button>
  </header>

  <div class="body">
    <!-- No label above it. The heading already says which of the two this is,
         the placeholder says what to do, and a label would put a word between
         the tap and the typing. -->
    <input
      class="input title-input"
      type="text"
      autocomplete="off"
      enterkeyhint="done"
      maxlength="120"
      aria-label={strings.calendar.titleLabel}
      placeholder={isReminder
        ? strings.calendar.reminderPlaceholder
        : strings.calendar.eventPlaceholder}
      bind:this={titleField}
      bind:value={draft.title}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          save()
        }
      }}
    />

    <!-- Google's shape: one switch, then a start line and an end line. No
         "When" heading — two dates and two times need no introducing — and no
         "more than one day" mode, because the second date is always there and
         a holiday is simply what happens when you change it. -->
    <div class="field when">
      <Toggle label={strings.calendar.allDayLabel} on={allDay} onchange={setAllDay} />

      <div class="line">
        <span class="edge">{strings.calendar.startsLabel}</span>
        <input
          class="input day"
          type="date"
          aria-label={strings.calendar.startsLabel}
          bind:value={draft.startsOn}
          onchange={onStartDayChange}
        />
        {#if !allDay}
          <input
            class="input time"
            type="time"
            aria-label={strings.calendar.startTimeLabel}
            bind:value={draft.startTime}
          />
        {/if}
      </div>

      <div class="line">
        <span class="edge">{strings.calendar.endsLabel}</span>
        <input
          class="input day"
          type="date"
          min={draft.startsOn}
          aria-label={strings.calendar.endsLabel}
          bind:value={draft.endsOn}
          onchange={onEndDayChange}
        />
        {#if !allDay}
          <input
            class="input time"
            type="time"
            aria-label={strings.calendar.endTimeLabel}
            bind:value={draft.endTime}
          />
        {/if}
      </div>

      {#if isReminder && allDay}
        <p class="hint">{strings.calendar.reminderHint}</p>
      {/if}
    </div>

    {#if series}
      <p class="series-note">
        {strings.calendar.seriesNote(
          strings.calendar.repeatNames[series.rule],
          series.index + 1,
          series.count,
        )}
      </p>
    {/if}

    {#if people.list.length > 1}
      <div class="field">
        <!-- A reminder is a job rather than an outing: you do not "go" to
             renewing a parking permit, you are the one who has to. -->
        <span class="label">
          {isReminder ? strings.calendar.whoForLabel : strings.calendar.whoLabel}
        </span>
        <div class="faces">
          {#each people.list as person (person.id)}
            <PersonAvatar
              {person}
              size="lg"
              on={draft.attendees.includes(person.id)}
              onclick={() => toggleAttendee(person.id)}
            />
          {/each}
        </div>
      </div>
    {/if}
    <!-- Round 13 moved this out of the edit-only section at the bottom and into
         the ordinary flow: sending something round to be agreed is part of
         writing it down, not an afterthought you come back for. Off unless
         Settings says otherwise — most of what goes on a family calendar is a
         statement rather than a question.

         Only when there is somebody with a phone to ask. -->
    {#if !people.alone}
      <div class="field">
        <Toggle
          label={theOther
            ? strings.calendar.askOne(personName(theOther))
            : strings.calendar.askEveryone}
          hint={draft.askConfirm ? strings.calendar.askHint : null}
          on={draft.askConfirm}
          onchange={(on) => (draft.askConfirm = on)}
        />
        {#if willReask}
          <p class="hint warn">{strings.calendar.reconfirm}</p>
        {/if}
        {#if asked && (event?.confirmations.length ?? 0) > 0}
          <p class="answers">
            {#each event?.confirmations ?? [] as answer (answer.userId)}
              {@const who = people.list.find((p) => p.userId === answer.userId) ?? null}
              <span
                class="answer"
                class:yes={answer.answer === 'yes'}
                class:no={answer.answer === 'no'}
              >
                {answer.answer === 'yes' ? '✓' : answer.answer === 'no' ? '✕' : '…'}
                {personName(who)}
              </span>
            {/each}
          </p>
        {/if}
      </div>
    {/if}

    <!-- Six colours, one line. Eight wrapped onto two rows and the second row
         read as an afterthought; sage and stone were the two nobody reached
         for. See EVENT_COLOURS in calendar.ts. -->
    <div class="field">
      <span class="label">{strings.calendar.colourLabel}</span>
      <div class="colours">
        {#each EVENT_COLOURS as colour (colour)}
          <button
            class="swatch"
            class:on={draft.colour === colour}
            style={tagStyle(colour)}
            aria-label={colour}
            aria-pressed={draft.colour === colour}
            onclick={() => pickColour(colour)}
          ></button>
        {/each}
      </div>
    </div>

    <!-- One button that opens and closes, rather than a one-way door. The
         chevron says which way it goes; the word stays the same so the row
         does not change width as you use it. -->
    <button class="more-button" class:open={more} aria-expanded={more} onclick={() => (more = !more)}>
      <span class="chevron" aria-hidden="true">›</span>
      {strings.calendar.moreLabel}
    </button>

    {#if more}
      {#if !editing}
        <div class="field">
          <span class="label">{strings.calendar.repeatLabel}</span>
          <div class="repeats">
            {#each QUICK_REPEATS as repeat (repeat)}
              <button
                class="chip"
                class:on={!custom && draft.repeat === repeat}
                aria-pressed={!custom && draft.repeat === repeat}
                onclick={() => setRepeat(repeat)}
              >
                {strings.calendar.repeatNames[repeat]}
              </button>
            {/each}
            <button
              class="chip"
              class:on={custom}
              aria-pressed={custom}
              onclick={openCustom}
            >
              {strings.calendar.repeatCustom}
            </button>
          </div>

          {#if custom}
            <div class="repeats">
              {#each CUSTOM_REPEATS as repeat (repeat)}
                <button
                  class="chip small"
                  class:on={draft.repeat === repeat}
                  aria-pressed={draft.repeat === repeat}
                  onclick={() => (draft.repeat = repeat)}
                >
                  {strings.calendar.repeatNames[repeat]}
                </button>
              {/each}
            </div>
            <div class="count">
              <button
                class="step"
                aria-label={strings.calendar.fewerTimes}
                disabled={draft.repeatCount <= MIN_REPEAT_COUNT}
                onclick={() => nudgeCount(-1)}>−</button
              >
              <span class="count-value">{draft.repeatCount}</span>
              <button
                class="step"
                aria-label={strings.calendar.moreTimes}
                disabled={draft.repeatCount >= MAX_OCCURRENCES}
                onclick={() => nudgeCount(1)}>+</button
              >
            </div>
          {/if}

          {#if repeatSummary}<p class="hint">{repeatSummary}</p>{/if}
        </div>
      {/if}

      <label class="field">
        <span class="label">{strings.calendar.whereLabel}</span>
        <input
          class="input"
          type="text"
          maxlength="200"
          placeholder={strings.calendar.wherePlaceholder}
          bind:value={draft.location}
        />
      </label>

      <label class="field">
        <span class="label">{strings.calendar.notesLabel}</span>
        <textarea
          class="input notes"
          rows="3"
          maxlength="2000"
          placeholder={strings.calendar.notesPlaceholder}
          bind:value={draft.notes}
        ></textarea>
      </label>
    {/if}

    {#if editing}
      <!-- The confirmation happens in the footer, where the thumb already is,
           and where a series can ask the extra question it needs. -->
      <button class="text-button danger-text" onclick={() => (asking = 'remove')}>
        {strings.calendar.remove}
      </button>
    {/if}
  </div>

  <footer class="foot" class:asking>
    {#if asking !== null}
      {@const remove = asking === 'remove'}
      <p class="scope-q">
        {#if series}
          {remove
            ? strings.calendar.removeWhich(series.count)
            : strings.calendar.saveWhich(series.count)}
        {:else}
          {strings.calendar.removeConfirm}
        {/if}
      </p>
      <div class="scope-actions">
        <button
          class="scope"
          class:danger={remove}
          onclick={() => (remove ? removeWith('one') : saveWith('one'))}
        >
          {series ? strings.calendar.justThisOne : strings.calendar.remove}
        </button>
        {#if series}
          <button
            class="scope"
            class:danger={remove}
            onclick={() => (remove ? removeWith('series') : saveWith('series'))}
          >
            {strings.calendar.allOfThem(series.count)}
          </button>
        {/if}
        <button class="text-button" onclick={() => (asking = null)}>
          {strings.calendar.cancel}
        </button>
      </div>
    {:else}
      <span class="day-note">{shortDayName(draft.startsOn)} {longDate(draft.startsOn)}</span>
      <button class="save" disabled={!canSave(draft)} onclick={save}>
        {editing ? strings.calendar.save : strings.calendar.saveAdd}
      </button>
    {/if}
  </footer>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    z-index: var(--z-sheet);
  }

  .sheet {
    position: fixed;
    inset: auto 0 0 0;
    z-index: var(--z-sheet);
    display: flex;
    flex-direction: column;
    max-height: 88vh;
    margin: 0 auto;
    max-width: var(--content-max);
    background: var(--color-surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-2);
    /* The keyboard's height, published by keyboard.ts. Without it the Save
       button sits underneath the keyboard on the one screen where you always
       have the keyboard up. */
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--keyboard-inset));
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-4) var(--space-2);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  .body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4) var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--color-text-muted);
  }

  .input {
    width: 100%;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    color: var(--color-text);
    /* 16px minimum. Anything smaller and the phone zooms the page on focus. */
    font-size: var(--text-base);
    font-family: inherit;
  }

  /* Bigger and borderless: it is the first thing you see and the only thing
     you always fill in, so it reads as a heading you are writing rather than a
     field you are completing. */
  .title-input {
    border: none;
    border-bottom: 2px solid var(--color-border-strong);
    border-radius: 0;
    padding: 0 var(--space-1);
    background: none;
    font-size: var(--text-xl);
    font-weight: var(--weight-medium);
  }

  .title-input:focus {
    outline: none;
    border-bottom-color: var(--color-tab-calendar);
  }

  .notes {
    padding: var(--space-3);
    min-height: 5rem;
    line-height: var(--leading-normal);
  }

  /* The switch, then two lines that read across: what it is, the day, the
     hour. The labels are the left column so the two lines line up. */
  .when {
    gap: var(--space-3);
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .edge {
    flex: none;
    width: 3.25rem;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .day {
    flex: 1 1 auto;
    min-width: 0;
    width: auto;
  }

  .time {
    flex: 0 0 6.25rem;
    width: auto;
    padding: 0 var(--space-2);
    font-variant-numeric: tabular-nums;
  }

  .chip {
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .chip.on {
    background: var(--color-tab-calendar);
    border-color: var(--color-tab-calendar);
    color: var(--color-accent-ink);
  }

  /* Four on one row at 412px, which is why these are tighter than a chip
     elsewhere. They still wrap rather than squeeze if a translation is longer. */
  .repeats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .repeats .chip {
    flex: 1 1 auto;
    padding: 0 var(--space-2);
  }

  /* The second row, inside Custom: quieter than the row that opened it. */
  .repeats .chip.small {
    min-height: 2.25rem;
    font-size: var(--text-xs);
  }

  .count {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .step {
    width: var(--tap-min);
    height: var(--tap-min);
    flex: none;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: var(--text-lg);
    line-height: 1;
  }

  .step:disabled {
    opacity: 0.35;
  }

  .count-value {
    min-width: 1.5rem;
    text-align: center;
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    font-variant-numeric: tabular-nums;
  }

  /* Which series this one belongs to. A statement, not a control — the rhythm
     is fixed once the rows exist. */
  .series-note {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .faces {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
    line-height: var(--leading-normal);
  }

  .hint.warn {
    color: var(--color-warning);
  }

  .colours {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .swatch {
    flex: 1;
    min-width: 0;
    height: 2.25rem;
    border: 2px solid var(--tag-ink);
    border-radius: var(--radius-full);
    background: var(--tag-fill);
  }

  .swatch.on {
    background: var(--tag-ink);
  }

  /* Opens and closes, and says which it will do. Full width because it is a
     section heading you can press, not a chip among chips. */
  .more-button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    text-align: left;
  }

  .chevron {
    display: inline-block;
    font-size: var(--text-lg);
    line-height: 1;
    transition: transform var(--dur-fast) var(--ease);
  }

  .more-button.open {
    border-style: solid;
    color: var(--color-text);
  }

  .more-button.open .chevron {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }

  .answers {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .answer {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .answer.yes {
    color: var(--color-success);
  }

  .answer.no {
    color: var(--color-danger);
  }

  .text-button {
    align-self: flex-start;
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
    border: none;
    background: none;
    color: var(--color-text-muted);
    font-size: var(--text-base);
  }

  .danger-text {
    color: var(--color-danger);
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  /* The question takes the footer over rather than opening a second sheet. Two
     lines, because "Just this one / All 10" beside a sentence does not fit on
     one at 412px. */
  .foot.asking {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .scope-q {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--color-text-muted);
  }

  .scope-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .scope {
    flex: 1;
    min-width: 0;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: none;
    border-radius: var(--radius-full);
    background: var(--color-tab-calendar);
    color: var(--color-accent-ink);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .scope.danger {
    background: var(--color-danger);
  }

  .scope-actions .text-button {
    flex: none;
    align-self: center;
  }

  .day-note {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
  }

  .save {
    min-height: var(--tap-min);
    padding: 0 var(--space-6);
    border: none;
    border-radius: var(--radius-full);
    background: var(--color-tab-calendar);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }

  .save:disabled {
    opacity: 0.4;
  }

  button:active:not(:disabled) {
    transform: scale(0.98);
  }
</style>
