<!--
  Choosing what a dish is made of, inside the dish editor.

  Same grammar as the shopping screen, on purpose, because it is the same job:
  green rows are things you can tap to add, and the rows above are what you have
  already got. Tapping something you have already added takes it out again —
  exactly like tapping something in the trolley puts it back on the list.

  Two things arrived in round 8.1, both because "often bought, or type the exact
  name" turned out to be too narrow a door into a 360-item catalogue:

    - the categories underneath, so the whole catalogue can be browsed here the
      way it can on the shopping tab. You should not have to know a word to find
      it.
    - Add, for a word the catalogue doesn't have. It writes the item into the
      catalogue exactly as typing it on the shopping tab does — same "Our own
      words" category, same tile — and then puts it in the dish. Half the things
      a household actually cooks with are words nobody seeded.

  Round 10.1 changed two things about how it is laid out, both because of the
  keyboard. The search box **sticks to the top** as you scroll, so hunting
  through a long category never leaves you without the one control that gets you
  out of it. And the results are a **grid of four** rather than full-width rows:
  a dish is eight or ten ingredients, and four across shows a dozen candidates in
  the strip of sheet the keyboard leaves behind, where rows showed three.

  The chosen ingredients and the browsable categories stay as rows. Those are
  read rather than scanned — you are checking a list you already made, and the
  category sections are long enough that four-across would make them a wall.

  Nothing here writes to the dish. It hands a new array of catalogue ids to its
  parent, and the parent saves the whole dish in one go.
-->
<script lang="ts">
  import CategorySection from './CategorySection.svelte'
  import ItemTile from './ItemTile.svelte'
  import { categoryIcon } from '../lib/catalogue-seed'
  import {
    type PickerItem,
    categoriesInOrder,
    categoryPicks,
    matchesSearch,
    suggestedPicks,
  } from '../lib/list-view'
  import { createCatalogueWord, shopping } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    chosen,
    userId,
    onChange,
  }: {
    /** Catalogue item ids currently in the dish. */
    chosen: string[]
    /** Needed to write a new word into the catalogue. */
    userId: string | null
    onChange: (ids: string[]) => void
  } = $props()

  /** Enough to scroll through with a thumb; more than that, type. */
  const MAX_RESULTS = 18

  let query = $state('')
  let openCategories = $state<Set<string>>(new Set())
  let creating = $state(false)

  let chosenSet = $derived(new Set(chosen))

  // In the order they were added, so a row doesn't jump around under the thumb
  // that just tapped it. An id with no catalogue item behind it (hidden for
  // good, or deleted on the other phone) is dropped rather than rendered blank.
  let chosenItems = $derived(
    chosen.flatMap((id) => {
      const item = shopping.byId.get(id)
      return item ? [{ ...item, useCount: 0 }] : []
    }),
  )

  let trimmed = $derived(query.trim())
  let searching = $derived(trimmed !== '')

  let available = $derived(shopping.picker.filter((item) => !chosenSet.has(item.id)))

  let results = $derived.by<PickerItem[]>(() => {
    if (!searching) return suggestedPicks(available, chosenSet)

    return available
      .filter((item) => matchesSearch(item.name, trimmed))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, MAX_RESULTS)
  })

  let categories = $derived(searching ? [] : categoriesInOrder(available))

  // Offer to create only when nothing in the catalogue is an exact match, the
  // same rule the shopping search uses — typing "mil" while "milk" exists
  // shouldn't invite a duplicate.
  let canAddNew = $derived(
    searching &&
      !shopping.catalogue.some(
        (item) => item.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
      ),
  )

  function add(id: string) {
    if (chosenSet.has(id)) return
    onChange([...chosen, id])
  }

  function remove(id: string) {
    onChange(chosen.filter((existing) => existing !== id))
  }

  function toggleCategory(name: string) {
    const next = new Set(openCategories)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    openCategories = next
  }

  /**
   * Writes the typed word into the catalogue, then puts it in this dish.
   *
   * Deliberately not deferred until the dish is saved. The word is a catalogue
   * item in its own right — it belongs to the household, not to this dish — so
   * cancelling the dish afterwards should leave the word behind, exactly as
   * typing it on the shopping tab would have done.
   */
  async function submitNew(event: Event) {
    event.preventDefault()
    if (!canAddNew || !userId || creating) return

    creating = true
    const item = await createCatalogueWord(trimmed, userId)
    creating = false

    if (item) {
      add(item.id)
      query = ''
    }
  }
</script>

<div class="picker">
  <div class="head">
    <h3>{strings.dishes.ingredientsTitle}</h3>
    <p>{strings.dishes.ingredientsHint}</p>
  </div>

  {#if chosenItems.length === 0}
    <p class="none">{strings.dishes.ingredientsEmpty}</p>
  {:else}
    <div class="rows">
      {#each chosenItems as item (item.id)}
        <ItemTile
          name={item.name}
          icon={item.icon}
          emoji={item.emoji}
          layout="row"
          state="list"
          onclick={() => remove(item.id)}
        />
      {/each}
    </div>
    <p class="hint">{strings.dishes.removeIngredient}</p>
  {/if}

  <form class="search" onsubmit={submitNew}>
    <input
      type="search"
      bind:value={query}
      placeholder={strings.dishes.ingredientSearch}
      aria-label={strings.dishes.ingredientSearch}
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      enterkeyhint="done"
    />
    {#if canAddNew}
      <button type="submit" class="add" disabled={creating}>{strings.shopping.addNewWord}</button>
    {/if}
  </form>

  <h4>{searching ? strings.shopping.searchResults : strings.dishes.ingredientSuggestions}</h4>

  {#if results.length === 0}
    <p class="none">
      {searching ? strings.shopping.noResults : strings.dishes.ingredientNone}
    </p>
  {:else}
    <div class="results">
      {#each results as item (item.id)}
        <ItemTile
          name={item.name}
          icon={item.icon}
          emoji={item.emoji}
          state="pick"
          onclick={() => add(item.id)}
        />
      {/each}
    </div>
  {/if}

  <!-- The whole catalogue, collapsed, for when you don't know the word.
       --tile-columns is forced to 1 below: CategorySection lays its tiles out on
       that variable, and in here everything is a row. -->
  {#if categories.length > 0}
    <div class="categories">
      {#each categories as name (name)}
        <CategorySection
          {name}
          icon={categoryIcon(name)}
          items={categoryPicks(available, name)}
          open={openCategories.has(name)}
          onToggle={() => toggleCategory(name)}
          onAdd={add}
          layout="row"
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /*
    Stuck to the top of the sheet as it scrolls, so the one control that shortens
    a 500-item catalogue is always in reach.

    The exact mirror of `.actions` in DishSheet.svelte, negative margins and all,
    and for the same reason that file spells out: the sheet is the scrolling
    element *and* it has padding, so a plain `top: 0` would stick 16px down and
    leave a strip of that padding for content to show through as it scrolls past.
    Pulling out to the sheet's own edges and sticking at -16px puts the opaque
    background exactly where the gap would be.
  */
  .search {
    position: sticky;
    top: calc(var(--space-4) * -1);
    z-index: 1;
    margin: 0 calc(var(--space-4) * -1);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
  }

  /*
    Four across, rows sized to the tallest tile so a two-line name can't leave
    its neighbours short — the same rule as the shopping grid.

    It used to be capped at 15rem with its own scrollbar, so that the sheet's
    buttons stayed reachable past a long result list. That cap is gone: a scroll
    area inside a scrolling sheet is a bad thing to hand someone on a phone, and
    the sticky search box above solves the problem the cap was there for — you
    can always get back to the field that shortens the list.
  */
  .results {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-2);
    grid-auto-rows: 1fr;
    align-items: stretch;
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  h3 {
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  h4 {
    margin-top: var(--space-2);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  p {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .hint,
  .none {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .categories {
    --tile-columns: 1;
    display: flex;
    flex-direction: column;
    margin-top: var(--space-2);
  }

  .categories :global(.grid) {
    gap: var(--space-1);
  }

  form {
    display: flex;
    gap: var(--space-2);
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
    /* 16px floor stops Android zooming in on focus. */
    font-size: var(--text-base);
  }

  input::placeholder {
    color: var(--color-text-faint);
  }

  .add {
    flex: none;
    min-height: var(--tap-min);
    padding: 0 var(--space-5);
    border-radius: var(--radius-full);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: var(--weight-medium);
  }

  .add:disabled {
    opacity: 0.45;
  }
</style>
