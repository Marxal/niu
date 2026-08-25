<!--
  The empty state every screen wears until it has real content.

  It exists so round 1 shows the shape of the app rather than three blank pages:
  same icon as the tab, the screen's name, one line saying what will live there.
  Each screen replaces this with its own content as it gets built — this component
  gets deleted when the last one is done.
-->
<script lang="ts">
  import type { RouteId } from '../lib/router'
  import TabIcon from './TabIcon.svelte'

  let { name, heading, blurb }: { name: RouteId; heading: string; blurb: string } = $props()
</script>

<div class="placeholder">
  <div class="badge" style="--tint: var(--color-tab-{name}, var(--color-accent))">
    <TabIcon {name} size={32} />
  </div>
  <h2>{heading}</h2>
  <p>{blurb}</p>
  <span class="tag">Encara per fer</span>
</div>

<style>
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    justify-content: center;
    gap: var(--space-3);
    /* The parent grid stretches this to the full scroll area, so justify-content
       above puts the empty state in the middle of the screen rather than
       clinging to the top with a void under it. */
    padding: var(--space-7) var(--space-5);
  }

  .badge {
    display: grid;
    place-items: center;
    width: var(--space-8);
    height: var(--space-8);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--tint);
    box-shadow: var(--shadow-1);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  p {
    max-width: 22rem;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .tag {
    margin-top: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
  }
</style>
