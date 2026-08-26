<!--
  Pick a different icon for one item.

  Reached by long-pressing a tile, which is also where "remove for good" lives —
  so the long-press opens a small menu rather than jumping straight into one
  action. This is the second step.

  The whole set is shown at once in a scrolling grid rather than searched,
  because there are under a hundred and finding the right *picture* is a
  looking-at task, not a typing one. The item's current icon is marked so it is
  obvious what you'd be changing from, and there is a way back to the default.
-->
<script lang="ts">
  import { ICONS } from '../lib/icons'
  import { strings } from '../lib/strings'

  let {
    name,
    current,
    onPick,
    onReset,
    onClose,
  }: {
    name: string
    /** The icon in force right now, chosen or inherited. */
    current: string | null
    onPick: (icon: string) => void
    /** Drop the household's override and go back to the item's own icon. */
    onReset: () => void
    onClose: () => void
  } = $props()

  const names = Object.keys(ICONS)
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.shopping.pickIconTitle}>
  <header>
    <div>
      <h2>{strings.shopping.pickIconTitle}</h2>
      <p>{name}</p>
    </div>
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

  <div class="grid">
    {#each names as slug (slug)}
      <button
        class="choice"
        class:on={slug === current}
        aria-pressed={slug === current}
        aria-label={slug}
        onclick={() => onPick(slug)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          {#each ICONS[slug as keyof typeof ICONS] as d (d)}
            <path {d} />
          {/each}
        </svg>
      </button>
    {/each}
  </div>

  <footer>
    <button class="reset" onclick={onReset}>{strings.shopping.resetIcon}</button>
  </footer>
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
    display: grid;
    /* Header and footer stay put; only the grid in the middle scrolls. */
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-3);
    max-height: 72vh;
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
    background: var(--color-surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-2);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  header p {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .close {
    display: grid;
    flex: none;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    margin: calc(var(--space-2) * -1) calc(var(--space-2) * -1) 0 0;
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(3.25rem, 1fr));
    gap: var(--space-2);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--space-1);
  }

  .choice {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text-muted);
  }

  .choice svg {
    width: 60%;
    height: 60%;
  }

  .choice.on {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }

  .choice:active {
    transform: scale(0.94);
  }

  .reset {
    width: 100%;
    min-height: var(--tap-min);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }
</style>
