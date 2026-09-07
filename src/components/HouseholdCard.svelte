<!--
  Who lives here, and the two ways somebody gets added.

  The two are genuinely different things, but round 21 stopped saying so with
  two permanently-open blocks — that read as twice the reading, not twice the
  clarity. They now share one "Add someone" block behind a two-way toggle
  (`addMode`), same pattern as the segmented controls in Settings:

   - **Has a phone** gets a six-character code, signs in with their own Google
     account, and can be asked to confirm events. Not an email invite: sending
     email needs a server, and NIU.md §1 says there is no budget for one.
   - **No phone** — a child, a grandparent — is just a name and a face that
     events can point at. Round 11.2 added them, and they are the reason the
     app talks about *people* rather than members now.

  The code is only fetched when the button is tapped. There is no reason for
  every Settings visit to mint one, and a code sitting permanently on screen is
  a code somebody eventually photographs.

  Joining a *different* household is a separate, once-ever action — not a way
  of adding someone to this one — so it stays collapsed behind `joinToggle`
  until tapped. It's the destructive half, so once open it says what it will do
  *before* the button rather than after. The database refuses the case that
  would really lose something — walking out of a household somebody else is
  already in — so the warning here covers the one case it allows.
-->
<script lang="ts">
  import { auth } from '../lib/auth.svelte'
  import { DEFAULT_TAG_COLOUR, TAG_COLOURS } from '../lib/dish-tags'
  import { household, loadHousehold } from '../lib/household.svelte'
  import {
    type Person,
    addPerson,
    fetchJoinCode,
    joinHousehold,
    people,
    personName,
  } from '../lib/people.svelte'
  import { strings } from '../lib/strings'
  import PersonAvatar from './PersonAvatar.svelte'
  import PersonSheet from './PersonSheet.svelte'

  let code = $state('')
  let problem = $state<string | null>(null)
  let joined = $state(false)
  let joinOpen = $state(false)
  let adding = $state(false)
  let newName = $state('')
  let editing = $state<Person | null>(null)
  let addMode = $state<'phone' | 'noPhone'>('phone')

  /**
   * The colour a new person gets: the first of the eight nobody is using yet,
   * so a household of three does not end up with three sky-blue faces and a
   * settings trip to fix it.
   */
  let nextColour = $derived(
    TAG_COLOURS.find((c) => !people.list.some((p) => p.colour === c)) ?? DEFAULT_TAG_COLOUR,
  )

  async function join() {
    problem = null
    const failure = await joinHousehold(code)

    if (failure !== null) {
      problem = failure
      return
    }

    code = ''
    joined = true
    // The household id itself has changed, so everything hanging off it has to
    // be read again. loadHousehold() is what every other screen keys off.
    await loadHousehold()
  }

  async function add() {
    const id = await addPerson(newName, nextColour)
    if (id === null) return
    newName = ''
    adding = false
    // Straight into their sheet: you have just named somebody, and giving them
    // a face is the obvious next thing rather than a second trip.
    editing = people.list.find((p) => p.id === id) ?? null
  }
</script>

<div class="card">
  <h2>{strings.people.title}</h2>

  <ul class="people">
    {#each people.list as person (person.id)}
      <li>
        <button class="person" onclick={() => (editing = person)}>
          <PersonAvatar {person} size="md" />
          <span class="name">{personName(person)}</span>
          {#if person.userId === auth.userId}
            <span class="tag">{strings.people.you}</span>
          {:else if person.userId === null}
            <span class="tag outline">{strings.people.noAccount}</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>

  <div class="block">
    <h3>{strings.people.addTitle}</h3>
    <div class="segmented" role="group" aria-label={strings.people.addTitle}>
      <button
        class="segment"
        class:on={addMode === 'phone'}
        aria-pressed={addMode === 'phone'}
        onclick={() => (addMode = 'phone')}
      >
        {strings.people.addModePhone}
      </button>
      <button
        class="segment"
        class:on={addMode === 'noPhone'}
        aria-pressed={addMode === 'noPhone'}
        onclick={() => (addMode = 'noPhone')}
      >
        {strings.people.noAccount}
      </button>
    </div>

    {#if addMode === 'phone'}
      <p class="hint">{strings.people.inviteBody}</p>
      {#if people.joinCode}
        <p class="code">{people.joinCode}</p>
        <button class="quiet" onclick={() => void fetchJoinCode()}>
          {strings.people.inviteRefresh}
        </button>
      {:else}
        <button class="action" onclick={() => void fetchJoinCode()}>
          {strings.people.inviteShow}
        </button>
      {/if}
    {:else}
      <p class="hint">{strings.people.addBody}</p>
      {#if adding}
        <div class="row">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="input"
            type="text"
            autofocus
            maxlength="40"
            placeholder={strings.people.addPlaceholder}
            bind:value={newName}
            onkeydown={(e) => {
              if (e.key === 'Enter') void add()
            }}
          />
          <button class="action" disabled={newName.trim() === ''} onclick={add}>
            {strings.people.add}
          </button>
        </div>
      {:else}
        <button class="action" onclick={() => (adding = true)}>{strings.people.addButton}</button>
      {/if}
    {/if}
  </div>

  <div class="block">
    {#if joinOpen}
      <h3>{strings.people.joinTitle}</h3>
      <p class="hint">{strings.people.joinBody}</p>
      <div class="row">
        <input
          class="input code-input"
          type="text"
          autocapitalize="characters"
          autocomplete="off"
          spellcheck="false"
          maxlength="6"
          placeholder={strings.people.joinPlaceholder}
          bind:value={code}
        />
        <button
          class="action"
          disabled={people.joining || code.trim().length !== 6}
          onclick={join}
        >
          {people.joining ? strings.people.joining : strings.people.joinButton}
        </button>
      </div>
      {#if !joined}<p class="hint warn">{strings.people.joinWarning}</p>{/if}
      {#if problem}<p class="error">{problem}</p>{/if}
      {#if joined}<p class="good">{strings.people.joined}</p>{/if}
    {:else}
      <button class="quiet" onclick={() => (joinOpen = true)}>{strings.people.joinToggle}</button>
    {/if}
  </div>

  {#if people.error}<p class="error">{people.error}</p>{/if}
  {#if household.name}<p class="hint faint">{household.name}</p>{/if}
</div>

{#if editing}
  {#key editing.id}
    <PersonSheet
      person={people.list.find((p) => p.id === editing?.id) ?? editing}
      onclose={() => (editing = null)}
    />
  {/key}
{/if}

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  h2 {
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }

  h3 {
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    color: var(--color-text-muted);
  }

  .people {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  /* The whole row opens their sheet — a name and a face are one target, and
     hunting for a pencil at the end of a row is worse than tapping the person. */
  .person {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--tap-min);
    padding: 0 var(--space-1);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text);
    text-align: left;
  }

  .name {
    flex: 1;
    min-width: 0;
    font-size: var(--text-base);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag {
    flex: none;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  /* `.outline` rather than `.quiet`: this card also has a `.quiet` text button,
     and `.tag.quiet` was quietly inheriting its 48px min-height. */
  .tag.outline {
    background: none;
    border: 1px solid var(--color-border);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
  }

  /* Picks "has a phone" vs "no phone" — same look as the segmented controls in
     Settings, so this reads as one control rather than a new widget. */
  .segmented {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
  }

  .segment {
    min-height: 2.5rem;
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .segment.on {
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }

  /* Big, spaced and monospaced: this is read out loud across a room, and the
     job of the type here is to make an 8 and a B impossible to confuse. */
  .code {
    align-self: flex-start;
    padding: var(--space-2) var(--space-4);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    font-family: var(--font-mono);
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    letter-spacing: 0.15em;
  }

  .row {
    display: flex;
    gap: var(--space-2);
  }

  .input {
    flex: 1;
    min-width: 0;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: var(--text-base);
    font-family: inherit;
  }

  .code-input {
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .action {
    flex: none;
    align-self: flex-start;
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: none;
    border-radius: var(--radius-full);
    background: var(--color-tab-calendar);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .action:disabled {
    opacity: 0.4;
  }

  .quiet {
    align-self: flex-start;
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
    border: none;
    background: none;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
    line-height: var(--leading-normal);
  }

  .hint.warn {
    color: var(--color-warning);
  }

  .hint.faint {
    text-align: right;
  }

  .error {
    font-size: var(--text-sm);
    color: var(--color-danger);
  }

  .good {
    font-size: var(--text-sm);
    color: var(--color-success);
  }

  .person:active {
    background: var(--color-surface-sunken);
  }

  button:active:not(:disabled) {
    transform: scale(0.99);
  }
</style>
