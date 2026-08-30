<!--
  "How should the list be ordered?" — the four orderings, as a sheet.

  It sits next to the shop chips rather than in Settings because the order is a
  per-shop thought: you change it while standing in the shop, not on the sofa a
  week earlier. Settings still has the same control for now.

  Rows rather than a segmented strip: four labels do not fit across 412px
  without truncating, and Shop order needs a line of explanation under it —
  "learns itself" is not something a three-word button can say. The current one
  is ticked; tapping any row applies it and closes, because there is nothing to
  confirm and the result is visible the moment the sheet goes.
-->
<script lang="ts">
  import { SORT_MODES, type SortMode } from '../lib/prefs.svelte'
  import { strings } from '../lib/strings'

  let {
    current,
    onPick,
    onClose,
  }: {
    current: SortMode
    onPick: (mode: SortMode) => void
    onClose: () => void
  } = $props()
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.prefs.sortTitle}>
  <header>
    <h2>{strings.prefs.sortTitle}</h2>
    <button class="close" onclick={onClose} aria-label={strings.shopping.close}>
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
    </button>
  </header>

  <div class="rows">
    {#each SORT_MODES as mode (mode.id)}
      <button
        class="row"
        class:on={mode.id === current}
        aria-pressed={mode.id === current}
        onclick={() => onPick(mode.id)}
      >
        <span class="label">{mode.label}</span>
        {#if mode.id === current}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        {/if}
      </button>
    {/each}
  </div>

  <p class="hint">{strings.prefs.sortHint}</p>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-sheet);
    background: var(--color-overlay);
  }

  .sheet {
    position: fixed;
    inset: auto 0 0 0;
    z-index: var(--z-sheet);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--color-surface);
    box-shadow: var(--shadow-2);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    color: var(--color-text);
  }

  .close {
    display: grid;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    margin: calc(var(--space-2) * -1);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-size: var(--text-base);
    text-align: left;
    transition:
      background var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease);
  }

  .row.on {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-weight: var(--weight-medium);
  }

  .row:active {
    transform: scale(0.99);
  }

  .label {
    min-width: 0;
  }

  .hint {
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--color-text-muted);
  }
</style>
