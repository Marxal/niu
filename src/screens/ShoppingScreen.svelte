<!--
  The shopping list, and the picker you add from — on one screen.

  There is no "Add items" button any more. The catalogue lives directly under the
  list, the way Bring! does it, so adding is never a trip to another screen and
  back: you can see what's on the list while you tap the next thing onto it.

  Reading down the screen:
    1. which shop you're in, once there is more than one
    2. what you still need, in the order this shop is walked
    3. what's in the trolley
    4. "you usually need…", when something looks due
    5. the tiles worth tapping first — this household's own habits, falling back
       to a hand-picked "typical stuff" order before it has learned any
    6. every category, collapsed — Dishes first, then the catalogue's own
    7. the search field, pinned above the nav where a thumb reaches

  Search takes over 4, 5 and 6 while there's a query: matches replace the
  suggestions and the categories fold away, since scrolling past ten headers to
  reach a result you already named would be silly. Dishes are searched too, in
  their own block, because tapping one does something different from tapping a
  grocery — it adds several things at once rather than one.
-->
<script lang="ts">
  import { flip } from 'svelte/animate'
  import { slide } from 'svelte/transition'
  import CategorySection from '../components/CategorySection.svelte'
  import EmptyBasket from '../components/EmptyBasket.svelte'
  import Flash from '../components/Flash.svelte'
  import ItemDetailSheet from '../components/ItemDetailSheet.svelte'
  import ItemTile from '../components/ItemTile.svelte'
  import Placeholder from '../components/Placeholder.svelte'
  import { auth } from '../lib/auth.svelte'
  import { isConfigured } from '../lib/config'
  import { categoryIcon } from '../lib/catalogue-seed'
  import {
    type DisplayItem,
    type PickerItem,
    byPriority,
    categoriesInOrder,
    categoryPicks,
    matchesSearch,
    sortByTimesBought,
    sortItems,
    splitByChecked,
    suggestedPicks,
  } from '../lib/list-view'
  import ShoppingDone from '../components/ShoppingDone.svelte'
  import ShopPicker from '../components/ShopPicker.svelte'
  import SuggestionStrip from '../components/SuggestionStrip.svelte'
  import DishPickerSheet from '../components/DishPickerSheet.svelte'
  import DishSheet from '../components/DishSheet.svelte'
  import { dishBadges, dishPicks, filterDishes } from '../lib/dishes'
  import { addDishToList, addItemToDish, dishes } from '../lib/dishes.svelte'
  import { learning, loadLearning } from '../lib/learning.svelte'
  import { chooseShop, shops } from '../lib/shops.svelte'
  import { sortByLearnedOrder } from '../lib/shop-order'
  import { dueNow } from '../lib/suggest'
  import CategoryPickerSheet from '../components/CategoryPickerSheet.svelte'
  import IconPickerSheet from '../components/IconPickerSheet.svelte'
  import TrolleyIcon from '../components/TrolleyIcon.svelte'
  import { FLIP_MS, tileIn, tileOut } from '../lib/motion'
  import { prefs } from '../lib/prefs.svelte'
  import {
    addNewWord,
    addToList,
    clearChecked,
    clearItemCategory,
    clearItemIcon,
    hideCatalogueItem,
    setItemCategory,
    setItemIcon,
    removeFromList,
    shopping,
    toggleChecked,
    updateItem,
  } from '../lib/shopping.svelte'
  import { setNavHidden } from '../lib/shell.svelte'
  import { strings } from '../lib/strings'

  let openItemId = $state<string | null>(null)
  let query = $state('')
  let openCategories = $state<Set<string>>(new Set())
  // The long-press menu, and the two things it can lead to.
  let tileMenu = $state<PickerItem | null>(null)
  let pendingHide = $state<PickerItem | null>(null)
  let pendingIcon = $state<PickerItem | null>(null)
  let pendingCategory = $state<PickerItem | null>(null)
  // Filing a tile into a dish: first which tile, then — if they want a new dish
  // rather than an existing one — the editor, seeded with it.
  let pendingDish = $state<PickerItem | null>(null)
  let newDishFrom = $state<PickerItem | null>(null)
  let celebrating = $state(false)
  // What just happened after tapping a dish. See Flash.svelte for why it exists.
  let flash = $state<{ text: string; tone: 'good' | 'bad' } | null>(null)

  let layout = $derived(prefs.viewMode === 'list' ? ('row' as const) : ('tile' as const))

  // Items the other person added in the last half-day carry the NEW tag (§4.1).
  // Your own additions aren't news to you.
  const NEW_WINDOW_MS = 12 * 60 * 60 * 1000

  // The store's map, not one built from `shopping.catalogue`: that raw array is
  // the only copy without hand-picked icons applied to it.
  let catalogueById = $derived(shopping.byId)

  /*
   * Which dishes asked for each row on the list, ready to draw. Empty for every
   * row on a list nobody built from a dish, which is most of them — the map is
   * only ever as big as the number of tagged rows.
   */
  let badges = $derived(dishBadges(shopping.itemDishes, dishes.all, dishes.tags))

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
          emoji: source.emoji,
          sortOrder: source.sortOrder,
          quantity: item.quantity,
          note: item.note,
          urgent: item.urgent,
          ifConvenient: item.ifConvenient,
          checkedAt: item.checkedAt,
          addedAt: item.addedAt,
          addedBy: item.addedBy,
        },
      ]
    }),
  )

  let split = $derived(splitByChecked(display))

  /*
   * The order of the still-to-buy list, in two steps that must stay in this
   * order: sort it however the preference asks, then let the two priority tags
   * move things. Urgent has to beat the aisle order — that is the entire point
   * of marking something urgent — so it is applied last and wins.
   */
  let ordered = $derived.by<DisplayItem[]>(() => {
    switch (prefs.sortMode) {
      case 'recent':
        return sortItems(split.toBuy, 'recent')
      case 'category':
        return sortItems(split.toBuy, 'catalogue')
      case 'most-bought':
        return sortByTimesBought(split.toBuy, learning.stats)
      case 'shop-order':
        // Falls back to the catalogue order on its own until this shop has
        // learned something — see shop-order.ts.
        return sortByLearnedOrder(split.toBuy, learning.aisle)
    }
  })

  let toBuy = $derived(byPriority(ordered))
  let inTrolley = $derived(split.inTrolley)
  let openItem = $derived(display.find((item) => item.id === openItemId) ?? null)

  /*
   * The end of a shop, wherever it was pressed.
   *
   * This watches the list rather than the button, which is the point: the
   * trolley emptying arrives on the other phone as a realtime delete, so
   * whoever is still standing in the shop gets the same moment as whoever
   * pressed Shopping done. It also means the celebration can never fire on a
   * screen that hasn't finished loading — a list that was empty a tick ago was
   * not a shop that just ended.
   *
   * Requiring the trolley to have had something in it is what stops "removed
   * the last thing I didn't want after all" reading as a finished shop.
   */
  let hadInTrolley = false
  let hadAnything = false

  $effect(() => {
    const total = display.length
    const trolley = inTrolley.length

    if (hadAnything && hadInTrolley && total === 0) celebrating = true

    hadAnything = total > 0
    hadInTrolley = trolley > 0
  })

  /* ---- The picker -------------------------------------------------------- */

  let pickerItems = $derived(shopping.picker)

  /*
   * The dishes, as tiles. "Dishes appear in the catalogue as their own
   * category. Tapping a dish adds all its items to the list at once" (§4.1) —
   * so they are drawn by the same CategorySection as everything else, and the
   * only thing that differs is what a tap does.
   *
   * Unlike a grocery tile, a dish tile is never taken out of the grid for being
   * "already on the list": a dish is not on the list, its ingredients are, and
   * half of them being there is a perfectly good reason to tap it again.
   */
  let dishTiles = $derived(dishPicks(dishes.all, strings.dishes.categoryName))

  let trimmed = $derived(query.trim())
  let searching = $derived(trimmed !== '')

  /**
   * The bottom nav gets out of the way while a search is running.
   *
   * The cleanup is the load-bearing half: leave the tab with a query still in
   * the field and the nav has to come back, or the app has no way out of the
   * shopping list. See shell.svelte.ts.
   */
  $effect(() => {
    setNavHidden(searching)
    return () => setNavHidden(false)
  })

  let matches = $derived(
    searching
      ? pickerItems
          .filter((item) => matchesSearch(item.name, trimmed) && !shopping.onList.has(item.id))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .slice(0, 24)
      : [],
  )

  let dishMatches = $derived(
    searching ? dishPicks(filterDishes(dishes.all, trimmed), strings.dishes.categoryName) : [],
  )

  let suggestions = $derived(searching ? [] : suggestedPicks(pickerItems, shopping.onList))

  // "You usually need…" — only what looks due, and only when there is something
  // to say. Empty for a household with no history, which is most of them at
  // first. `Date.now()` is read here rather than inside the rule so the rule
  // stays testable at a fixed moment.
  let due = $derived(
    searching ? [] : dueNow(pickerItems, learning.stats, shopping.onList, Date.now()),
  )
  let categories = $derived(searching ? [] : categoriesInOrder(pickerItems))

  /**
   * Every category this household's catalogue actually uses, for the "move it
   * somewhere else" sheet.
   *
   * Off the *whole* picker rather than off `categories` above, which is empty
   * while searching and which hides a category whose items are all on the list
   * already — neither of which should shrink the list of places you can file
   * something.
   */
  let allCategories = $derived(categoriesInOrder(shopping.picker))

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

  function handleAdd(catalogueItemId: string) {
    if (auth.userId) void addToList(catalogueItemId, auth.userId)
  }

  /**
   * Tapping a dish. The database works out which of its ingredients are already
   * on the list and returns how many rows it actually added, so the message
   * afterwards is the truth rather than this screen's guess.
   *
   * A dish with no ingredients never makes the trip: there is nothing to add,
   * and the honest answer is a nudge towards writing some down.
   */
  async function handleAddDish(dishId: string) {
    const dish = dishes.byId.get(dishId)
    if (!dish) return

    if (dish.itemIds.length === 0) {
      flash = { text: strings.dishes.flashNoItems, tone: 'good' }
      return
    }

    const added = await addDishToList(dishId)

    if (added === null) flash = { text: strings.dishes.addFailed, tone: 'bad' }
    else if (added === 0) flash = { text: strings.dishes.flashAllThere, tone: 'good' }
    else flash = { text: strings.dishes.flashAdded(added), tone: 'good' }
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

  function choosePick(item: PickerItem) {
    // Long press opens a menu rather than one action, because there are two
    // things you might want and neither should happen by accident.
    tileMenu = item
  }

  /**
   * Files the long-pressed tile into a dish. The flash is the confirmation:
   * nothing on this screen changes, because a dish's ingredient list is not
   * something the shopping tab shows.
   */
  async function fileInDish(dishId: string) {
    const item = pendingDish
    pendingDish = null
    if (!item) return

    const dish = dishes.byId.get(dishId)
    const ok = await addItemToDish(dishId, item.id)

    flash = ok
      ? { text: strings.dishes.addedTo(dish?.name ?? ''), tone: 'good' }
      : { text: strings.dishes.saveFailed, tone: 'bad' }
  }

  function applyIcon(icon: string) {
    const item = pendingIcon
    pendingIcon = null
    if (item && auth.userId) void setItemIcon(item.id, icon, auth.userId)
  }

  function resetIcon() {
    const item = pendingIcon
    pendingIcon = null
    if (item) void clearItemIcon(item.id)
  }

  function applyCategory(category: string) {
    const item = pendingCategory
    pendingCategory = null
    if (item && auth.userId) void setItemCategory(item.id, category, auth.userId)
  }

  function resetCategory() {
    const item = pendingCategory
    pendingCategory = null
    if (item) void clearItemCategory(item.id)
  }

  /**
   * Emptying the trolley is the end of a shop, so this is where the app learns.
   *
   * The database does both halves in one transaction — work out where in this
   * shop each thing was picked up, then delete the ticked rows — because a
   * trolley emptied without the learning throws away the only record of the
   * order it was filled in, and there is no second chance at it.
   */
  async function finishShopping() {
    const recorded = await clearChecked(shops.currentId)
    // Pick up what was just learned, so the next list is already sorted by it.
    if (recorded) void loadLearning(shops.currentId)
  }
</script>

{#if !isConfigured}
  <Placeholder
    name="shopping"
    heading={strings.screens.shopping.heading}
    blurb={strings.screens.shopping.blurb}
  />
{:else}
  <div class="screen {prefs.viewMode}">
    {#if shopping.error}
      <p class="error" role="alert">{shopping.error}</p>
    {/if}

    <!-- 1. Which shop. Hides itself while there is only one. -->
    <ShopPicker shops={shops.all} currentId={shops.currentId} onChoose={chooseShop} />

    <!-- 2. Still to buy -->
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
                emoji={item.emoji}
                {layout}
                state="list"
                urgent={item.urgent}
                ifConvenient={item.ifConvenient}
                isNew={isNew(item)}
                quantity={item.quantity}
                note={item.note}
                badges={badges.get(item.id) ?? []}
                onclick={() => handleToggle(item.id)}
                onlongpress={() => (openItemId = item.id)}
              />
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- 3. In the trolley — deliberately boxed and faded, because it is a
         holding pen for this shop only, not part of the list proper. -->
    {#if inTrolley.length > 0}
      <section class="trolley" transition:slide={{ duration: 200 }}>
        <h2 class="heading trolley-heading">
          <TrolleyIcon />
          {strings.shopping.inTrolley}<span class="count">{inTrolley.length}</span>
        </h2>

        <div class="grid">
          {#each inTrolley as item (item.id)}
            <div animate:flip={{ duration: FLIP_MS }} in:tileIn out:tileOut>
              <ItemTile
                name={item.name}
                icon={item.icon}
                emoji={item.emoji}
                {layout}
                state="checked"
                quantity={item.quantity}
                note={item.note}
                badges={badges.get(item.id) ?? []}
                onclick={() => handleToggle(item.id)}
                onlongpress={() => (openItemId = item.id)}
              />
            </div>
          {/each}
        </div>

        <p class="trolley-note">{strings.shopping.trolleyNote}</p>

        <!-- Only once nothing is left to buy does this become "you're done" —
             before that, emptying the trolley mid-shop would be a mistake. -->
        {#if toBuy.length === 0}
          <button class="done-btn" onclick={finishShopping}>
            <TrolleyIcon size={22} />
            {strings.shopping.shoppingDone}
          </button>
          <p class="trolley-note">{strings.shopping.shoppingDoneHint}</p>
        {:else}
          <button class="clear-btn" onclick={finishShopping}>
            {strings.shopping.clearTrolley}
          </button>
        {/if}
      </section>
    {/if}

    <!-- 4. What looks due. Silent until the app has something to go on. -->
    <SuggestionStrip items={due} {layout} onAdd={handleAdd} />

    <!-- 5. The tiles worth tapping first. While a search is running these fold
         away entirely and the matches appear in the dock, right above the
         keyboard — see the note there. -->
    {#if !searching}
      {#if suggestions.length > 0}
        <section class="block picker">
          <h2 class="heading">{strings.shopping.recentlyUsed}</h2>
          <div class="grid">
            {#each suggestions as item (item.id)}
              <div animate:flip={{ duration: FLIP_MS }} in:tileIn out:tileOut>
                <ItemTile
                  name={item.name}
                  icon={item.icon}
                  emoji={item.emoji}
                  {layout}
                  state="pick"
                  onclick={() => handleAdd(item.id)}
                  onlongpress={() => choosePick(item)}
                />
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- 6. Every category, collapsed. Dishes lead: they are this household's
           own, they add several things at once, and they are the only tiles here
           nobody else's catalogue could contain. -->
      <section class="categories">
        {#if dishTiles.length > 0}
          <CategorySection
            name={strings.dishes.categoryName}
            icon="pot"
            items={dishTiles}
            open={openCategories.has(strings.dishes.categoryName)}
            onToggle={() => toggleCategory(strings.dishes.categoryName)}
            onAdd={(id) => void handleAddDish(id)}
            {layout}
          />
        {/if}

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
            onHide={choosePick}
            {layout}
          />
        {/each}
      </section>
    {/if}
  </div>

  <!-- 6. The dock: the matches, then the field, pinned together at the bottom.

       Marçal, round 14: *"when typing, it should show the matches right above the
       keyboard — now the user needs to scroll to find the items they're typing."*
       He was right, and the reason is that the field was fixed to the bottom while
       the results were a section of a page that scrolls independently of it. Type
       "milk" with the list half a screen long and the one tile you asked for is
       somewhere above the fold.

       So the two are now one fixed stack. The results sit directly on the field,
       which sits directly on the keyboard, and the list carries on behind — which
       is the point of this screen and the reason the results are a panel rather
       than a takeover.

       The bottom nav goes away while this is up (shell.svelte.ts): 64px is a whole
       extra row of tiles, and nobody changes tab in the middle of typing. -->
  <div class="dock" class:searching>
    {#if searching}
      <div class="results">
        <div class="results-scroll">
          {#if dishMatches.length > 0}
            <section class="block picker">
              <h2 class="heading">{strings.dishes.title}</h2>
              <div class="grid">
                {#each dishMatches as dish (dish.id)}
                  <div animate:flip={{ duration: FLIP_MS }} in:tileIn out:tileOut>
                    <ItemTile
                      name={dish.name}
                      icon={dish.icon}
                      {layout}
                      state="pick"
                      onclick={() => void handleAddDish(dish.id)}
                    />
                  </div>
                {/each}
              </div>
            </section>
          {/if}

          <section class="block picker">
            {#if matches.length === 0}
              <p class="none">{strings.shopping.noResults}</p>
            {:else}
              <h2 class="heading">{strings.shopping.searchResults}</h2>
              <div class="grid">
                {#each matches as item (item.id)}
                  <div animate:flip={{ duration: FLIP_MS }} in:tileIn out:tileOut>
                    <ItemTile
                      name={item.name}
                      icon={item.icon}
                      emoji={item.emoji}
                      {layout}
                      state="pick"
                      onclick={() => handleAdd(item.id)}
                      onlongpress={() => choosePick(item)}
                    />
                  </div>
                {/each}
              </div>
            {/if}
          </section>
        </div>
      </div>
    {/if}

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
  </div>

  {#if celebrating}
    <ShoppingDone onDone={() => (celebrating = false)} />
  {/if}

  {#if flash}
    <!-- Keyed on the message object so a second tap restarts the countdown
         rather than inheriting the first one's remaining time. -->
    {@const shown = flash}
    {#key shown}
      <Flash message={shown.text} tone={shown.tone} onDone={() => (flash = null)} />
    {/key}
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

  {#if tileMenu}
    <div class="backdrop" role="presentation" onclick={() => (tileMenu = null)}></div>
    <div class="confirm" role="dialog" aria-modal="true" aria-label={strings.shopping.tileMenuTitle}>
      <h2>{tileMenu.name}</h2>
      <div class="menu">
        <button
          class="menu-item"
          onclick={() => {
            pendingDish = tileMenu
            tileMenu = null
          }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 11h16v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-4Z" />
            <path d="M3 11h18" />
            <path d="m9 7 1.5-2M14 7l1.5-2" />
          </svg>
          {strings.shopping.addToDish}
        </button>
        <button
          class="menu-item"
          onclick={() => {
            pendingIcon = tileMenu
            tileMenu = null
          }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="m4 17 5-4 4 3 3-2 4 3" />
          </svg>
          {strings.shopping.changeIcon}
        </button>
        <button
          class="menu-item"
          onclick={() => {
            pendingCategory = tileMenu
            tileMenu = null
          }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
          </svg>
          {strings.shopping.changeCategory}
        </button>
        <button
          class="menu-item danger"
          onclick={() => {
            pendingHide = tileMenu
            tileMenu = null
          }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 3l18 18" />
            <path d="M10.6 5.2A9 9 0 0 1 12 5c5 0 9 5 9 7a11 11 0 0 1-2.2 3.2M6.5 6.7C4.3 8.2 3 10.4 3 12c0 2 4 7 9 7a9.6 9.6 0 0 0 4.2-1" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </svg>
          {strings.shopping.hideConfirm}
        </button>
      </div>
    </div>
  {/if}

  {#if pendingCategory}
    {#key pendingCategory.id}
      <CategoryPickerSheet
        itemName={pendingCategory.name}
        current={pendingCategory.category}
        categories={allCategories}
        isOverridden={pendingCategory.id in shopping.categoryOverrides}
        onPick={applyCategory}
        onReset={resetCategory}
        onClose={() => (pendingCategory = null)}
      />
    {/key}
  {/if}

  {#if pendingIcon}
    {#key pendingIcon.id}
      <IconPickerSheet
        name={pendingIcon.name}
        current={pendingIcon.icon}
        onPick={applyIcon}
        onReset={resetIcon}
        onClose={() => (pendingIcon = null)}
      />
    {/key}
  {/if}

  {#if pendingDish}
    {@const item = pendingDish}
    <DishPickerSheet
      itemName={item.name}
      onPick={(dishId) => void fileInDish(dishId)}
      onNew={() => {
        newDishFrom = item
        pendingDish = null
      }}
      onClose={() => (pendingDish = null)}
    />
  {/if}

  {#if newDishFrom}
    <DishSheet
      dish={null}
      userId={auth.userId}
      seedItemIds={[newDishFrom.id]}
      onClose={() => (newDishFrom = null)}
    />
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

  /* The three view modes. Four across is the default; three gives bigger
     targets on a small phone; list is one full-width row each. */
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--tile-columns, 4), minmax(0, 1fr));
    gap: var(--space-2);
    /* Rows size to the tallest tile in them, and each tile fills its cell, so a
       two-line name can't leave its neighbours short. */
    grid-auto-rows: 1fr;
    align-items: stretch;
  }

  .screen.grid-4 {
    --tile-columns: 4;
  }

  .screen.grid-3 {
    --tile-columns: 3;
  }

  .screen.list .grid,
  .screen.list :global(.grid) {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
    gap: var(--space-1);
  }

  /* ---- The trolley ------------------------------------------------------- */

  .trolley {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px dashed var(--color-done-border);
    border-radius: var(--radius-lg);
    background: var(--color-done-soft);
  }

  .trolley-heading {
    color: var(--color-done);
  }

  .trolley-note {
    color: var(--color-done);
    font-size: var(--text-xs);
    opacity: 0.85;
    text-align: center;
  }

  .done-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--tap-min);
    border-radius: var(--radius-full);
    background: var(--color-pick);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
    box-shadow: var(--shadow-1);
  }

  .done-btn:active {
    transform: scale(0.98);
  }

  .clear-btn {
    align-self: center;
    min-height: 2.25rem;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-done-border);
    border-radius: var(--radius-full);
    color: var(--color-done);
    font-size: var(--text-sm);
  }

  .menu {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .menu-item {
    min-height: var(--tap-min);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-size: var(--text-base);
  }

  .menu-item.danger {
    border-color: var(--color-danger);
    color: var(--color-danger);
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

  /* ---- The dock: matches, then the field -------------------------------- */

  /* One fixed stack, so the results are always exactly one field away from the
     keyboard. The nav is gone while searching, so the dock drops to the very
     bottom and the results get its height as well. */
  .dock {
    position: fixed;
    right: 0;
    bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));
    left: 0;
    z-index: calc(var(--z-nav) - 1);
    display: flex;
    flex-direction: column;
    /* A percentage, not a viewport unit. `interactive-widget=resizes-content`
       shrinks the layout viewport when the keyboard opens, and a percentage on a
       fixed element resolves against exactly that — so the whole dock is capped
       at what is actually left above the keyboard, whatever `vh` decides to
       mean. Without it a long list of matches could push the field itself off
       the bottom of the screen. */
    max-height: 100%;
    max-width: var(--content-max);
    margin-inline: auto;
    pointer-events: none;
  }

  .dock.searching {
    bottom: env(safe-area-inset-bottom, 0px);
  }

  .results {
    pointer-events: auto;
    margin: 0 var(--space-2);
    /* Room for a few rows and no more: the list behind stays visible, which is
       what makes this a panel rather than a takeover. `min-height: 0` is what
       lets it give way first when the dock runs out of room — the field must
       never be the thing that gets squeezed. */
    max-height: 42vh;
    min-height: 0;
    flex: 0 1 auto;
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2);
    overflow: hidden;
  }

  .results-scroll {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-3);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .search {
    flex: none;
    display: flex;
    gap: var(--space-2);
    /* Floating: no bar. The field itself carries the shadow and border. The
       only thing behind it is a short fade to the page colour, so tiles
       dissolve as they pass under instead of being sliced in half — without
       that the transparent field sits on a band of chopped-off rows. */
    padding: var(--space-5) var(--space-4) var(--space-3);
    background: linear-gradient(
      to bottom,
      transparent 0%,
      color-mix(in srgb, var(--color-bg) 70%, transparent) 45%,
      var(--color-bg) 100%
    );
    pointer-events: none;
  }

  /* With the panel above it there is nothing to fade into, and the gradient's
     top padding would only push the field away from the results. */
  .dock.searching .search {
    padding-top: var(--space-2);
    background: none;
  }

  .search > * {
    pointer-events: auto;
  }

  input {
    flex: 1;
    min-width: 0;
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    box-shadow: var(--shadow-2);
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
