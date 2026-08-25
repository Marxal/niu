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
  import { TABS, parseRoute, type RouteId, type TabId } from './lib/router'

  let route = $state<RouteId>(parseRoute(location.hash))

  // Where the close button in Settings sends you back to.
  let lastTab = $state<TabId>('shopping')

  const titles: Record<RouteId, string> = {
    shopping: 'Compra',
    meals: 'Menús',
    calendar: 'Calendari',
    settings: 'Ajustos',
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
</script>

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

<style>
  .shell {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    height: 100%;
  }

  main {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .content {
    /* A single-cell grid so the screen inside stretches to fill the viewport (the
       empty states centre themselves in it) but can still grow past it once
       there's real content. */
    display: grid;
    min-height: 100%;
    max-width: var(--content-max);
    margin-inline: auto;
  }
</style>
