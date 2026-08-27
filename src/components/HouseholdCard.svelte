<!--
  Who lives here, and how a second person gets in.

  Round 2 built households and left the invite for later; this is later. It is
  a six-character code rather than an email invite because an email invite needs
  something that sends email, and this project has no server and no budget
  (NIU.md §1). For two people in the same kitchen, reading six characters out is
  also simply quicker than typing an address.

  The code is only fetched when the button is tapped. There is no reason for
  every Settings visit to mint one, and a code sitting permanently on screen is
  a code someone eventually photographs.

  Joining is the destructive half, so it says what it will do *before* the
  button rather than after: you leave the household you are in, and anything
  only you put there stops being reachable. The database refuses the case that
  really would lose something — walking out of a household somebody else is
  already in — so the warning here covers the one case it allows.
-->
<script lang="ts">
  import {
    fetchJoinCode,
    joinHousehold,
    memberName,
    members,
  } from '../lib/members.svelte'
  import { auth } from '../lib/auth.svelte'
  import { household, loadHousehold } from '../lib/household.svelte'
  import { strings } from '../lib/strings'
  import MemberAvatar from './MemberAvatar.svelte'

  let code = $state('')
  let problem = $state<string | null>(null)
  let joined = $state(false)

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
</script>

<div class="card">
  <h2>{strings.members.title}</h2>

  <ul class="people">
    {#each members.list as member (member.userId)}
      <li class="person">
        <MemberAvatar {member} size="md" />
        <span class="name">{memberName(member)}</span>
        {#if member.userId === auth.userId}<span class="you">{strings.members.you}</span>{/if}
      </li>
    {/each}
  </ul>

  {#if members.alone}
    <p class="hint">{strings.members.alone}</p>
  {/if}

  <div class="block">
    <h3>{strings.members.inviteTitle}</h3>
    <p class="hint">{strings.members.inviteBody}</p>
    {#if members.joinCode}
      <p class="code">{members.joinCode}</p>
      <button class="quiet" onclick={() => void fetchJoinCode()}>
        {strings.members.inviteRefresh}
      </button>
    {:else}
      <button class="action" onclick={() => void fetchJoinCode()}>
        {strings.members.inviteShow}
      </button>
    {/if}
  </div>

  <div class="block">
    <h3>{strings.members.joinTitle}</h3>
    <p class="hint">{strings.members.joinBody}</p>
    <div class="join">
      <input
        class="input"
        type="text"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        maxlength="6"
        placeholder={strings.members.joinPlaceholder}
        bind:value={code}
      />
      <button
        class="action"
        disabled={members.joining || code.trim().length !== 6}
        onclick={join}
      >
        {members.joining ? strings.members.joining : strings.members.joinButton}
      </button>
    </div>
    {#if !joined}<p class="hint warn">{strings.members.joinWarning}</p>{/if}
    {#if problem}<p class="error">{problem}</p>{/if}
    {#if joined}<p class="good">{strings.members.joined}</p>{/if}
  </div>

  {#if household.name}<p class="hint faint">{household.name}</p>{/if}
</div>

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
    gap: var(--space-2);
  }

  .person {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .name {
    flex: 1;
    font-size: var(--text-base);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .you {
    flex: none;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
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

  .join {
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
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .action {
    flex: none;
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

  button:active:not(:disabled) {
    transform: scale(0.97);
  }
</style>
