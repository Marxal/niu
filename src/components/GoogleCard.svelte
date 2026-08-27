<!--
  Connecting this phone to Google Calendar, and saying honestly what that does.

  Three facts this card has to get across, because all three surprise people:

  1. **It only ever writes.** The scope Niu asks for is `calendar.app.created` —
     "make secondary calendars and manage events on them". Niu cannot read work
     meetings; not "does not", *cannot*. That is the promise §4.3 makes, and
     here it is a property of the token rather than of our good intentions.

  2. **You get your own copy.** Each person's phone writes into a calendar
     called "Niu" in their own Google account. The same scope that makes the
     first fact true is the reason for this one: it cannot share a calendar with
     anyone, so there is no single shared calendar to write to. On the phone the
     result is the same, which is what matters.

  3. **A token lasts an hour.** Google only hands one to a page that asked
     because somebody tapped, so the first sync after opening the app is a tap.
     Rather than hide that behind a spinner that sometimes does nothing, the
     calendar screen shows a Sync button with a count on it.
-->
<script lang="ts">
  import { connectGoogle, disconnectGoogle, google } from '../lib/google.svelte'
  import { runSync, sync } from '../lib/google-sync.svelte'
  import { strings } from '../lib/strings'

  async function connect() {
    const ok = await connectGoogle()
    if (ok) await runSync(true)
  }
</script>

<div class="card">
  <div class="head">
    <h2>{strings.google.title}</h2>
    {#if google.status === 'ready'}
      <span class="pill on">{strings.google.connected}</span>
    {:else if google.status === 'expired'}
      <span class="pill">{strings.google.expired}</span>
    {/if}
  </div>

  {#if !google.available}
    <p class="body">{strings.google.unavailableBody}</p>
    <p class="hint">{strings.google.unavailable}</p>
  {:else}
    <p class="body">{strings.google.body}</p>

    {#if google.status === 'ready'}
      <p class="hint">
        {sync.pending === 0 ? strings.google.upToDate : strings.google.connectedBody}
      </p>
      {#if sync.pending > 0}
        <button class="action" disabled={sync.running} onclick={() => void runSync(true)}>
          {sync.running ? strings.google.syncing : strings.google.syncCount(sync.pending)}
        </button>
      {/if}
      <button class="quiet" onclick={disconnectGoogle}>{strings.google.disconnect}</button>
      <p class="hint">{strings.google.disconnectBody}</p>
    {:else}
      <button class="action" disabled={google.status === 'connecting'} onclick={connect}>
        {google.status === 'connecting'
          ? strings.google.connecting
          : google.status === 'expired'
            ? strings.google.sync
            : strings.google.connect}
      </button>
      {#if google.status === 'expired'}
        <p class="hint">{strings.google.expiredBody}</p>
      {/if}
    {/if}

    {#if google.calendarId}
      <p class="hint faint">Writing to your “Niu” calendar.</p>
    {/if}
  {/if}

  {#if google.error}<p class="error">{google.error}</p>{/if}
  {#if sync.error}<p class="error">{sync.error}</p>{/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  h2 {
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }

  .pill {
    flex: none;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
  }

  .pill.on {
    background: var(--color-pick-soft);
    color: var(--color-pick);
  }

  .body {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
    line-height: var(--leading-normal);
  }

  .hint.faint {
    font-size: var(--text-xs);
  }

  .action {
    align-self: flex-start;
    min-height: var(--tap-min);
    padding: 0 var(--space-5);
    border: none;
    border-radius: var(--radius-full);
    background: var(--color-tab-calendar);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .action:disabled {
    opacity: 0.5;
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

  .error {
    font-size: var(--text-sm);
    color: var(--color-danger);
  }

  button:active:not(:disabled) {
    transform: scale(0.97);
  }
</style>
