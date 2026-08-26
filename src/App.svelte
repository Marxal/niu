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
  import AppHeader from './components/AppHeader.svelte'
  import BottomNav from './components/BottomNav.svelte'
  import CalendarScreen from './screens/CalendarScreen.svelte'
  import MealsScreen from './screens/MealsScreen.svelte'
  import SettingsScreen from './screens/SettingsScreen.svelte'
  import ShoppingScreen from './screens/ShoppingScreen.svelte'
  import SignInScreen from './screens/SignInScreen.svelte'
  import { TABS, parseRoute, type RouteId, type TabId } from './lib/router'
  import { strings } from './lib/strings'
  import { auth, watchAuth } from './lib/auth.svelte'
  import { clearHousehold, household, loadHousehold } from './lib/household.svelte'
  import { clearShopping, loadShopping, watchShopping } from './lib/shopping.svelte'
  import { clearShops, loadShops, shops, watchShops } from './lib/shops.svelte'
  import { clearLearning, loadLearning } from './lib/learning.svelte'
  import { watchKeyboard } from './lib/keyboard'
  import { watchTheme } from './lib/theme.svelte'
  import { loadPrefs } from './lib/prefs.svelte'

  let route = $state<RouteId>(parseRoute(location.hash))

  // Where the close button in Settings sends you back to.
  let lastTab = $state<TabId>('shopping')

  const titles: Record<RouteId, string> = {
    shopping: strings.tabs.shopping.label,
    meals: strings.tabs.meals.label,
    calendar: strings.tabs.calendar.label,
    settings: strings.header.settings,
  }

  $effect(() => {
    const sync = () => {
      route = parseRoute(location.hash)
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

  // What the app has learned. Re-runs when the chosen shop changes, because the
  // aisle order is per shop — the stats alongside it are not, and reloading
  // both is one round trip either way.
  $effect(() => {
    const shopId = shops.currentId
    if (!household.id) return

    void loadLearning(shopId)
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
    <AppHeader {route} title={titles[route]} backTo={lastTab} />

    <main id="main">
      <div class="content">
        {#if route === 'shopping'}
          <ShoppingScreen />
        {:else if route === 'meals'}
          <MealsScreen />
        {:else if route === 'calendar'}
          <CalendarScreen />
        {:else}
          <SettingsScreen />
        {/if}
      </div>
    </main>

    <BottomNav {route} />
  </div>
{/if}

<style>
  .shell {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
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
