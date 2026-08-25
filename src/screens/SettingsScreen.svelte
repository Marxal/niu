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
</script>

<section class="settings">
  <div class="card">
    <div class="row">
      <div class="text">
        <h2>Instal·la Niu</h2>
        <p>
          {#if install.installed}
            Ja el tens instal·lat. Obre'l des de la icona del mòbil.
          {:else if install.available}
            Afegeix Niu a la pantalla d'inici perquè s'obri com una app.
          {:else}
            Si no veus el botó, fes-ho des del menú del navegador:
            <strong>Afegeix a la pantalla d'inici</strong>.
          {/if}
        </p>
      </div>
      {#if install.available}
        <button class="button" onclick={promptInstall}>Instal·la</button>
      {/if}
    </div>
  </div>

  <div class="card">
    <div class="row muted">
      <div class="text">
        <h2>Compte</h2>
        <p>L'inici de sessió amb Google arribarà a la propera ronda.</p>
      </div>
    </div>
    <div class="row muted">
      <div class="text">
        <h2>La casa</h2>
        <p>Convidar la parella i compartir llistes, més endavant.</p>
      </div>
    </div>
  </div>

  <p class="version">Niu · esquelet (ronda 1)</p>
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
