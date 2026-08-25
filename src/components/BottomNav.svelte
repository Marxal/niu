<!--
  The bottom tab bar — the app's main navigation, and the thing a thumb touches most.

  Design notes that matter:
   - Each tab is a real <a href="#/…">, not a button. That means the Android back
     button steps back through tabs, and a long-press offers "open in new tab" like
     any link. Navigation is the URL changing; this component never sets state.
   - Every tab is at least --tap-min (48px) tall and takes an equal third of the
     width, so there's no small target near the screen edge.
   - It sits above the gesture bar: the bar's own height plus
     env(safe-area-inset-bottom) as padding, so nothing lands under the system UI.
-->
<script lang="ts">
  import { TABS, hrefFor, type RouteId } from '../lib/router'
  import { strings } from '../lib/strings'
  import TabIcon from './TabIcon.svelte'

  let { route }: { route: RouteId } = $props()
</script>

<nav class="nav" aria-label={strings.nav.label}>
  {#each TABS as tab (tab.id)}
    {@const active = route === tab.id}
    <a
      class="tab"
      class:active
      href={hrefFor(tab.id)}
      title={tab.title}
      aria-current={active ? 'page' : undefined}
      style="--tab-accent: var(--color-tab-{tab.id})"
    >
      <TabIcon name={tab.id} />
      <span class="label">{tab.label}</span>
    </a>
  {/each}
</nav>

<style>
  .nav {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    background: var(--color-surface);
    box-shadow: var(--shadow-nav);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    z-index: var(--z-nav);
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-height: var(--nav-height);
    padding: var(--space-2) var(--space-1);
    color: var(--color-text-muted);
    text-decoration: none;
    transition: color var(--dur-fast) var(--ease);
  }

  .tab.active {
    color: var(--tab-accent);
  }

  .label {
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    line-height: var(--leading-tight);
  }

  .tab.active .label {
    font-weight: var(--weight-bold);
  }

  /* A short bar under the active tab's label, in that tab's own colour. */
  .tab.active::after {
    content: '';
    position: absolute;
    inset: auto auto var(--space-2) auto;
    width: var(--space-5);
    height: 2px;
    border-radius: var(--radius-full);
    background: var(--tab-accent);
  }

  .tab {
    position: relative;
  }

  .tab:active {
    background: var(--color-surface-sunken);
  }
</style>
