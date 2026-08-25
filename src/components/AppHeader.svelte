<!--
  The top bar: which screen you're on, and the way in and out of Settings.

  Settings is deliberately not a fourth tab — it isn't a place you go daily, and a
  fourth item would shrink the three that are. It lives here as an icon on the
  right instead, and turns into a close button while you're in it, returning you to
  whichever tab you came from.
-->
<script lang="ts">
  import { hrefFor, type RouteId, type TabId } from '../lib/router'
  import TabIcon from './TabIcon.svelte'

  let { route, title, backTo }: { route: RouteId; title: string; backTo: TabId } = $props()

  let inSettings = $derived(route === 'settings')
</script>

<header class="header">
  <h1 class="title">{title}</h1>

  <a
    class="action"
    class:active={inSettings}
    href={inSettings ? hrefFor(backTo) : hrefFor('settings')}
    aria-label={inSettings ? 'Tanca els ajustos' : 'Ajustos'}
  >
    {#if inSettings}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    {:else}
      <TabIcon name="settings" />
    {/if}
  </a>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: var(--header-height);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    padding-top: calc(var(--space-2) + env(safe-area-inset-top, 0px));
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }

  .title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    line-height: var(--leading-tight);
    letter-spacing: -0.01em;
  }

  .action {
    display: grid;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .action.active {
    color: var(--color-text);
    background: var(--color-surface-sunken);
  }

  .action:active {
    background: var(--color-surface-sunken);
  }
</style>
