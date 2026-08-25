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
  import { install, promptInstall } from '../lib/install.svelte'
  import { strings } from '../lib/strings'
</script>

<section class="settings">
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

  <div class="card">
    <div class="row muted">
      <div class="text">
        <h2>{strings.settings.accountTitle}</h2>
        <p>{strings.settings.accountBody}</p>
      </div>
    </div>
    <div class="row muted">
      <div class="text">
        <h2>{strings.settings.householdTitle}</h2>
        <p>{strings.settings.householdBody}</p>
      </div>
    </div>
  </div>

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
    /* Extra room at the bottom so the last card never hugs the nav bar. */
    padding: var(--space-4) var(--space-4) var(--space-6);
    min-height: var(--tap-min);
  }

  .row + .row {
    border-top: 1px solid var(--color-border);
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

  .version {
    text-align: center;
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }
</style>
