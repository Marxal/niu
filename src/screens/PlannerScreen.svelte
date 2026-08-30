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
  import { slide } from 'svelte/transition'
  import AtHomeSheet from '../components/AtHomeSheet.svelte'
  import DishSheet from '../components/DishSheet.svelte'
  import MagicIcon from '../components/MagicIcon.svelte'
  import MagicPlanSheet from '../components/MagicPlanSheet.svelte'
  import EntryPickerSheet from '../components/EntryPickerSheet.svelte'
  import Flash from '../components/Flash.svelte'
  import GroceryIcon from '../components/GroceryIcon.svelte'
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
  import {
    type CarriedItem,
    type DragSlot,
    carry,
    drag,
    startCarry,
  } from '../lib/drag.svelte'
  import { household } from '../lib/household.svelte'
  import { learning } from '../lib/learning.svelte'
  import { dismiss, isDismissed, undismiss } from '../lib/dismissed.svelte'
  import {
    type ProposedEntry,
    planReadiness,
    proposeWeek,
    readWeekPattern,
  } from '../lib/plan-magic'
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
    type PlanDraft,
    type PlanOptions,
    type PlanTarget,
    moveEntry,
    plan,
    planEntry,
    planMany,
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

  /**
   * Whether the days already gone in this week are unfolded.
   *
   * Closed every time the week changes: stepping to next week and back should
   * give the tab the state it always has, not whatever was open two taps ago.
   */
  let showEarlier = $state(false)

  $effect(() => {
    // Read the week so this re-runs when it changes, then fold up again.
    plan.weekStart
    showEarlier = false
  })

  let picking = $state<{ date: string; meal: Meal } | null>(null)
  let opened = $state<PlanEntry | null>(null)
  let shopping_sheet = $state(false)
  let makeable_sheet = $state(false)
  let magic_sheet = $state(false)
  let home_sheet = $state(false)
  /** The What's home sheet is out of sight but still mounted, mid-carry. */
  let homeCarrying = $state(false)
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

  /*
   * The days of this week that are already behind you *and have something on
   * them*. Round 10.1 cut these out of the day view, and that was right for
   * planning — nobody plans Monday's dinner on a Wednesday, and two screens of
   * dead days sat between the tab and the question you opened it to answer.
   *
   * What it also cut out was looking back, which turns out to be the other half
   * of what the week is for: "what did we have on Monday?" is how you decide
   * you don't want it again on Thursday. So they come back folded — one row you
   * can tap, costing one line rather than two screens.
   *
   * Days with nothing planned are left out entirely. An empty Monday is not
   * inspiration, and unfolding onto three blank meal slots would make the row
   * look broken. This only ever applies to the week you are in: step back a
   * week and the day view already shows all seven.
   */
  let earlierDays = $derived(
    days.filter((date) => date < today && weekEntries.some((entry) => entry.date === date)),
  )

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

  /*
   * What Fill the week has to go on. Read off `plan.history` — three months of
   * past weeks that nothing draws — rather than off `plan.entries`, which is a
   * month-wide window around whatever week is on screen and would make the
   * pattern change every time you tapped an arrow.
   */
  let pattern = $derived(readWeekPattern(plan.history, plan.weekStart))
  let magicReady = $derived(planReadiness(pattern))

  /*
   * The proposal, worked out as the button is drawn rather than when it is
   * tapped, so the sheet opens with nothing to wait for. It is pure arithmetic
   * over a few hundred rows.
   *
   * `from` is today in the week you are in, and nothing otherwise: the day view
   * already refuses to show Monday on a Wednesday (§4.2), and proposing meals
   * into days that are not on screen would be proposing them invisibly.
   */
  let proposal = $derived.by<ProposedEntry[]>(() => {
    if (!magicReady.ready) return []
    return proposeWeek(pattern, {
      weekStart: plan.weekStart,
      meals: household.meals,
      existing: weekEntries,
      dishIds: new Set(dishes.all.map((dish) => dish.id)),
      itemIds: new Set(shopping.picker.map((item) => item.id)),
      // Spread rather than `from: undefined`: with exactOptionalPropertyTypes
      // an absent key and an undefined one are different things.
      ...(thisWeek ? { from: today } : {}),
    })
  })

  /*
   * What's home, minus the rows this phone has already waved away.
   *
   * The filter is here rather than inside atHomeItems() because a dismissal is
   * a fact about the person looking, not about the household — see
   * dismissed.svelte.ts — and plannable.ts is pure arithmetic over household
   * data with no business knowing about a phone's local storage.
   */
  let atHome = $derived(
    atHomeItems(learning.stats, shopping.onList, new Date()).filter(
      (entry) => !isDismissed(entry.itemId, learning.stats[entry.itemId]?.lastBoughtAt ?? null),
    ),
  )

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

  /**
   * Held down in the What's home sheet: close it and carry the item onto the
   * week.
   *
   * The sheet closes first and on purpose — you cannot aim at days you cannot
   * see. `startCarry` then drives the whole gesture off the window, so the row
   * disappearing underneath the finger costs nothing.
   */
  function carryFromHome(item: CarriedItem, at: { x: number; y: number }) {
    // Hidden, *not* closed: unmounting the row the finger is on would cancel the
    // pointer and kill the gesture on its first move. See drag.svelte.ts.
    homeCarrying = true
    startCarry(item, at, {
      onDrop: (itemId, slot) => {
        if (!auth.userId) return
        void planEntry(slot, { kind: 'item', itemId }, auth.userId).then(markFresh)
      },
      onEnd: () => {
        homeCarrying = false
        home_sheet = false
      },
    })
  }

  /**
   * The magic button.
   *
   * It is a real button even when it cannot do anything, and tapping it says
   * why and how far off it is (Marçal: *"if there's not enough data, the tool
   * can just be inactive, just inform the user"*). A control that is greyed out
   * and silent teaches you nothing; one that answers teaches you what to do to
   * turn it on.
   */
  function openMagic() {
    if (!magicReady.ready) {
      flash = {
        text: strings.plan.magicNotYet(magicReady.weeksShort, magicReady.entriesShort),
        tone: 'good',
      }
      return
    }
    magic_sheet = true
  }

  /**
   * Writes the week that survived the ticking, in one round trip.
   *
   * The first card gets the arrival flourish and the rest do not, on purpose:
   * fourteen cards each playing their own animation is confetti, and the one
   * that plays is enough to say "that landed".
   */
  async function applyMagic(chosen: ProposedEntry[]) {
    if (!auth.userId) return

    const drafts: PlanDraft[] = chosen.map((entry) => ({
      date: entry.date,
      meal: entry.meal,
      target:
        entry.kind === 'dish' && entry.dishId
          ? { kind: 'dish', dishId: entry.dishId }
          : entry.kind === 'item' && entry.itemId
            ? { kind: 'item', itemId: entry.itemId }
            : entry.kind === 'leftovers'
              ? { kind: 'leftovers', dishId: entry.dishId }
              : { kind: 'out' },
    }))

    busy = true
    const planned = await planMany(drafts, auth.userId)
    busy = false
    magic_sheet = false

    if (planned === null) flash = { text: strings.plan.magicFailed, tone: 'bad' }
    else flash = { text: strings.plan.magicDone(planned), tone: 'good' }
  }

  /**
   * Swiped off the What's home sheet. Nothing goes on any list — that is the
   * whole point of it, and the Undo is there because a swipe is the one gesture
   * you can make by accident.
   */
  function dismissFromHome(entry: { itemId: string }, name: string) {
    const stat = learning.stats[entry.itemId]
    dismiss(entry.itemId, stat?.lastBoughtAt ?? null)

    flash = {
      text: strings.plan.homeDismissed(name),
      tone: 'good',
      action: strings.plan.undo,
      onAction: () => {
        flash = null
        undismiss(entry.itemId)
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

    <!-- The two "help me decide" buttons, side by side because they are a pair:
         one reads the cupboard, the other reads your habits. Neither writes
         anything on its own — both open a sheet you have to agree with. -->
    <div class="tools">
      <button class="tool" onclick={() => (makeable_sheet = true)}>
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
        <span class="tool-label">{strings.plan.makeableTitle}</span>
        {#if makeable.length > 0}
          <span class="count">{makeable.length}</span>
        {/if}
      </button>

      <!--
        Not `disabled`, on purpose, even when it cannot do anything. A greyed-out
        control tells you nothing about why it is off or what would turn it on;
        this one is drawn quiet and answers when you tap it. `aria-disabled`
        says the same to a screen reader without taking the button out of the
        tab order and out of reach of the explanation.
      -->
      <button
        class="tool magic"
        class:ready={magicReady.ready}
        aria-disabled={!magicReady.ready}
        onclick={openMagic}
      >
        <MagicIcon size={18} />
        <span class="tool-label">{strings.plan.magicShort}</span>
        {#if magicReady.ready && proposal.length > 0}
          <span class="count">{proposal.length}</span>
        {/if}
      </button>
    </div>

    {#if view === 'days'}
      <div class="days">
        <!-- What has already been eaten this week, folded away. Above the
             open days because that is where it happened — the day view reads
             down the week, and putting Monday under Friday would be a lie
             about the order of things. -->
        {#if earlierDays.length > 0}
          <button
            class="earlier"
            class:open={showEarlier}
            aria-expanded={showEarlier}
            onclick={() => (showEarlier = !showEarlier)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
            {showEarlier ? strings.plan.earlierHide : strings.plan.earlierShow}
            <span class="count">{earlierDays.length}</span>
          </button>

          {#if showEarlier}
            <div class="earlier-days" transition:slide={{ duration: 200 }}>
              {#each earlierDays as date (date)}
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
          {/if}
        {/if}

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

  <!--
    The strip above the nav. It is two things at different moments, and never
    both: the two questions you ask while looking at the week, and — while a card
    is in the air — the bin.

    Swapping rather than stacking is deliberate. A bin that is always there is a
    permanently armed delete sitting under your thumb; one that appears only when
    something is actually being carried can't be hit by accident, and it lands
    exactly where a thumb already is at the end of a downward drag.
  -->
  {#if drag.active}
    <div class="trash" class:over={drag.overTrash} data-trash>
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
      {drag.overTrash ? strings.plan.trashOver : strings.plan.trashDrop}
    </div>
  {:else}
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
        <span class="label">{strings.plan.shopShort}</span>
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
        <span class="label">{strings.plan.homeShort}</span>
        {#if atHome.length > 0}
          <span class="count">{atHome.length}</span>
        {/if}
      </button>
    </div>
  {/if}

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

  <!-- Something carried in from another sheet. Same rules as the card copy:
       fixed, inert, and above everything because it is under the finger. -->
  {#if carry.active}
    <div
      class="carried"
      style={`left: ${carry.x}px; top: ${carry.y}px`}
      aria-hidden="true"
    >
      <GroceryIcon icon={carry.icon} emoji={carry.emoji} name={carry.name} size={22} />
      <span>{carry.name}</span>
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
      hidden={homeCarrying}
      onAddToList={outOfIt}
      onDismiss={dismissFromHome}
      onCarry={carryFromHome}
      onClose={() => (home_sheet = false)}
    />
  {/if}

  {#if magic_sheet}
    <MagicPlanSheet
      proposed={proposal}
      dishesById={dishes.byId}
      itemsById={shopping.byId}
      {today}
      rangeLabel={weekName(plan.weekStart, today)}
      {busy}
      onApply={(chosen) => void applyMagic(chosen)}
      onClose={() => (magic_sheet = false)}
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

  /* Two equal halves. `min-width: 0` on the children is what lets a long label
     ellipsis rather than push its neighbour off the row. */
  .tools {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .tool {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .tool svg {
    flex: none;
  }

  .tool-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Quiet until it can actually do something, and then it wears the accent.
     The difference has to be visible at a glance from across the kitchen —
     which is also why it is a colour change rather than an opacity one. */
  .magic.ready {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .magic:not(.ready) {
    color: var(--color-text-faint);
  }

  /*
    The two questions you ask while looking at the week, pinned above the nav so
    neither needs scrolling to. Side by side and equal width because they are
    genuinely a pair — one is "what do we need", the other "what have we got" —
    even though only the first writes anything.

    Floating rather than a bar, the same way the shopping tab's search field
    does it: the only thing behind them is a short fade to the page colour, so a
    day card dissolves as it passes under instead of being sliced off by a hard
    edge. The names are one word each — side by side on a 412px phone, each with
    a count badge, there is room for a word and not a sentence.
  */
  .dock,
  .trash {
    position: fixed;
    right: 0;
    bottom: var(--nav-height);
    left: 0;
    z-index: var(--z-nav);
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--space-5) var(--space-3) var(--space-3);
    background: linear-gradient(
      to bottom,
      transparent 0%,
      color-mix(in srgb, var(--color-bg) 70%, transparent) 45%,
      var(--color-bg) 100%
    );
  }

  .dock {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .dock button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border-radius: var(--radius-full);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
    box-shadow: var(--shadow-1);
  }

  .dock .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /*
    The bin, in place of the two buttons while something is being carried.

    Deliberately loud even at rest, and louder still under the finger: it is on
    screen for two seconds at a time, at arm's length, competing with a card the
    thumb is covering. `pointer-events: none` on the *contents* keeps
    elementFromPoint finding the bin itself rather than its label.
  */
  .trash {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    /* Twice a normal touch target. See the note on ::before below — this is the
       half that makes the *drop* easier, and the pill only shows where it is. */
    min-height: calc(var(--tap-min) * 2);
    padding-top: var(--space-3);
    color: var(--color-need);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    /* The gradient fade belongs to the strip; the pill is drawn by ::before
       inside it, so the fade still softens whatever scrolls under the bin. */
    isolation: isolate;
  }

  /* The pill itself. It used to be inset to exactly where the two buttons sit,
     so the swap was invisible — but that made it a 48px target, and 48px is not
     enough when you are aiming at it with a card held under your own thumb
     (Marçal, round 11.1). The strip above sets a min-height of twice that; this
     fills it, so the pill and the area that actually accepts the drop are the
     same shape, and all the extra height is at the top where the finger is
     coming from. */
  .trash::before {
    content: '';
    position: absolute;
    inset: var(--space-3);
    z-index: -1;
    border: 2px dashed var(--color-need-border);
    border-radius: var(--radius-full);
    background: var(--color-need-soft);
    transition:
      background var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease);
  }

  /* Under the finger: filled, solid-edged, and the label flips to read on it. */
  .trash.over {
    color: var(--color-accent-ink);
  }

  .trash.over::before {
    border-style: solid;
    border-color: var(--color-need);
    background: var(--color-need);
  }

  /* Never the thing elementFromPoint finds — the bin itself has to be. */
  .trash > svg {
    pointer-events: none;
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
  .tool:active {
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

  .tool .count,
  .home .count {
    background: var(--color-surface-sunken);
  }

  .days {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* The fold. Reads as a quiet row rather than a button, because it is a way
     of looking rather than a thing that changes the plan. */
  .earlier {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    align-self: flex-start;
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
    margin-left: calc(var(--space-2) * -1);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .earlier svg {
    transition: transform var(--dur-fast) var(--ease);
  }

  .earlier.open svg {
    transform: rotate(180deg);
  }

  .earlier .count {
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .earlier-days {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* Follows the finger from its own centre rather than from a grab offset:
     it was picked up in a sheet that has since closed, so there is no longer a
     meaningful "where on the card you took hold of it". */
  .carried {
    position: fixed;
    z-index: var(--z-drag);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-pick-border);
    border-radius: var(--radius-full);
    background: var(--color-pick-soft);
    color: var(--color-pick);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    white-space: nowrap;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(1.04);
    filter: drop-shadow(0 8px 18px rgb(42 35 32 / 0.28));
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
