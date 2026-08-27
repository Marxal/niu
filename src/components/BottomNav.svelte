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
  import { calendar } from '../lib/calendar.svelte'
  import { TABS, hrefFor, type RouteId } from '../lib/router'
  import { strings } from '../lib/strings'
  import TabIcon from './TabIcon.svelte'

  let { route }: { route: RouteId } = $props()

  /**
   * How many things are waiting on an answer from you.
   *
   * Only the calendar carries a count for now, and the reason it is here rather
   * than on the calendar screen is the whole reason to have it: a question you
   * only see once you open the tab it is on is not a question anyone answers.
   * Round 11.1 turns this same number into a notification on the phone itself.
   */
  let badges = $derived<Partial<Record<RouteId, number>>>({
    calendar: calendar.waitingOnMe.length,
  })
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
      <span class="icon">
        <TabIcon name={tab.id} />
        {#if (badges[tab.id] ?? 0) > 0}
          <span class="badge" aria-hidden="true">{badges[tab.id]}</span>
        {/if}
      </span>
      <span class="label">
        {tab.label}
        {#if (badges[tab.id] ?? 0) > 0}
          <span class="sr">
            {badges[tab.id] === 1
              ? strings.calendar.badgeOne
              : strings.calendar.badgeMany(badges[tab.id] ?? 0)}
          </span>
        {/if}
      </span>
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

  .icon {
    position: relative;
    display: inline-flex;
  }

  /* A count, not a dot: "3 to confirm" and "1 to confirm" are different enough
     to deserve different marks, and the number is what makes it worth walking
     over to the tab. */
  .badge {
    position: absolute;
    top: -0.25rem;
    right: -0.5rem;
    min-width: 1rem;
    height: 1rem;
    padding: 0 0.25rem;
    border-radius: var(--radius-full);
    background: var(--color-danger);
    color: var(--color-accent-ink);
    font-size: 0.625rem;
    font-weight: var(--weight-bold);
    line-height: 1rem;
    text-align: center;
  }

  /* Read out by a screen reader, invisible to everyone else — the badge itself
     is a bare digit and does not say what it counts. */
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
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
