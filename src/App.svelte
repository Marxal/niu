<!--
  The app shell. Three fixed rows — header, scrolling content, bottom nav — and a
  switch that picks the screen for the current route.

  Two things worth knowing:
   - The current route is read from the URL, never written to a store. Tapping a
     tab changes the hash; the `hashchange` listener below turns that back into
     state. That single direction is what makes the Android back button work
     without any extra code.
   - Only <main> scrolls. If the whole page scrolled, Chrome's collapsing URL bar
     would drag the nav around under the user's thumb.
-->
<script lang="ts">
  import BottomNav from './components/BottomNav.svelte'
  import CalendarScreen from './screens/CalendarScreen.svelte'
  import DishesScreen from './screens/DishesScreen.svelte'
  import PlannerScreen from './screens/PlannerScreen.svelte'
  import SettingsScreen from './screens/SettingsScreen.svelte'
  import ShoppingScreen from './screens/ShoppingScreen.svelte'
  import SignInScreen from './screens/SignInScreen.svelte'
  import { TABS, parseRoute, parseSubRoute, type RouteId, type TabId } from './lib/router'
  import { shell } from './lib/shell.svelte'
  import { auth, watchAuth } from './lib/auth.svelte'
  import { clearHousehold, household, loadHousehold } from './lib/household.svelte'
  import { clearDishes, loadDishes, watchDishes } from './lib/dishes.svelte'
  import { clearPlan, loadPlan, plan, watchPlan } from './lib/plan.svelte'
  import { clearShopping, loadShopping, watchShopping } from './lib/shopping.svelte'
  import { clearShops, loadShops, shops, watchShops } from './lib/shops.svelte'
  import { clearCalendar, loadInitialWindow, loadTombstones, watchCalendar } from './lib/calendar.svelte'
  import { clearPeople, loadPeople, watchPeople } from './lib/people.svelte'
  import { clearSync, loadSyncRows } from './lib/google-sync.svelte'
  import { loadCalendarId } from './lib/google.svelte'
  import { clearLearning, loadLearning } from './lib/learning.svelte'
  import { watchKeyboard } from './lib/keyboard'
  import { watchTheme } from './lib/theme.svelte'
  import { loadPrefs } from './lib/prefs.svelte'

  let route = $state<RouteId>(parseRoute(location.hash))
  /** The segment after the route: 'dishes' under Meals, otherwise nothing. */
  let sub = $state<string | null>(parseSubRoute(location.hash))

  // Where the close button in Settings sends you back to.
  let lastTab = $state<TabId>('shopping')

  $effect(() => {
    const sync = () => {
      route = parseRoute(location.hash)
      sub = parseSubRoute(location.hash)
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  })

  $effect(() => {
    const tab = TABS.find((t) => t.id === route)
    if (tab) lastTab = tab.id
  })

  // Applies the stored light/dark choice, and keeps following the phone's own
  // setting while the choice is "system".
  $effect(() => watchTheme())

  // Publishes how much of the screen the on-screen keyboard is covering, so a
  // bottom sheet can sit above it instead of underneath.
  $effect(() => watchKeyboard())

  // Display preferences are device-local and don't need watching — read once.
  $effect(() => {
    loadPrefs()
  })

  // One subscription for the life of the app. It reports the stored session on
  // its own, so this is also what moves us off the 'loading' screen at boot.
  $effect(() => watchAuth())

  // Fetch (or create) the household as soon as we know who's signed in, and
  // drop it on the way out so nothing carries into the next account.
  $effect(() => {
    if (auth.status === 'signed-in') {
      void loadHousehold()
    } else {
      clearHousehold()
      clearShopping()
      clearShops()
      clearLearning()
      clearDishes()
      clearPlan()
      clearCalendar()
      clearPeople()
      clearSync()
    }
  })

  // The list can only be fetched once the household is known, so this waits on
  // household.id rather than on the sign-in status. Re-running when the id
  // changes also tears down the old realtime channel via the returned cleanup.
  $effect(() => {
    if (!household.id) return

    void loadShopping()
    return watchShopping()
  })

  // The shops themselves are household data and sync like the list does.
  $effect(() => {
    if (!household.id) return

    void loadShops()
    return watchShops()
  })

  // Dishes too: a dish written on one phone is a tile on the other.
  $effect(() => {
    if (!household.id) return

    void loadDishes()
    return watchDishes()
  })

  // The plan. Re-reads when the week on screen moves, because only a window
  // around it is fetched — see plan.svelte.ts.
  $effect(() => {
    const week = plan.weekStart
    if (!household.id || !week) return

    void loadPlan()
  })

  // One subscription for the plan, independent of which week is shown: the
  // channel is per household, and re-subscribing on every arrow tap would drop
  // events in the gap.
  $effect(() => {
    if (!household.id) return
    return watchPlan()
  })

  // What the app has learned. Re-runs when the chosen shop changes, because the
  // aisle order is per shop — the stats alongside it are not, and reloading
  // both is one round trip either way.
  $effect(() => {
    const shopId = shops.currentId
    if (!household.id) return

    void loadLearning(shopId)
  })

  // Who lives here. Loaded at the shell rather than on the calendar screen
  // because a face and a name are needed wherever "who added this" is shown —
  // the bottom bar draws your own — and because the confirmation badge below
  // has to be right on the shopping tab too.
  $effect(() => {
    if (!household.id) return

    void loadPeople()
    return watchPeople()
  })

  // The calendar, for the same reason: the count on the Calendar tab is the
  // whole point of asking somebody to confirm something, and a badge that only
  // appears once you open the tab it is on would be pointless. Stepping to a
  // month outside this window widens it; see calendar.svelte.ts.
  $effect(() => {
    if (!household.id) return

    void loadInitialWindow().then(() => {
      void loadTombstones()
      void loadSyncRows()
      void loadCalendarId()
    })

    return watchCalendar()
  })
</script>

{#if auth.status === 'loading'}
  <!-- Deliberately almost empty. This shows for a few hundred milliseconds while
       the stored session is read, and a spinner that fast reads as a flicker. -->
  <div class="booting"></div>
{:else if auth.status === 'signed-out'}
  <SignInScreen />
{:else}
  <div class="shell">
    <main id="main">
      <div class="content">
        {#if route === 'shopping'}
          <ShoppingScreen />
        {:else if route === 'meals'}
          {#if sub === 'dishes'}
            <DishesScreen />
          {:else}
            <PlannerScreen />
          {/if}
        {:else if route === 'calendar'}
          <CalendarScreen />
        {:else}
          <SettingsScreen />
        {/if}
      </div>
    </main>

    <!-- Out of the way while a screen says so — which today means while the
         shopping search is running. See shell.svelte.ts. -->
    {#if !shell.navHidden}
      <BottomNav {route} backTo={lastTab} />
    {/if}
  </div>
{/if}

<style>
  /* Two rows since round 11.1: the scrolling screen, and the bar. The top
     header is gone — see BottomNav for why, and note that each screen now owns
     its own top padding including the status-bar inset. */
  .shell {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    height: 100%;
  }

  .booting {
    height: 100%;
    background: var(--color-bg);
  }

  main {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  /* The status bar's height, once, at the top of whatever is scrolling. Every
     screen used to get this from the header sitting above it. */
  main {
    padding-top: env(safe-area-inset-top, 0px);
  }

  .content {
    /* A single-cell grid so the screen inside stretches to fill the viewport (the
       empty states centre themselves in it) but can still grow past it once
       there's real content.

       The column needs minmax(0, 1fr), not the bare default 'auto': an
       unconstrained grid track sizes itself to the min-content width of
       whatever's inside, so a screen with several nested flex columns (Settings
       is the deepest) could quietly push this a few pixels wider than the
       viewport — invisible at rest, but real, and it turns the whole app
       horizontally scrollable. minmax(0, …) is what lets the track shrink back
       down to the space actually available, same as .shell's row below. */
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-height: 100%;
    max-width: var(--content-max);
    margin-inline: auto;
  }
</style>
