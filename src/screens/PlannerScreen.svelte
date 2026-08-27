<!--
  The Meals tab: a week of meals, and the two doors between it and the shopping
  list.

  ## What it is

  Two views of the same week (§4.2). **Days** is the default and the one you look
  at most — vertically scrolling day cards with room for a name, the cooking
  glyph and a note. **Week** is seven days at once, compact, for seeing the shape
  of the week and for dragging something from Monday to Friday without scrolling.

  The dish *library* used to be this screen. It moved to `#/meals/dishes`, one
  tap away in the header, because the library is the raw material and the plan is
  the thing you actually open the tab for.

  ## Tap to act, hold to move, swipe to remove

  One rule that decides most of the interaction. A long press is the drag
  (drag.svelte.ts), so a tap opens the card's sheet instead, and a clearly
  sideways swipe throws the card away. The copy that follows the finger is
  rendered here, at the root of the screen, because a `position: fixed` element
  inside a day card would be clipped by the scroller.

  A swipe is the one gesture that removes something and can be started by
  accident, so it is the one message in the app that offers an Undo — which
  re-plans the card rather than resurrecting it, because the row is gone.

  ## Both directions

  Plan → shop is the button at the bottom: everything the week needs, previewed,
  then written by add_plan_to_list() in one round trip.

  Shop → plan is "What can we make?" and the top group in the meal picker. Both
  read from plannable.ts, and both are honest about what they know: what is on
  the list right now, and what was bought in the last few days. Neither claims to
  know what is in the cupboards — that is stock inference, and §5 defers it.
-->
<script lang="ts">
  import AtHomeSheet from '../components/AtHomeSheet.svelte'
  import DishSheet from '../components/DishSheet.svelte'
  import EntryPickerSheet from '../components/EntryPickerSheet.svelte'
  import Flash from '../components/Flash.svelte'
  import MakeableSheet from '../components/MakeableSheet.svelte'
  import PlanCard from '../components/PlanCard.svelte'
  import PlanDay from '../components/PlanDay.svelte'
  import PlanEntrySheet from '../components/PlanEntrySheet.svelte'
  import PlanShopSheet from '../components/PlanShopSheet.svelte'
  import PlanWeek from '../components/PlanWeek.svelte'
  import Placeholder from '../components/Placeholder.svelte'
  import { auth } from '../lib/auth.svelte'
  import { isConfigured } from '../lib/config'
  import type { Dish } from '../lib/dishes'
  import { addDishToList, dishes } from '../lib/dishes.svelte'
  import { type DragSlot, drag } from '../lib/drag.svelte'
  import { household } from '../lib/household.svelte'
  import { learning } from '../lib/learning.svelte'
  import {
    type Meal,
    type PlanEntry,
    addDays,
    dayName,
    entriesBetween,
    mealRhythm,
    planningDays,
    shortDate,
    startOfWeek,
    todayKey,
    weekDays,
    weekName,
  } from '../lib/plan'
  import { planNeeds } from '../lib/plan-needs'
  import {
    type PlanOptions,
    type PlanTarget,
    moveEntry,
    plan,
    planEntry,
    setEntryKind,
    setEntryNote,
    setToCook,
    shopForRange,
    showWeek,
    unplanEntry,
  } from '../lib/plan.svelte'
  import { atHomeItems, pantryFrom, rankMakeable } from '../lib/plannable'
  import { hrefFor } from '../lib/router'
  import { addToList, shopping } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  /**
   * Which of the two views. Deliberately component state rather than a stored
   * preference: unlike the shopping list's grid-or-rows, this is a thing you
   * flip a dozen times while planning and then stop thinking about. If it turns
   * out to be sticky in practice it belongs in prefs.svelte.ts.
   */
  let view = $state<'days' | 'week'>('days')

  /** Recomputed on every render rather than stored — a session can cross midnight. */
  let today = $derived(todayKey())

  let days = $derived(weekDays(plan.weekStart))
  /**
   * What the *day* view lists. In the week you are in it starts at today —
   * planning Monday's dinner on Wednesday is not a thing anyone does, and the
   * dead days were two screens of scrolling before the question you opened the
   * app to answer (Marçal, round 10.1). The week view always shows all seven.
   */
  let openDays = $derived(planningDays(plan.weekStart, today))
  let weekEnd = $derived(addDays(plan.weekStart, 6))

  let picking = $state<{ date: string; meal: Meal } | null>(null)
  let opened = $state<PlanEntry | null>(null)
  let shopping_sheet = $state(false)
  let makeable_sheet = $state(false)
  let home_sheet = $state(false)
  let editingDish = $state<Dish | 'new' | null>(null)
  let busy = $state(false)
  let homeBusyId = $state<string | null>(null)

  /**
   * Where a dish written from the picker should land, and how.
   *
   * Held across the dish editor because the whole point of round 10.1's fix is
   * that "+ Add → New dish → Add it" plants the dish on the day you were looking
   * at. Before, it wrote the dish and dropped you back on an empty meal, which
   * looked like the tap had failed.
   */
  let pendingSlot = $state<{ date: string; meal: Meal; options: PlanOptions } | null>(null)

  /** The card this phone just planted, so it can play its arrival once. */
  let freshId = $state<string | null>(null)

  let flash = $state<{
    text: string
    tone: 'good' | 'bad'
    action?: string
    onAction?: () => void
  } | null>(null)

  let thisWeek = $derived(plan.weekStart === startOfWeek(today))

  /** Only the week on screen is drawn, though a wider window is loaded. */
  let weekEntries = $derived(entriesBetween(plan.entries, plan.weekStart, weekEnd))

  /**
   * The rhythm is worked out over the *whole* loaded window, not just this week.
   * Sunday's lasagne followed by Monday's is one cook and one repeat even though
   * the two fall in different weeks, and a rhythm that reset every Monday would
   * be wrong exactly where repeats are most common.
   */
  let rhythm = $derived(mealRhythm(plan.entries))

  let pantry = $derived(
    pantryFrom(
      shopping.items.map((item) => item.catalogueItemId),
      learning.stats,
      new Date(),
    ),
  )

  let makeable = $derived(rankMakeable(dishes.all, pantry))

  let atHome = $derived(atHomeItems(learning.stats, shopping.onList, new Date()))

  let needs = $derived(
    planNeeds(plan.entries, plan.weekStart, weekEnd, dishes.byId, shopping.onList),
  )

  let dragged = $derived(drag.entryId ? plan.byId.get(drag.entryId) : undefined)

  function step(weeks: number) {
    showWeek(addDays(plan.weekStart, weeks * 7))
  }

  /** Plays the arrival flourish on a newly planted card, once. */
  function markFresh(id: string | null) {
    if (!id) return
    freshId = id
    window.setTimeout(() => {
      if (freshId === id) freshId = null
    }, 600)
  }

  async function onDrop(id: string, slot: DragSlot) {
    await moveEntry(id, slot)
  }

  async function pick(target: PlanTarget, options: PlanOptions) {
    const slot = picking
    if (!slot || !auth.userId) return
    picking = null
    markFresh(await planEntry(slot, target, auth.userId, options))
  }

  /**
   * A dish written from the picker goes straight onto the meal it was opened
   * from. `pendingSlot` is cleared either way, so cancelling the editor doesn't
   * leave a slot armed to catch the *next* dish written from the library.
   */
  async function dishWritten(dish: Dish) {
    const target = pendingSlot
    pendingSlot = null
    editingDish = null
    if (!target || !auth.userId) return

    markFresh(
      await planEntry(
        { date: target.date, meal: target.meal },
        { kind: 'dish', dishId: dish.id },
        auth.userId,
        target.options,
      ),
    )
  }

  /**
   * Swiped off the plan. The Undo re-plans it rather than restoring the row —
   * the row is deleted, and a new one with the same contents is what "put it
   * back" means here. It loses the entry's position within its meal, which is
   * the one thing a bag doesn't much care about.
   */
  async function swipeAway(entryId: string) {
    const entry = plan.byId.get(entryId)
    if (!entry) return

    const name =
      entry.kind === 'out'
        ? strings.plan.out
        : entry.kind === 'item'
          ? (shopping.byId.get(entry.itemId ?? '')?.name ?? strings.plan.empty)
          : (dishes.byId.get(entry.dishId ?? '')?.name ?? strings.plan.leftovers)

    await unplanEntry(entryId)

    flash = {
      text: strings.plan.removed(name),
      tone: 'good',
      action: strings.plan.undo,
      onAction: async () => {
        flash = null
        if (!auth.userId) return
        const target: PlanTarget =
          entry.kind === 'dish' && entry.dishId
            ? { kind: 'dish', dishId: entry.dishId }
            : entry.kind === 'item' && entry.itemId
              ? { kind: 'item', itemId: entry.itemId }
              : entry.kind === 'leftovers'
                ? { kind: 'leftovers', dishId: entry.dishId }
                : { kind: 'out' }

        markFresh(
          await planEntry(
            { date: entry.date, meal: entry.meal },
            target,
            auth.userId,
            { toCook: entry.toCook },
          ),
        )
      },
    }
  }

  /** "Out of it" on a What's home row: straight onto the shopping list. */
  async function outOfIt(itemId: string, name: string) {
    if (!auth.userId) return
    homeBusyId = itemId
    await addToList(itemId, auth.userId)
    homeBusyId = null
    flash = { text: strings.plan.homeAdded(name), tone: 'good' }
  }

  async function planFromMakeable(dishId: string, meal: Meal) {
    if (!auth.userId) return
    // Onto the day being looked at: today when that is in this week, otherwise
    // the Monday of it — "plan it" should never land somewhere off screen.
    const date = thisWeek ? today : plan.weekStart
    makeable_sheet = false
    const id = await planEntry({ date, meal }, { kind: 'dish', dishId }, auth.userId)
    if (id) {
      markFresh(id)
      flash = { text: strings.plan.makeablePlanned, tone: 'good' }
    }
  }

  async function toggleLeftovers() {
    const entry = opened
    if (!entry) return
    opened = null
    await setEntryKind(entry.id, entry.kind === 'leftovers' ? 'dish' : 'leftovers')
  }

  /** "Add what it needs" on one card — the same door as tapping its tile. */
  async function shopForEntry() {
    const entry = opened
    if (!entry) return
    opened = null

    if (entry.kind === 'item' && entry.itemId && auth.userId) {
      await addToList(entry.itemId, auth.userId)
      flash = { text: strings.plan.shopAdded(1), tone: 'good' }
      return
    }

    if (!entry.dishId) return
    const added = await addDishToList(entry.dishId)
    if (added === null) flash = { text: strings.plan.shopFailed, tone: 'bad' }
    else if (added === 0) flash = { text: strings.plan.shopAddedNone, tone: 'good' }
    else flash = { text: strings.plan.shopAdded(added), tone: 'good' }
  }

  async function shopForWeek(itemIds: string[]) {
    busy = true
    const added = await shopForRange(plan.weekStart, weekEnd, itemIds)
    busy = false
    shopping_sheet = false

    if (added === null) flash = { text: strings.plan.shopFailed, tone: 'bad' }
    else if (added === 0) flash = { text: strings.plan.shopAddedNone, tone: 'good' }
    else flash = { text: strings.plan.shopAdded(added), tone: 'good' }
  }

  async function removeEntry() {
    const entry = opened
    if (!entry) return
    opened = null
    await unplanEntry(entry.id)
  }
</script>

{#if !isConfigured}
  <Placeholder
    name="meals"
    heading={strings.screens.meals.heading}
    blurb={strings.screens.meals.blurb}
  />
{:else}
  <div class="screen">
    <div class="bar">
      <div class="views" role="group" aria-label={strings.plan.title}>
        <button class:on={view === 'days'} onclick={() => (view = 'days')}>
          {strings.plan.viewDay}
        </button>
        <button class:on={view === 'week'} onclick={() => (view = 'week')}>
          {strings.plan.viewWeek}
        </button>
      </div>

      <a class="library" href={hrefFor('meals') + '/dishes'}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
        {strings.plan.dishesLink}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </a>
    </div>

    <div class="weeks">
      <button onclick={() => step(-1)} aria-label={strings.plan.previousWeek}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>

      <span class="name">{weekName(plan.weekStart, today)}</span>

      <button onclick={() => step(1)} aria-label={strings.plan.nextWeek}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </div>

    {#if !thisWeek}
      <button class="back" onclick={() => showWeek(today)}>{strings.plan.thisWeek}</button>
    {/if}

    {#if plan.error}
      <p class="error" role="alert">{plan.error}</p>
    {/if}

    <button class="makeable" onclick={() => (makeable_sheet = true)}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3Z" />
        <path d="M10 20h4" />
      </svg>
      {strings.plan.makeableTitle}
      {#if makeable.length > 0}
        <span class="count">{makeable.length}</span>
      {/if}
    </button>

    {#if view === 'days'}
      <div class="days">
        {#each openDays as date (date)}
          <PlanDay
            {date}
            {today}
            meals={household.meals}
            entries={weekEntries}
            dishesById={dishes.byId}
            itemsById={shopping.byId}
            tags={dishes.tags}
            {rhythm}
            onAdd={(d, meal) => (picking = { date: d, meal })}
            onOpen={(entry) => (opened = entry)}
            {onDrop}
            onSwipeAway={swipeAway}
            {freshId}
          />
        {/each}
      </div>
    {:else}
      <PlanWeek
        {days}
        {today}
        meals={household.meals}
        entries={weekEntries}
        dishesById={dishes.byId}
        itemsById={shopping.byId}
        tags={dishes.tags}
        {rhythm}
        onAdd={(d, meal) => (picking = { date: d, meal })}
        onOpen={(entry) => (opened = entry)}
        {onDrop}
        onSwipeAway={swipeAway}
        {freshId}
      />
    {/if}

  </div>

  <!-- Pinned, because both questions are asked *while* looking at the week
       rather than after scrolling to the end of it. -->
  <div class="dock">
    <button class="shop" onclick={() => (shopping_sheet = true)}>
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
        <path d="M4 5h2l2.2 10.2a2 2 0 0 0 2 1.6h6.4a2 2 0 0 0 2-1.5L20 8H7" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="17" cy="20" r="1" />
      </svg>
      <span class="label">{strings.plan.shopWeek}</span>
      {#if needs.missing.length > 0}
        <span class="count">{needs.missing.length}</span>
      {/if}
    </button>

    <button class="home" onclick={() => (home_sheet = true)}>
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
        <path d="M4 11 12 4l8 7" />
        <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      </svg>
      <span class="label">{strings.plan.homeTitle}</span>
      {#if atHome.length > 0}
        <span class="count">{atHome.length}</span>
      {/if}
    </button>
  </div>

  <!-- The copy that follows the finger. At the root of the screen so the
       scroller can't clip it, and inert so elementFromPoint sees past it. -->
  {#if drag.active && dragged}
    <div
      class="ghost"
      style={`left: ${drag.x}px; top: ${drag.y}px; width: ${drag.width}px`}
      aria-hidden="true"
    >
      <PlanCard
        entry={dragged}
        dish={dragged.dishId ? (dishes.byId.get(dragged.dishId) ?? null) : null}
        item={dragged.itemId ? (shopping.byId.get(dragged.itemId) ?? null) : null}
        tags={dishes.tags}
        rhythm={rhythm.get(dragged.id) ?? null}
        size={view === 'week' ? 'compact' : 'full'}
      />
    </div>
  {/if}

  {#if picking}
    {@const slot = picking}
    <EntryPickerSheet
      meal={slot.meal}
      dayLabel={`${dayName(slot.date, today)} ${shortDate(slot.date)}`}
      library={dishes.all}
      tags={dishes.tags}
      {pantry}
      onPick={pick}
      onNewDish={(options) => {
        pendingSlot = { date: slot.date, meal: slot.meal, options }
        picking = null
        editingDish = 'new'
      }}
      onClose={() => (picking = null)}
    />
  {/if}

  {#if opened}
    {@const entry = opened}
    <PlanEntrySheet
      {entry}
      dish={entry.dishId ? (dishes.byId.get(entry.dishId) ?? null) : null}
      item={entry.itemId ? (shopping.byId.get(entry.itemId) ?? null) : null}
      {today}
      onToggleLeftovers={toggleLeftovers}
      onToggleToCook={() => {
        opened = null
        void setToCook(entry.id, !entry.toCook)
      }}
      onShopFor={shopForEntry}
      onEditDish={(dish) => {
        opened = null
        editingDish = dish
      }}
      onNote={(note) => void setEntryNote(entry.id, note)}
      onRemove={removeEntry}
      onClose={() => (opened = null)}
    />
  {/if}

  {#if shopping_sheet}
    <PlanShopSheet
      {needs}
      silent={needs.silent}
      itemsById={shopping.byId}
      rangeLabel={strings.plan.shopRange(shortDate(plan.weekStart), shortDate(weekEnd))}
      {busy}
      onAdd={shopForWeek}
      onClose={() => (shopping_sheet = false)}
    />
  {/if}

  {#if makeable_sheet}
    <MakeableSheet
      {makeable}
      tags={dishes.tags}
      itemsById={shopping.byId}
      targetLabel={thisWeek ? dayName(today, today) : dayName(plan.weekStart, today)}
      meals={household.meals}
      onPlan={planFromMakeable}
      onClose={() => (makeable_sheet = false)}
    />
  {/if}

  {#if home_sheet}
    <AtHomeSheet
      items={atHome}
      itemsById={shopping.byId}
      busyId={homeBusyId}
      onAddToList={outOfIt}
      onClose={() => (home_sheet = false)}
    />
  {/if}

  {#if editingDish}
    <!-- Keyed so opening a different dish mounts a fresh sheet: the draft fields
         inside snapshot their dish once and never re-sync. -->
    {#key editingDish === 'new' ? 'new' : editingDish.id}
      <DishSheet
        dish={editingDish === 'new' ? null : editingDish}
        userId={auth.userId}
        onSaved={dishWritten}
        onClose={() => {
          editingDish = null
          pendingSlot = null
        }}
      />
    {/key}
  {/if}

  {#if flash}
    {@const shown = flash}
    <!-- No wrapper: Flash positions itself, and a fixed wrapper here was both
         redundant and — with pointer-events: none on it — the reason the Undo
         button could not be tapped. -->
    <Flash
      message={shown.text}
      tone={shown.tone}
      action={shown.action}
      onAction={shown.onAction}
      onDone={() => (flash = null)}
    />
  {/if}
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-3);
    /* Clear of the pinned dock — its own height plus its padding — so the last
       day of the week can still be scrolled fully into view. */
    padding-bottom: calc(var(--tap-min) + var(--space-6));
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .views {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
  }

  .views button {
    min-height: 2.25rem;
    padding: 0 var(--space-4);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .views button.on {
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-1);
  }

  /* A button, not a link with a chevron (Marçal, round 10.1): it sits beside the
     Days/Week switch and has to read as the third control in that row rather
     than as a caption that happens to be tappable. */
  .library {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2.5rem;
    padding: 0 var(--space-4);
    border-radius: var(--radius-full);
    background: var(--color-tab-meals);
    color: var(--color-accent-ink);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    text-decoration: none;
  }

  .library:active {
    transform: scale(0.98);
  }

  .weeks {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .weeks button {
    display: grid;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
  }

  .weeks button:active {
    background: var(--color-surface-sunken);
  }

  .weeks .name {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  .back {
    align-self: center;
    min-height: 2rem;
    padding: 0 var(--space-4);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }

  .makeable {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  /*
    The two questions you ask while looking at the week, pinned above the nav so
    neither needs scrolling to. Side by side and equal width because they are
    genuinely a pair — one is "what do we need", the other "what have we got" —
    even though only the first writes anything.
  */
  .dock {
    position: fixed;
    right: 0;
    bottom: var(--nav-height);
    left: 0;
    z-index: var(--z-nav);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
  }

  .dock button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .dock .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shop {
    background: var(--color-tab-shopping);
    color: var(--color-accent-ink);
    box-shadow: var(--shadow-1);
  }

  /* Outlined rather than filled: it tells you something, it doesn't change
     anything, and two solid buttons side by side would both shout. */
  .home {
    border: 1px solid var(--color-border-strong);
    background: var(--color-surface);
    color: var(--color-text);
  }

  .dock button:active,
  .makeable:active {
    transform: scale(0.99);
  }

  .count {
    display: grid;
    flex: none;
    min-width: 1.4rem;
    height: 1.4rem;
    padding: 0 var(--space-1);
    place-items: center;
    border-radius: var(--radius-full);
    background: rgb(255 255 255 / 0.25);
    font-size: var(--text-xs);
  }

  .makeable .count,
  .home .count {
    background: var(--color-surface-sunken);
  }

  .days {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .ghost {
    position: fixed;
    z-index: var(--z-drag);
    pointer-events: none;
    /* Lifted off the page: bigger, tilted a hair, and casting a real shadow, so
       it reads as being held rather than as a copy that got stuck. */
    transform: scale(1.04) rotate(-1.5deg);
    filter: drop-shadow(0 8px 18px rgb(42 35 32 / 0.28));
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
