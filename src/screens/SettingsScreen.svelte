<!--
  Settings. Round 1 has one thing that actually does something — the Install
  button — plus stubs for what's coming, so the screen isn't a lie about where
  things will live.

  The Install button only appears when Chrome has actually offered us a prompt.
  If the app is already installed, or the browser doesn't support installing
  (Firefox on Android, or an in-app browser), the row explains itself instead of
  showing a button that would do nothing.
-->
<script lang="ts">
  import { auth, signOut } from '../lib/auth.svelte'
  import { household } from '../lib/household.svelte'
  import { install, promptInstall } from '../lib/install.svelte'
  import { setTheme, theme, type ThemeChoice } from '../lib/theme.svelte'
  import { strings } from '../lib/strings'

  const choices: { id: ThemeChoice; label: string }[] = [
    { id: 'system', label: strings.theme.system },
    { id: 'light', label: strings.theme.light },
    { id: 'dark', label: strings.theme.dark },
  ]
</script>

<section class="settings">
  <div class="card">
    <div class="row stack">
      <div class="text">
        <h2>{strings.theme.title}</h2>
      </div>
      <div class="segmented" role="group" aria-label={strings.theme.title}>
        {#each choices as choice (choice.id)}
          <button
            class="segment"
            class:on={theme.choice === choice.id}
            aria-pressed={theme.choice === choice.id}
            onclick={() => setTheme(choice.id)}
          >
            {choice.label}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="row">
      <div class="text">
        <h2>{strings.settings.installTitle}</h2>
        <p>
          {#if install.installed}
            {strings.settings.installedBody}
          {:else if install.available}
            {strings.settings.availableBody}
          {:else}
            {strings.settings.unavailableBody}
            <strong>{strings.settings.unavailableAction}</strong>.
          {/if}
        </p>
      </div>
      {#if install.available}
        <button class="button" onclick={promptInstall}>{strings.settings.installButton}</button>
      {/if}
    </div>
  </div>

  {#if auth.status === 'signed-in'}
    <div class="card">
      <div class="row">
        <div class="text">
          <h2>{strings.settings.accountTitle}</h2>
          <p>{strings.settings.signedInAs} {auth.email ?? ''}</p>
        </div>
        <button class="button ghost" onclick={signOut}>{strings.auth.signOut}</button>
      </div>
      <div class="row">
        <div class="text">
          <h2>{strings.settings.householdTitle}</h2>
          <p>
            {#if household.error}
              {household.error}
            {:else if household.name}
              {household.name}
            {:else}
              {strings.household.loading}
            {/if}
          </p>
        </div>
      </div>
    </div>

    {#if auth.error}
      <p class="error" role="alert">{auth.error}</p>
    {/if}
  {:else}
    <div class="card">
      <div class="row muted">
        <div class="text">
          <h2>{strings.settings.notConnectedTitle}</h2>
          <p>{strings.settings.notConnectedBody}</p>
        </div>
      </div>
      <div class="row muted">
        <div class="text">
          <h2>{strings.settings.householdTitle}</h2>
          <p>{strings.settings.householdBody}</p>
        </div>
      </div>
    </div>
  {/if}

  <p class="version">{strings.settings.version}</p>
</section>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    /* Extra room at the bottom so the last card never hugs the nav bar. */
    padding: var(--space-4) var(--space-4) var(--space-6);
  }

  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    min-height: var(--tap-min);
  }

  .row + .row {
    border-top: 1px solid var(--color-border);
  }

  /* The theme picker needs its control under the label, not beside it — three
     segments won't fit next to a heading at 412px. */
  .row.stack {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
    transition:
      background var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease);
  }

  .segment.on {
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }

  .row.muted h2,
  .row.muted p {
    color: var(--color-text-faint);
  }

  h2 {
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  p {
    margin-top: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .button {
    flex: none;
    min-height: var(--tap-min);
    padding: 0 var(--space-5);
    border-radius: var(--radius-full);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .button:active {
    background: var(--color-accent-hover);
  }

  /* Sign out is destructive-ish and shouldn't compete with Install for
     attention, so it gets an outline rather than the filled accent. */
  .button.ghost {
    background: none;
    border: 1px solid var(--color-border-strong);
    color: var(--color-text-muted);
    padding: 0 var(--space-4);
  }

  .button.ghost:active {
    background: var(--color-surface-sunken);
  }

  .error {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-danger);
    font-size: var(--text-sm);
    text-align: center;
  }

  .version {
    text-align: center;
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }
</style>
