<!--
  One event or reminder, as a row in the day list.

  The row carries four marks, and each one is a different question:

    the colour bar    which category it is — the event's own colour
    the time          when, or "All day"
    the avatars       who is going. Absent means everyone (§4.3)
    the state         waiting / can't make it / not in Google yet

  **Unconfirmed is dashed, not hidden.** An event that only appeared once the
  other person confirmed it would be an event you cannot talk about. So it is
  fully on the calendar from the moment it is written, wearing a dashed border
  and the word "Waiting" — visible, and visibly not settled.

  A reminder gets a checkbox on the left instead of a colour bar, because ticking
  it is the main thing you do to one and it should be reachable without opening
  anything. Everything else about the row is identical, deliberately: a reminder
  at 09:00 and a dentist at 11:00 belong in one list in clock order, not in two
  columns.
-->
<script lang="ts">
  import {
    type CalendarEvent,
    confirmState,
    isMultiDay,
    spanDays,
  } from '../lib/calendar'
  import { dateRange, timeLabel } from '../lib/dates'
  import { tagStyle } from '../lib/dish-tags'
  import { personById, personByUserId, personName } from '../lib/people.svelte'
  import { strings } from '../lib/strings'
  import PersonAvatar from './PersonAvatar.svelte'

  let {
    event,
    /** True when Google has not been told about this one yet. */
    unsynced = false,
    onopen,
    ontoggleDone,
  }: {
    event: CalendarEvent
    unsynced?: boolean
    onopen: () => void
    ontoggleDone: () => void
  } = $props()

  let state = $derived(confirmState(event))
  let done = $derived(event.doneAt !== null)
  let time = $derived(timeLabel(event.startTime, event.endTime))

  let going = $derived(
    event.attendees.map((id) => personById(id)).filter((p) => p !== null),
  )

  /** Who we are waiting on, or who said no — named, because "waiting" alone in
   *  a household of three would leave you guessing which one. */
  let stateLabel = $derived.by(() => {
    const pending = event.confirmations.filter((c) => c.answer === null)
    const refused = event.confirmations.filter((c) => c.answer === 'no')

    if (state === 'declined') {
      const who = refused[0]
      const name = who ? personName(personByUserId(who.userId)) : null
      return refused.length === 1 && name
        ? strings.calendar.declinedBy(name)
        : strings.calendar.declined
    }
    if (state === 'waiting') {
      const who = pending[0]
      const name = who ? personName(personByUserId(who.userId)) : null
      return pending.length === 1 && name
        ? strings.calendar.waitingOn(name)
        : strings.calendar.waiting
    }
    if (state === 'confirmed') return strings.calendar.confirmed
    return null
  })
</script>

<div class="row" class:waiting={state === 'waiting'} class:declined={state === 'declined'}>
  {#if event.kind === 'reminder'}
    <button
      class="tick"
      class:done
      style={tagStyle(event.colour)}
      aria-pressed={done}
      aria-label={done ? strings.calendar.undone : strings.calendar.done}
      onclick={ontoggleDone}
    >
      <span class="box">{#if done}✓{/if}</span>
    </button>
  {:else}
    <span class="bar" style={tagStyle(event.colour)}></span>
  {/if}

  <button class="body" class:done onclick={onopen}>
    <span class="line">
      <span class="title">{event.title}</span>
      {#if going.length > 0}
        <span class="faces">
          {#each going as person (person.id)}
            <PersonAvatar {person} size="sm" />
          {/each}
        </span>
      {/if}
    </span>

    <span class="meta">
      {#if isMultiDay(event)}
        <span class="when">{dateRange(event.startsOn, event.endsOn)}</span>
        <span class="dim">· {spanDays(event)} days</span>
      {:else if time === ''}
        <span class="when">{strings.calendar.allDay}</span>
      {:else}
        <span class="when">{time}</span>
      {/if}

      {#if event.location}<span class="dim">· {event.location}</span>{/if}
      {#if stateLabel}<span class="state">· {stateLabel}</span>{/if}
      {#if unsynced}<span class="dim cloud" title={strings.google.notSynced}>· ☁</span>{/if}
    </span>
  </button>
</div>

<style>
  .row {
    display: flex;
    align-items: stretch;
    gap: var(--space-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  /* Waiting on somebody: dashed all the way round. The one visual idea in the
     feature — present, and visibly not settled. */
  .row.waiting {
    border-style: dashed;
    border-color: var(--color-border-strong);
    background: transparent;
  }

  .row.declined {
    border-color: var(--color-danger);
  }

  .bar {
    flex: none;
    width: var(--space-2);
    background: var(--tag-ink);
  }

  /* The button is a full 48px target; the box inside it is half that. Ticking
     a reminder off is the main thing you do to one, so it has to be hittable
     without aiming. */
  .tick {
    flex: none;
    align-self: center;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--tap-min);
    height: var(--tap-min);
    border: none;
    background: none;
    padding: 0;
  }

  .box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid var(--tag-ink);
    border-radius: var(--radius-sm);
    background: var(--tag-fill);
    color: var(--tag-ink);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    line-height: 1;
  }

  .tick.done .box {
    background: var(--tag-ink);
    color: var(--color-surface);
  }

  .tick:active .box {
    transform: scale(0.9);
  }

  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-1);
    min-height: var(--tap-min);
    padding: var(--space-3) var(--space-3) var(--space-3) 0;
    border: none;
    background: none;
    color: var(--color-text);
    text-align: left;
  }

  .tick + .body {
    padding-left: 0;
  }

  .line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .title {
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    line-height: var(--leading-tight);
    /* Two lines, then an ellipsis. A long title must not push the time out of
       the row — the time is the half you scan for. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .body.done .title {
    text-decoration: line-through;
    color: var(--color-text-muted);
  }

  .faces {
    display: flex;
    flex: none;
    /* Overlapped, so three faces cost the width of two. */
    margin-left: var(--space-1);
  }

  .faces > :global(* + *) {
    margin-left: -0.4rem;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .when {
    font-variant-numeric: tabular-nums;
    font-weight: var(--weight-medium);
  }

  .dim {
    color: var(--color-text-faint);
  }

  .state {
    color: var(--color-warning);
    font-weight: var(--weight-medium);
  }

  .row.declined .state {
    color: var(--color-danger);
  }

  .cloud {
    font-size: var(--text-xs);
  }

  .body:active {
    background: var(--color-surface-sunken);
  }
</style>
