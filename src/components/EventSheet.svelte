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
    canSave,
    confirmState,
    draftFrom,
    needsReconfirming,
    newDraft,
  } from '../lib/calendar'
  import { addDays, longDate, shortDayName } from '../lib/dates'
  import { TAG_COLOURS, tagStyle, type TagColour } from '../lib/dish-tags'
  import { members, memberName } from '../lib/members.svelte'
  import { strings } from '../lib/strings'
  import MemberAvatar from './MemberAvatar.svelte'

  let {
    event = null,
    kind = 'event',
    day,
    onsave,
    onremove,
    onask,
    onunask,
    onclose,
  }: {
    /** Null when writing a new one. */
    event?: CalendarEvent | null
    /** Only read when `event` is null. */
    kind?: EventKind
    /** The day the sheet was opened from. Only read when `event` is null. */
    day: string
    onsave: (draft: EventDraft, reask: boolean) => void
    onremove: () => void
    onask: () => void
    onunask: () => void
    onclose: () => void
  } = $props()

  // Snapshotted once — see the header.
  // svelte-ignore state_referenced_locally
  let draft = $state<EventDraft>(event ? draftFrom(event) : newDraft(kind, day))
  // svelte-ignore state_referenced_locally
  const original: EventDraft = event ? draftFrom(event) : newDraft(kind, day)

  let more = $state(false)
  let confirmingRemove = $state(false)

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

  /** All day is the absence of a start time, not a column of its own. */
  function setAllDay(allDay: boolean) {
    draft.startTime = allDay ? null : '18:00'
    if (allDay) draft.endTime = null
  }

  function setMultiDay(on: boolean) {
    draft.endsOn = on ? addDays(draft.startsOn, 1) : draft.startsOn
  }

  /** Keep a single-day event single as its start moves — the common case by far. */
  function onStartDayChange() {
    if (original.endsOn === original.startsOn || draft.endsOn < draft.startsOn) {
      draft.endsOn = draft.startsOn
    }
  }

  function toggleAttendee(userId: string) {
    draft.attendees = draft.attendees.includes(userId)
      ? draft.attendees.filter((id) => id !== userId)
      : [...draft.attendees, userId]
  }

  function pickColour(colour: TagColour) {
    draft.colour = colour
  }

  function save() {
    if (!canSave(draft)) return
    onsave(draft, willReask)
  }

  /** The one other person, when there is exactly one — so the button can say
   *  "Ask Marta to confirm" rather than a pronoun-free "Ask to confirm". */
  let theOther = $derived(members.others.length === 1 ? members.others[0] : null)
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={heading}>
  <header class="head">
    <h2>{heading}</h2>
    <button class="text-button" onclick={onclose}>{strings.calendar.cancel}</button>
  </header>

  <div class="body">
    <label class="field">
      <span class="label">{strings.calendar.titleLabel}</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="input title-input"
        type="text"
        autofocus
        autocomplete="off"
        maxlength="120"
        placeholder={isReminder
          ? strings.calendar.reminderPlaceholder
          : strings.calendar.eventPlaceholder}
        bind:value={draft.title}
      />
    </label>

    <div class="field">
      <span class="label">{strings.calendar.whenLabel}</span>
      <div class="when">
        <input class="input day" type="date" bind:value={draft.startsOn} onchange={onStartDayChange} />
        {#if draft.startTime !== null}
          <input class="input time" type="time" bind:value={draft.startTime} />
        {/if}
        <button
          class="chip"
          class:on={draft.startTime === null}
          aria-pressed={draft.startTime === null}
          onclick={() => setAllDay(draft.startTime !== null)}
        >
          {strings.calendar.allDayLabel}
        </button>
      </div>
      {#if isReminder}
        <p class="hint">{strings.calendar.reminderHint}</p>
      {/if}
    </div>

    {#if !members.alone}
      <div class="field">
        <!-- A reminder is a job rather than an outing: you do not "go" to
             renewing a parking permit, you are the one who has to. -->
        <span class="label">
          {isReminder ? strings.calendar.whoForLabel : strings.calendar.whoLabel}
        </span>
        <div class="faces">
          {#each members.list as member (member.userId)}
            <MemberAvatar
              {member}
              size="lg"
              on={draft.attendees.includes(member.userId)}
              onclick={() => toggleAttendee(member.userId)}
            />
          {/each}
        </div>
        {#if draft.attendees.length === 0}
          <p class="hint">{strings.calendar.whoEveryone}</p>
        {/if}
      </div>
    {/if}

    {#if more}
      <div class="field">
        <span class="label">{strings.calendar.endsLabel}</span>
        <div class="when">
          <button
            class="chip"
            class:on={draft.endsOn !== draft.startsOn}
            aria-pressed={draft.endsOn !== draft.startsOn}
            onclick={() => setMultiDay(draft.endsOn === draft.startsOn)}
          >
            {strings.calendar.moreDays}
          </button>
          {#if draft.endsOn !== draft.startsOn}
            <input class="input day" type="date" min={draft.startsOn} bind:value={draft.endsOn} />
          {/if}
          {#if draft.startTime !== null}
            <input class="input time" type="time" bind:value={draft.endTime} />
          {/if}
        </div>
      </div>

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

      <div class="field">
        <span class="label">{strings.calendar.colourLabel}</span>
        <div class="colours">
          {#each TAG_COLOURS as colour (colour)}
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
    {:else}
      <button class="more-button" onclick={() => (more = true)}>
        {strings.calendar.moreLabel}
      </button>
    {/if}

    {#if editing && !members.alone}
      <div class="field confirm">
        <span class="label">{strings.calendar.askTitle}</span>
        {#if willReask}
          <p class="hint warn">{strings.calendar.reconfirm}</p>
        {/if}
        {#if asked}
          <p class="answers">
            {#each event?.confirmations ?? [] as answer (answer.userId)}
              {@const who = members.list.find((m) => m.userId === answer.userId) ?? null}
              <span class="answer" class:yes={answer.answer === 'yes'} class:no={answer.answer === 'no'}>
                {answer.answer === 'yes' ? '✓' : answer.answer === 'no' ? '✕' : '…'}
                {memberName(who)}
              </span>
            {/each}
          </p>
          <button class="text-button quiet" onclick={onunask}>{strings.calendar.unask}</button>
        {:else}
          <button class="ask" onclick={onask}>
            {theOther ? strings.calendar.askOne(memberName(theOther)) : strings.calendar.askEveryone}
          </button>
        {/if}
      </div>
    {/if}

    {#if editing}
      {#if confirmingRemove}
        <div class="remove-row">
          <span>{strings.calendar.removeConfirm}</span>
          <button class="danger" onclick={onremove}>{strings.calendar.remove}</button>
          <button class="text-button" onclick={() => (confirmingRemove = false)}>
            {strings.calendar.cancel}
          </button>
        </div>
      {:else}
        <button class="text-button danger-text" onclick={() => (confirmingRemove = true)}>
          {strings.calendar.remove}
        </button>
      {/if}
    {/if}
  </div>

  <footer class="foot">
    <span class="day-note">{shortDayName(draft.startsOn)} {longDate(draft.startsOn)}</span>
    <button class="save" disabled={!canSave(draft)} onclick={save}>
      {editing ? strings.calendar.save : strings.calendar.saveAdd}
    </button>
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

  .title-input {
    font-size: var(--text-lg);
    font-weight: var(--weight-medium);
  }

  .notes {
    padding: var(--space-3);
    min-height: 5rem;
    line-height: var(--leading-normal);
  }

  .when {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .day {
    flex: 1 1 9rem;
    width: auto;
  }

  .time {
    flex: 0 1 7rem;
    width: auto;
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
    width: var(--tap-min);
    height: 2.25rem;
    border: 2px solid var(--tag-ink);
    border-radius: var(--radius-full);
    background: var(--tag-fill);
  }

  .swatch.on {
    background: var(--tag-ink);
  }

  .more-button {
    align-self: flex-start;
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-full);
    background: none;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .confirm {
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
  }

  .ask {
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-tab-calendar);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-tab-calendar);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
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

  .text-button.quiet {
    font-size: var(--text-sm);
  }

  .danger-text {
    color: var(--color-danger);
  }

  .remove-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .danger {
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: none;
    border-radius: var(--radius-full);
    background: var(--color-danger);
    color: var(--color-accent-ink);
    font-weight: var(--weight-medium);
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
