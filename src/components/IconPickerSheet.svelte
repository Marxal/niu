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
  so the tabs differ in how they draw, not in what is on offer.

  Round 8.1 added the search field, and it changes the shape of the sheet while
  there is a query in it: the tabs go away and all three styles are shown at
  once, one section each. That is deliberate. Browsing is a per-style activity —
  you are choosing a look — but searching is not: someone typing "cheese" wants
  the cheese one, and having to guess which of three tabs it is hiding behind is
  exactly the friction the search was meant to remove.

  What makes a picture findable is the catalogue itself; see icon-search.ts.
-->
<script lang="ts">
  import { ICONS } from '../lib/icons'
  import { formatIconRef, parseIconRef, type IconKind } from '../lib/icon-ref'
  import { searchIcons } from '../lib/icon-search'
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

  /* ---- Searching --------------------------------------------------------- */

  const INKED = new Set(OPENMOJI_EMOJI)

  let query = $state('')
  let trimmed = $derived(query.trim())
  let searching = $derived(trimmed !== '')

  let found = $derived(searchIcons(trimmed, INKED))
  let nothing = $derived(
    searching && found.line.length === 0 && found.emoji.length === 0 && found.inked.length === 0,
  )
</script>

<!--
  One choice, drawn in whichever style it belongs to. A snippet rather than three
  copies of the same button: the browsing grids and the three search sections all
  render the same thing, and a `class:on` that drifted between copies would be a
  tile that quietly stops showing what is already chosen.
-->
{#snippet choice(kind: IconKind, value: string)}
  <button
    class="choice"
    class:on={isOn(kind, value)}
    aria-pressed={isOn(kind, value)}
    aria-label={value}
    onclick={() => onPick(formatIconRef(kind, value))}
  >
    {#if kind === 'line'}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        {#each ICONS[value as keyof typeof ICONS] as d (d)}
          <path {d} />
        {/each}
      </svg>
    {:else if kind === 'inked'}
      <img class="inked" src={openmojiSrc(value)} alt="" aria-hidden="true" />
    {:else}
      <span class="emoji" aria-hidden="true">{value}</span>
    {/if}
  </button>
{/snippet}

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

  <input
    type="search"
    bind:value={query}
    placeholder={strings.shopping.iconSearch}
    aria-label={strings.shopping.iconSearch}
    autocomplete="off"
    autocapitalize="none"
    spellcheck="false"
    enterkeyhint="search"
  />

  {#if !searching}
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
  {/if}

  <div class="scroller">
    {#if !searching}
      <div class="grid">
        {#if tab === 'line'}
          {#each slugs as slug (slug)}{@render choice('line', slug)}{/each}
        {:else}
          {#each OPENMOJI_EMOJI as glyph (glyph)}{@render choice(tab, glyph)}{/each}
        {/if}
      </div>
    {:else if nothing}
      <p class="none">{strings.shopping.iconNoResults}</p>
    {:else}
      {#each tabs as option (option.id)}
        {@const matches = found[option.id]}
        {#if matches.length > 0}
          <section>
            <h3>{option.label}</h3>
            <div class="grid">
              {#each matches as value (value)}{@render choice(option.id, value)}{/each}
            </div>
          </section>
        {/if}
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
    /* Header, search, tabs and footer stay put; only the middle scrolls. */
    grid-template-rows: auto auto auto minmax(0, 1fr) auto;
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

  .scroller {
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .scroller h3 {
    margin-bottom: var(--space-2);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .none {
    padding: var(--space-5) 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    text-align: center;
  }

  input {
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    /* 16px floor stops Android zooming in on focus. */
    font-size: var(--text-base);
  }

  input::placeholder {
    color: var(--color-text-faint);
  }

  /* The scrolling moved out to .scroller when searching gained sections, so
     this is now only a layout. */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(3.25rem, 1fr));
    gap: var(--space-2);
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
