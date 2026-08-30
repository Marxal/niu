<!--
  Turning phone notifications on, and being honest about what they are for.

  Three things this card has to say, because all three are what makes somebody
  keep notifications on rather than switch them off a week later:

  1. **Two things buzz, and only two.** A confirmation request, and the answer
     to one you sent. Not every event the other person adds, and nothing at all
     from the shopping list — that was Marçal's call in round 17, and it is the
     difference between a useful notification and one nobody reads.

  2. **This phone, not this account.** A push subscription belongs to one
     browser on one device. Turning it off here leaves the other phone exactly
     as it was, which is not obvious and would otherwise be discovered the hard
     way.

  3. **"No" is not undoable from here.** Once Android has the answer, only
     Android's own settings can change it. A button that silently does nothing
     is worse than a sentence explaining where to go.
-->
<script lang="ts">
  import { disablePush, enablePush, loadPush, push } from '../lib/push.svelte'
  import { strings } from '../lib/strings'

  // Read-only and promptless, so it is safe every time Settings opens: it only
  // asks the browser what it already decided.
  $effect(() => {
    void loadPush()
  })
</script>

<div class="card">
  <div class="head">
    <h2>{strings.push.title}</h2>
    {#if push.status === 'on'}
      <span class="pill on">{strings.push.on}</span>
    {:else if push.status === 'blocked'}
      <span class="pill">{strings.push.blocked}</span>
    {/if}
  </div>

  {#if push.status === 'unavailable'}
    <p class="body">{strings.push.unavailableBody}</p>
    <p class="hint">{strings.push.unavailable}</p>
  {:else if push.status === 'blocked'}
    <p class="body">{strings.push.blockedBody}</p>
  {:else}
    <p class="body">{strings.push.body}</p>

    {#if push.status === 'on'}
      <p class="hint">{strings.push.onBody}</p>
      <button class="quiet" onclick={() => void disablePush()}>{strings.push.disable}</button>
      <p class="hint faint">{strings.push.disableBody}</p>
    {:else}
      <button
        class="action"
        disabled={push.status === 'asking'}
        onclick={() => void enablePush()}
      >
        {push.status === 'asking' ? strings.push.asking : strings.push.enable}
      </button>
    {/if}
  {/if}

  {#if push.error}<p class="error">{push.error}</p>{/if}
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
