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

  ## Tap to act, hold to move

  One rule that decides most of the interaction. A long press is the drag
  (drag.svelte.ts), so a tap opens the card's sheet instead. The copy that
  follows the finger is rendered here, at the root of the screen, because a
  `position: fixed` element inside a day card would be clipped by the scroller.

  ## Both directions

  Plan → shop is the button at the bottom: everything the week needs, previewed,
  then written by add_plan_to_list() in one round trip.

  Shop → plan is "What can we make?" and the top group in the meal picker. Both
  read from plannable.ts, and both are honest about what they know: what is on
  the list right now, and what was bought in the last few days. Neither claims to
  know what is in the cupboards — that is stock inference, and §5 defers it.
-->
<script lang="ts">
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
    shortDate,
    startOfWeek,
    todayKey,
    weekDays,
    weekName,
  } from '../lib/plan'
  import { planNeeds } from '../lib/plan-needs'
  import {
    type PlanTarget,
    moveEntry,
    plan,
    planEntry,
    setEntryKind,
    setEntryNote,
    shopForRange,
    showWeek,
    unplanEntry,
  } from '../lib/plan.svelte'
  import { pantryFrom, rankMakeable } from '../lib/plannable'
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
  let weekEnd = $derived(addDays(plan.weekStart, 6))

  let picking = $state<{ date: string; meal: Meal } | null>(null)
  let opened = $state<PlanEntry | null>(null)
  let shopping_sheet = $state(false)
  let makeable_sheet = $state(false)
  let editingDish = $state<Dish | 'new' | null>(null)
  let busy = $state(false)
  let flash = $state<{ text: string; tone: 'good' | 'bad' } | null>(null)

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

  let needs = $derived(
    planNeeds(plan.entries, plan.weekStart, weekEnd, dishes.byId, shopping.onList),
  )

  let dragged = $derived(drag.entryId ? plan.byId.get(drag.entryId) : undefined)

  function step(weeks: number) {
    showWeek(addDays(plan.weekStart, weeks * 7))
  }

  async function onDrop(id: string, slot: DragSlot) {
    await moveEntry(id, slot)
  }

  async function pick(target: PlanTarget) {
    const slot = picking
    if (!slot || !auth.userId) return
    picking = null
    await planEntry(slot, target, auth.userId)
  }

  async function planFromMakeable(dishId: string, meal: Meal) {
    if (!auth.userId) return
    // Onto the day being looked at: today when that is in this week, otherwise
    // the Monday of it — "plan it" should never land somewhere off screen.
    const date = thisWeek ? today : plan.weekStart
    makeable_sheet = false
    const ok = await planEntry({ date, meal }, { kind: 'dish', dishId }, auth.userId)
    if (ok) {
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

  async function shopForWeek() {
    busy = true
    const added = await shopForRange(plan.weekStart, weekEnd)
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
        {#each days as date (date)}
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
      />
    {/if}

    <button class="shop" onclick={() => (shopping_sheet = true)}>
      <svg
        width="20"
        height="20"
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
      {strings.plan.shopWeek}
      {#if needs.missing.length > 0}
        <span class="count">{needs.missing.length}</span>
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
      onNewDish={() => {
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

  {#if editingDish}
    <!-- Keyed so opening a different dish mounts a fresh sheet: the draft fields
         inside snapshot their dish once and never re-sync. -->
    {#key editingDish === 'new' ? 'new' : editingDish.id}
      <DishSheet
        dish={editingDish === 'new' ? null : editingDish}
        userId={auth.userId}
        onClose={() => (editingDish = null)}
      />
    {/key}
  {/if}

  {#if flash}
    {@const shown = flash}
    <div class="flash-slot">
      <Flash message={shown.text} tone={shown.tone} onDone={() => (flash = null)} />
    </div>
  {/if}
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-3) var(--space-8);
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

  .library {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--tap-min);
    padding-left: var(--space-2);
    color: var(--color-tab-meals);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    text-decoration: none;
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

  .makeable,
  .shop {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    border-radius: var(--radius-full);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }

  /* Quieter than the shopping button: it is an offer, not the main move. */
  .makeable {
    border: 1px solid var(--color-border-strong);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .shop {
    background: var(--color-tab-shopping);
    color: var(--color-accent-ink);
    box-shadow: var(--shadow-1);
  }

  .shop:active,
  .makeable:active {
    transform: scale(0.99);
  }

  .count {
    display: grid;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 var(--space-1);
    place-items: center;
    border-radius: var(--radius-full);
    background: rgb(255 255 255 / 0.25);
    font-size: var(--text-xs);
  }

  .makeable .count {
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

  .flash-slot {
    position: fixed;
    inset: auto var(--space-4) calc(var(--nav-height) + var(--space-4));
    z-index: var(--z-toast);
    display: grid;
    justify-items: center;
    pointer-events: none;
  }
</style>
