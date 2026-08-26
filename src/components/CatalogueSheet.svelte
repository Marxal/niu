<!--
  The catalogue: a full-height sheet of tiles you tap to add to the list.

  "You almost never type — you tap a tile and it moves to the list" (NIU.md
  §4.1). So the search box is a filter, not the primary way in; the grid is.

  Typing something the catalogue doesn't know shows an Add button that creates
  the word and puts it on the list in one action, never as a separate "create
  item" step.

  The sheet stays open after each tap. Adding five things is one trip, not five.
-->
<script lang="ts">
  import { matchesSearch } from '../lib/list-view'
  import { strings } from '../lib/strings'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import ItemTile from './ItemTile.svelte'

  let {
    catalogue,
    onList,
    onAdd,
    onAddNew,
    onClose,
  }: {
    catalogue: CatalogueItem[]
    onList: Set<string>
    onAdd: (catalogueItemId: string) => void
    onAddNew: (name: string) => void
    onClose: () => void
  } = $props()

  let query = $state('')

  let filtered = $derived(catalogue.filter((item) => matchesSearch(item.name, query)))

  let groups = $derived.by(() => {
    const map = new Map<string, CatalogueItem[]>()
    for (const item of [...filtered].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const list = map.get(item.category)
      if (list) list.push(item)
      else map.set(item.category, [item])
    }
    return [...map.entries()]
  })

  // Only offer to create a word when the search finds no exact match — typing
  // "mil" while "milk" exists shouldn't invite creating a duplicate.
  let trimmed = $derived(query.trim())
  let canAddNew = $derived(
    trimmed !== '' &&
      !catalogue.some((item) => item.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()),
  )

  function submitNew(event: Event) {
    event.preventDefault()
    if (!canAddNew) return
    onAddNew(trimmed)
    query = ''
  }
</script>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.shopping.catalogueTitle}>
  <header class="bar">
    <form class="search" onsubmit={submitNew}>
      <input
        type="search"
        bind:value={query}
        placeholder={strings.shopping.searchPlaceholder}
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        aria-label={strings.shopping.searchPlaceholder}
      />
      {#if canAddNew}
        <button type="submit" class="add-new">{strings.shopping.addNewWord}</button>
      {/if}
    </form>
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

  <div class="scroll">
    {#if groups.length === 0}
      <p class="empty">{strings.shopping.noResults}</p>
    {:else}
      {#each groups as [category, items] (category)}
        <section class="group">
          <h3>{category}</h3>
          <div class="grid">
            {#each items as item (item.id)}
              <ItemTile
                name={item.name}
                icon={item.icon}
                state={onList.has(item.id) ? 'on-list' : 'default'}
                onclick={() => onAdd(item.id)}
              />
            {/each}
          </div>
        </section>
      {/each}
    {/if}
  </div>
</div>

<style>
  .sheet {
    position: fixed;
    inset: 0;
    z-index: var(--z-sheet);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background: var(--color-bg);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-3);
    padding-top: calc(var(--space-3) + env(safe-area-inset-top, 0px));
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }

  .search {
    display: flex;
    flex: 1;
    gap: var(--space-2);
    min-width: 0;
  }

  input {
    flex: 1;
    min-width: 0;
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    /* 16px minimum, or Android zooms the page when the field is focused. */
    font-size: var(--text-base);
  }

  input::placeholder {
    color: var(--color-text-faint);
  }

  .add-new {
    flex: none;
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border-radius: var(--radius-full);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: var(--weight-medium);
  }

  .close {
    display: grid;
    flex: none;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
  }

  .close:active {
    background: var(--color-surface-sunken);
  }

  .scroll {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--space-4) var(--space-4);
    padding-bottom: calc(var(--space-8) + env(safe-area-inset-bottom, 0px));
  }

  .group + .group {
    margin-top: var(--space-5);
  }

  h3 {
    margin-bottom: var(--space-3);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
    gap: var(--space-2);
  }

  .empty {
    padding: var(--space-7) var(--space-4);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    text-align: center;
  }
</style>
