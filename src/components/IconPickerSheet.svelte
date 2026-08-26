<!--
  Pick a different picture for one item.

  Reached by long-pressing a tile, which is also where "remove for good" lives —
  so the long-press opens a small menu rather than jumping straight into one
  action. This is the second step.

  Round 6 gave it three tabs, one per way of drawing a thing: the house line
  drawings, the phone's own emoji, and OpenMoji's. What you pick is what you get:
  a choice made here beats the icon style preference in Settings, because a
  preference is about the grid as a whole and this is about one item (see
  icon-ref.ts).

  The Emoji and Inked tabs show the same list — the emoji the catalogue knows —
  so the tabs differ in how they draw, not in what is on offer. Everything is
  shown at once in a scrolling grid rather than searched, because finding the
  right *picture* is a looking-at task, not a typing one.
-->
<script lang="ts">
  import { ICONS } from '../lib/icons'
  import { formatIconRef, parseIconRef, type IconKind } from '../lib/icon-ref'
  import { OPENMOJI_EMOJI, openmojiSrc } from '../lib/openmoji'
  import { prefs } from '../lib/prefs.svelte'
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
    /** Receives the value to store — always prefixed. */
    onPick: (icon: string) => void
    /** Drop the household's override and go back to the item's own icon. */
    onReset: () => void
    onClose: () => void
  } = $props()

  const slugs = Object.keys(ICONS)

  const tabs: { id: IconKind; label: string }[] = [
    { id: 'line', label: strings.prefs.iconsLine },
    { id: 'emoji', label: strings.prefs.iconsEmoji },
    { id: 'inked', label: strings.prefs.iconsInked },
  ]

  let chosen = $derived(parseIconRef(current))

  // Open on the tab that explains what you're looking at: the kind already
  // chosen for this item, or failing that the style the grid is drawn in. Read
  // once — the parent keys this sheet on the item, so a fresh one mounts every
  // time, and re-deriving the tab would yank it back under a moving thumb.
  /* svelte-ignore state_referenced_locally */
  let tab = $state<IconKind>(chosen?.explicit ? chosen.kind : prefs.iconStyle)

  function isOn(kind: IconKind, value: string): boolean {
    if (!chosen) return false
    // An unprefixed slug is the item's default, and still worth marking so it is
    // obvious what you would be changing from.
    return chosen.kind === kind && chosen.value === value
  }
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

  <div class="tabs" role="group" aria-label={strings.prefs.iconsTitle}>
    {#each tabs as option (option.id)}
      <button
        class="tab"
        class:on={tab === option.id}
        aria-pressed={tab === option.id}
        onclick={() => (tab = option.id)}
      >
        {option.label}
      </button>
    {/each}
  </div>

  <div class="grid">
    {#if tab === 'line'}
      {#each slugs as slug (slug)}
        <button
          class="choice"
          class:on={isOn('line', slug)}
          aria-pressed={isOn('line', slug)}
          aria-label={slug}
          onclick={() => onPick(formatIconRef('line', slug))}
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
    {:else}
      {#each OPENMOJI_EMOJI as glyph (glyph)}
        <button
          class="choice"
          class:on={isOn(tab, glyph)}
          aria-pressed={isOn(tab, glyph)}
          aria-label={glyph}
          onclick={() => onPick(formatIconRef(tab, glyph))}
        >
          {#if tab === 'inked'}
            <img class="inked" src={openmojiSrc(glyph)} alt="" aria-hidden="true" />
          {:else}
            <span class="emoji" aria-hidden="true">{glyph}</span>
          {/if}
        </button>
      {/each}
    {/if}
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
    /* Header, tabs and footer stay put; only the grid in the middle scrolls. */
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    gap: var(--space-3);
    max-height: 78vh;
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

  /* ---- The three tabs ---------------------------------------------------- */

  .tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
  }

  .tab {
    min-height: 2.5rem;
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .tab.on {
    background: var(--color-surface);
    box-shadow: var(--shadow-1);
    color: var(--color-text);
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

  .choice svg,
  .choice .inked {
    width: 60%;
    height: 60%;
  }

  .choice .inked {
    filter: var(--icon-inked-filter);
  }

  .choice .emoji {
    font-size: 1.5rem;
    line-height: 1;
    filter: var(--icon-emoji-filter);
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
