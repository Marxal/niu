<!--
  Choosing what a dish is made of, inside the dish editor.

  Same grammar as the shopping screen, on purpose, because it is the same job:
  green rows are things you can tap to add, and the rows above are what you have
  already got. Tapping something you have already added takes it out again —
  exactly like tapping something in the trolley puts it back on the list.

  Rows rather than tiles regardless of the view preference: this lives in a
  sheet, half of which is often covered by the keyboard, and a full-width row is
  both easier to hit and easier to read a long name on.

  Nothing here writes anything. It hands a new array of catalogue ids to its
  parent, and the parent saves the whole dish in one go.
-->
<script lang="ts">
  import ItemTile from './ItemTile.svelte'
  import { type PickerItem, matchesSearch, suggestedPicks } from '../lib/list-view'
  import { shopping } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    chosen,
    onChange,
  }: {
    /** Catalogue item ids currently in the dish. */
    chosen: string[]
    onChange: (ids: string[]) => void
  } = $props()

  /** Enough to scroll through with a thumb; more than that, type. */
  const MAX_RESULTS = 18

  let query = $state('')

  let chosenSet = $derived(new Set(chosen))
  let byId = $derived(new Map(shopping.picker.map((item) => [item.id, item])))

  // In the order they were added, so a row doesn't jump around under the thumb
  // that just tapped it. An id with no catalogue item behind it (hidden for
  // good, or deleted on the other phone) is dropped rather than rendered blank.
  let chosenItems = $derived(
    chosen.flatMap((id) => {
      const item = byId.get(id)
      return item ? [item] : []
    }),
  )

  let trimmed = $derived(query.trim())

  let results = $derived.by<PickerItem[]>(() => {
    const available = shopping.picker.filter((item) => !chosenSet.has(item.id))

    if (trimmed === '') return suggestedPicks(available, chosenSet)

    return available
      .filter((item) => matchesSearch(item.name, trimmed))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, MAX_RESULTS)
  })

  function add(id: string) {
    if (chosenSet.has(id)) return
    onChange([...chosen, id])
  }

  function remove(id: string) {
    onChange(chosen.filter((existing) => existing !== id))
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

  <input
    type="search"
    bind:value={query}
    placeholder={strings.dishes.ingredientSearch}
    aria-label={strings.dishes.ingredientSearch}
    autocomplete="off"
    autocapitalize="none"
    spellcheck="false"
    enterkeyhint="search"
  />

  <h4>{trimmed === '' ? strings.dishes.ingredientSuggestions : strings.shopping.searchResults}</h4>

  {#if results.length === 0}
    <p class="none">{strings.dishes.ingredientNone}</p>
  {:else}
    <div class="rows results">
      {#each results as item (item.id)}
        <ItemTile
          name={item.name}
          icon={item.icon}
          emoji={item.emoji}
          layout="row"
          state="pick"
          onclick={() => add(item.id)}
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

  /* The catalogue is 360 items long. Capped so the buttons at the bottom of the
     sheet stay reachable rather than being pushed off the end of a long list. */
  .results {
    max-height: 15rem;
    overflow-y: auto;
    overscroll-behavior: contain;
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
</style>
