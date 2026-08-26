<!--
  The shopping list.

  Layout follows NIU.md §4.1: one list, always the same, no separate "shopping
  mode". Still-to-buy on top, "in the trolley" underneath. Ticking something
  moves it between the two.

  The catalogue is a sheet rather than a separate tab, because adding is a thing
  you do *to* the list — coming back to a different screen than you left would
  lose your place.
-->
<script lang="ts">
  import CatalogueSheet from '../components/CatalogueSheet.svelte'
  import ItemDetailSheet from '../components/ItemDetailSheet.svelte'
  import ItemTile from '../components/ItemTile.svelte'
  import Placeholder from '../components/Placeholder.svelte'
  import { auth } from '../lib/auth.svelte'
  import {
    type DisplayItem,
    type SortMode,
    floatUrgent,
    sortItems,
    splitByChecked,
  } from '../lib/list-view'
  import {
    addNewWord,
    addToList,
    clearChecked,
    removeFromList,
    shopping,
    toggleChecked,
    updateItem,
  } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'
  import { isConfigured } from '../lib/config'

  let showCatalogue = $state(false)
  let openItemId = $state<string | null>(null)
  let sortMode = $state<SortMode>('shop-order')

  // Something added in the last few minutes gets the NEW tag (§4.1). Only shown
  // for the *other* person's additions — your own aren't news to you.
  const NEW_WINDOW_MS = 12 * 60 * 60 * 1000

  let catalogueById = $derived(new Map(shopping.catalogue.map((item) => [item.id, item])))

  let display = $derived.by<DisplayItem[]>(() =>
    shopping.items.flatMap((item) => {
      const source = catalogueById.get(item.catalogueItemId)
      if (!source) return []
      return [
        {
          id: item.id,
          catalogueItemId: item.catalogueItemId,
          name: source.name,
          category: source.category,
          icon: source.icon,
          sortOrder: source.sortOrder,
          quantity: item.quantity,
          unit: item.unit,
          note: item.note,
          urgent: item.urgent,
          checkedAt: item.checkedAt,
          addedAt: item.addedAt,
          addedBy: item.addedBy,
        },
      ]
    }),
  )

  let split = $derived(splitByChecked(display))
  let toBuy = $derived(floatUrgent(sortItems(split.toBuy, sortMode)))
  let inTrolley = $derived(split.inTrolley)

  let openItem = $derived(display.find((item) => item.id === openItemId) ?? null)

  function isNew(item: DisplayItem): boolean {
    if (item.addedBy === auth.userId) return false
    return Date.now() - new Date(item.addedAt).getTime() < NEW_WINDOW_MS
  }

  function detailFor(item: DisplayItem): string | null {
    const parts: string[] = []
    if (item.quantity !== null) parts.push(`${item.quantity}${item.unit ? ` ${item.unit}` : ''}`)
    else if (item.unit) parts.push(item.unit)
    if (item.note) parts.push(item.note)
    return parts.length ? parts.join(' · ') : null
  }

  function handleAdd(catalogueItemId: string) {
    if (auth.userId) void addToList(catalogueItemId, auth.userId)
  }

  function handleAddNew(name: string) {
    if (auth.userId) void addNewWord(name, auth.userId)
  }

  function handleToggle(itemId: string) {
    if (auth.userId) void toggleChecked(itemId, auth.userId)
  }
</script>

{#if !isConfigured}
  <Placeholder
    name="shopping"
    heading={strings.screens.shopping.heading}
    blurb={strings.screens.shopping.blurb}
  />
{:else}
  <div class="screen">
    {#if shopping.error}
      <p class="error" role="alert">{shopping.error}</p>
    {/if}

    {#if display.length === 0}
      <div class="empty">
        <h2>{strings.shopping.emptyTitle}</h2>
        <p>{strings.shopping.emptyBlurb}</p>
      </div>
    {:else}
      <section class="section">
        <div class="heading">
          <h2>{strings.shopping.toBuy} <span class="count">{toBuy.length}</span></h2>
          <select bind:value={sortMode} aria-label={strings.shopping.sortLabel}>
            <option value="shop-order">{strings.shopping.sortShopOrder}</option>
            <option value="recent">{strings.shopping.sortRecent}</option>
            <option value="category">{strings.shopping.sortCategory}</option>
          </select>
        </div>

        {#if toBuy.length === 0}
          <p class="all-done">{strings.shopping.emptyTitle}</p>
        {:else}
          <div class="grid">
            {#each toBuy as item (item.id)}
              <ItemTile
                name={item.name}
                icon={item.icon}
                urgent={item.urgent}
                isNew={isNew(item)}
                detail={detailFor(item)}
                onclick={() => handleToggle(item.id)}
                onlongpress={() => (openItemId = item.id)}
              />
            {/each}
          </div>
        {/if}
      </section>

      {#if inTrolley.length > 0}
        <section class="section trolley">
          <div class="heading">
            <h2>{strings.shopping.inTrolley} <span class="count">{inTrolley.length}</span></h2>
            <button class="clear" onclick={() => clearChecked()}>
              {strings.shopping.clearTrolley}
            </button>
          </div>
          <div class="grid">
            {#each inTrolley as item (item.id)}
              <ItemTile
                name={item.name}
                icon={item.icon}
                state="checked"
                detail={detailFor(item)}
                onclick={() => handleToggle(item.id)}
              />
            {/each}
          </div>
        </section>
      {/if}
    {/if}

    <button class="browse" onclick={() => (showCatalogue = true)}>
      {strings.shopping.browse}
    </button>
  </div>

  {#if showCatalogue}
    <CatalogueSheet
      catalogue={shopping.catalogue}
      onList={shopping.onList}
      onAdd={handleAdd}
      onAddNew={handleAddNew}
      onClose={() => (showCatalogue = false)}
    />
  {/if}

  {#if openItem}
    <!-- Keyed so opening a different item mounts a fresh sheet: the draft
         fields inside snapshot their item once and never re-sync. -->
    {#key openItem.id}
      <ItemDetailSheet
        item={openItem}
        onChange={(changes) => void updateItem(openItem.id, changes)}
        onRemove={() => {
          void removeFromList(openItem.id)
          openItemId = null
        }}
        onClose={() => (openItemId = null)}
      />
    {/key}
  {/if}
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-4);
    /* Room for the floating Add button so it never covers the last row. */
    padding-bottom: calc(var(--space-8) + var(--tap-min));
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h2 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }

  .count {
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
  }

  select {
    min-height: 2.25rem;
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text-muted);
    font: inherit;
    font-size: var(--text-sm);
  }

  .clear {
    min-height: 2.25rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
    gap: var(--space-2);
  }

  .trolley {
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-8) var(--space-4);
    text-align: center;
  }

  .empty h2 {
    font-size: var(--text-lg);
  }

  .empty p {
    max-width: 20rem;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .all-done {
    padding: var(--space-5);
    color: var(--color-text-faint);
    font-size: var(--text-sm);
    text-align: center;
  }

  .browse {
    position: fixed;
    right: 0;
    bottom: calc(var(--nav-height) + var(--space-4) + env(safe-area-inset-bottom, 0px));
    left: 0;
    z-index: calc(var(--z-nav) - 1);
    width: max-content;
    min-height: var(--tap-min);
    margin-inline: auto;
    padding: 0 var(--space-6);
    border-radius: var(--radius-full);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    box-shadow: var(--shadow-2);
  }

  .browse:active {
    background: var(--color-accent-hover);
  }

  .error {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-danger);
    font-size: var(--text-sm);
    text-align: center;
  }
</style>
