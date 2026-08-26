<!--
  The shopping list, and the picker you add from — on one screen.

  There is no "Add items" button any more. The catalogue lives directly under the
  list, the way Bring! does it, so adding is never a trip to another screen and
  back: you can see what's on the list while you tap the next thing onto it.

  Reading down the screen:
    1. what you still need
    2. what's in the trolley
    3. the tiles worth tapping first — this household's own habits, falling back
       to a hand-picked "typical stuff" order before it has learned any
    4. every category, collapsed
    5. the search field, pinned above the nav where a thumb reaches

  Search takes over 3 and 4 while there's a query: matches replace the
  suggestions and the categories fold away, since scrolling past ten headers to
  reach a result you already named would be silly.
-->
<script lang="ts">
  import { flip } from 'svelte/animate'
  import CategorySection from '../components/CategorySection.svelte'
  import EmptyBasket from '../components/EmptyBasket.svelte'
  import ItemDetailSheet from '../components/ItemDetailSheet.svelte'
  import ItemTile from '../components/ItemTile.svelte'
  import Placeholder from '../components/Placeholder.svelte'
  import { auth } from '../lib/auth.svelte'
  import { isConfigured } from '../lib/config'
  import { categoryIcon } from '../lib/catalogue-seed'
  import {
    type DisplayItem,
    type PickerItem,
    categoriesInOrder,
    categoryPicks,
    floatUrgent,
    matchesSearch,
    sortItems,
    splitByChecked,
    suggestedPicks,
  } from '../lib/list-view'
  import { FLIP_MS, tileIn, tileOut } from '../lib/motion'
  import {
    addNewWord,
    addToList,
    clearChecked,
    hideCatalogueItem,
    removeFromList,
    shopping,
    toggleChecked,
    updateItem,
  } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let openItemId = $state<string | null>(null)
  let query = $state('')
  let openCategories = $state<Set<string>>(new Set())
  let pendingHide = $state<PickerItem | null>(null)

  // Items the other person added in the last half-day carry the NEW tag (§4.1).
  // Your own additions aren't news to you.
  const NEW_WINDOW_MS = 12 * 60 * 60 * 1000

  let catalogueById = $derived(new Map(shopping.catalogue.map((item) => [item.id, item])))

  /* ---- The list ---------------------------------------------------------- */

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
  let toBuy = $derived(floatUrgent(sortItems(split.toBuy, 'shop-order')))
  let inTrolley = $derived(split.inTrolley)
  let openItem = $derived(display.find((item) => item.id === openItemId) ?? null)

  /* ---- The picker -------------------------------------------------------- */

  let pickerItems = $derived.by<PickerItem[]>(() =>
    shopping.visibleCatalogue.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      icon: item.icon,
      sortOrder: item.sortOrder,
      suggestedRank: item.suggestedRank,
      useCount: shopping.useCounts[item.id] ?? 0,
    })),
  )

  let trimmed = $derived(query.trim())
  let searching = $derived(trimmed !== '')

  let matches = $derived(
    searching
      ? pickerItems
          .filter((item) => matchesSearch(item.name, trimmed) && !shopping.onList.has(item.id))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .slice(0, 24)
      : [],
  )

  let suggestions = $derived(searching ? [] : suggestedPicks(pickerItems, shopping.onList))
  let categories = $derived(searching ? [] : categoriesInOrder(pickerItems))

  // Offer to create a word only when nothing in the catalogue is an exact match
  // — typing "mil" while "milk" exists shouldn't invite a duplicate.
  let canAddNew = $derived(
    searching &&
      !shopping.catalogue.some(
        (item) => item.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
      ),
  )

  /* ---- Actions ----------------------------------------------------------- */

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

  function submitNew(event: Event) {
    event.preventDefault()
    if (!canAddNew || !auth.userId) return
    void addNewWord(trimmed, auth.userId)
    query = ''
  }

  function handleToggle(itemId: string) {
    if (auth.userId) void toggleChecked(itemId, auth.userId)
  }

  function toggleCategory(name: string) {
    const next = new Set(openCategories)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    openCategories = next
  }

  function confirmHide() {
    const item = pendingHide
    pendingHide = null
    if (item && auth.userId) void hideCatalogueItem(item.id, auth.userId)
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

    <!-- 1. Still to buy -->
    {#if display.length === 0}
      <div class="empty">
        <EmptyBasket />
        <h2>{strings.shopping.emptyTitle}</h2>
        <p>{strings.shopping.emptyBlurb}</p>
      </div>
    {:else if toBuy.length > 0}
      <section class="block">
        <h2 class="heading">
          {strings.shopping.toBuy}<span class="count">{toBuy.length}</span>
        </h2>
        <div class="grid">
          {#each toBuy as item (item.id)}
            <div animate:flip={{ duration: FLIP_MS }} in:tileIn out:tileOut>
              <ItemTile
                name={item.name}
                icon={item.icon}
                state="list"
                urgent={item.urgent}
                isNew={isNew(item)}
                detail={detailFor(item)}
                onclick={() => handleToggle(item.id)}
                onlongpress={() => (openItemId = item.id)}
              />
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- 2. In the trolley -->
    {#if inTrolley.length > 0}
      <section class="block">
        <h2 class="heading">
          {strings.shopping.inTrolley}<span class="count">{inTrolley.length}</span>
          <button class="clear" onclick={() => clearChecked()}>
            {strings.shopping.clearTrolley}
          </button>
        </h2>
        <div class="grid">
          {#each inTrolley as item (item.id)}
            <div animate:flip={{ duration: FLIP_MS }} in:tileIn out:tileOut>
              <ItemTile
                name={item.name}
                icon={item.icon}
                state="checked"
                detail={detailFor(item)}
                onclick={() => handleToggle(item.id)}
                onlongpress={() => (openItemId = item.id)}
              />
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- 3. Search matches, or the tiles worth tapping first -->
    {#if searching}
      <section class="block picker">
        <h2 class="heading">{strings.shopping.searchResults}</h2>
        {#if matches.length === 0}
          <p class="none">{strings.shopping.noResults}</p>
        {:else}
          <div class="grid">
            {#each matches as item (item.id)}
              <div animate:flip={{ duration: FLIP_MS }} in:tileIn out:tileOut>
                <ItemTile
                  name={item.name}
                  icon={item.icon}
                  state="pick"
                  onclick={() => handleAdd(item.id)}
                  onlongpress={() => (pendingHide = item)}
                />
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {:else}
      {#if suggestions.length > 0}
        <section class="block picker">
          <h2 class="heading">{strings.shopping.recentlyUsed}</h2>
          <div class="grid">
            {#each suggestions as item (item.id)}
              <div animate:flip={{ duration: FLIP_MS }} in:tileIn out:tileOut>
                <ItemTile
                  name={item.name}
                  icon={item.icon}
                  state="pick"
                  onclick={() => handleAdd(item.id)}
                  onlongpress={() => (pendingHide = item)}
                />
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- 4. Every category, collapsed -->
      <section class="categories">
        {#each categories as name (name)}
          <CategorySection
            {name}
            icon={categoryIcon(name)}
            items={categoryPicks(pickerItems, name).filter(
              (item) => !shopping.onList.has(item.id),
            )}
            open={openCategories.has(name)}
            onToggle={() => toggleCategory(name)}
            onAdd={handleAdd}
            onHide={(item) => (pendingHide = item)}
          />
        {/each}
      </section>
    {/if}
  </div>

  <!-- 5. Search, pinned above the nav -->
  <form class="search" onsubmit={submitNew}>
    <input
      type="search"
      bind:value={query}
      placeholder={strings.shopping.searchPlaceholder}
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      enterkeyhint="done"
      aria-label={strings.shopping.searchPlaceholder}
    />
    {#if canAddNew}
      <button type="submit" class="add">{strings.shopping.addNewWord}</button>
    {/if}
  </form>

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

  {#if pendingHide}
    <div class="backdrop" role="presentation" onclick={() => (pendingHide = null)}></div>
    <div class="confirm" role="dialog" aria-modal="true" aria-label={strings.shopping.hideTitle}>
      <h2>{strings.shopping.hideTitle}</h2>
      <p><strong>{pendingHide.name}</strong> — {strings.shopping.hideBody}</p>
      <div class="actions">
        <button class="keep" onclick={() => (pendingHide = null)}>
          {strings.shopping.hideCancel}
        </button>
        <button class="destroy" onclick={confirmHide}>{strings.shopping.hideConfirm}</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-4);
    /* Clear of the pinned search field so the last row is never behind it. */
    padding-bottom: calc(var(--space-8) + var(--tap-min));
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .heading {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .count {
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .clear {
    margin-left: auto;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    text-transform: none;
    letter-spacing: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.75rem, 1fr));
    gap: var(--space-2);
    /* Rows size to the tallest tile in them, and each tile fills its cell, so a
       two-line name can't leave its neighbours short. */
    grid-auto-rows: 1fr;
    align-items: stretch;
  }

  /* The picker sits visually below the list, so it gets a rule above it. */
  .picker {
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .categories {
    display: flex;
    flex-direction: column;
  }

  .none {
    padding: var(--space-4) 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-4) var(--space-4);
    text-align: center;
  }

  .empty h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  .empty p {
    max-width: 18rem;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  /* ---- Search, pinned above the bottom nav ------------------------------ */

  .search {
    position: fixed;
    right: 0;
    bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
    left: 0;
    z-index: calc(var(--z-nav) - 1);
    display: flex;
    gap: var(--space-2);
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
  }

  input {
    flex: 1;
    min-width: 0;
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    /* 16px floor, or Android zooms the page when the field takes focus. */
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

  /* ---- Remove-for-good confirmation ------------------------------------- */

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-sheet);
    background: var(--color-overlay);
  }

  .confirm {
    position: fixed;
    inset: auto 0 0 0;
    z-index: var(--z-sheet);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--space-5) var(--space-4);
    padding-bottom: calc(var(--space-5) + env(safe-area-inset-bottom, 0px));
    background: var(--color-surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-2);
  }

  .confirm h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  .confirm p {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .actions {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }

  .keep,
  .destroy {
    flex: 1;
    min-height: var(--tap-min);
    border-radius: var(--radius-full);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .keep {
    border: 1px solid var(--color-border-strong);
    color: var(--color-text);
  }

  .destroy {
    background: var(--color-danger);
    color: var(--color-accent-ink);
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
