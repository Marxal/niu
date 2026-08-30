<!--
  Settings. Round 1 has one thing that actually does something — the Install
  button — plus stubs for what's coming, so the screen isn't a lie about where
  things will live.

  The Install button only appears when Chrome has actually offered us a prompt.
  If the app is already installed, or the browser doesn't support installing
  (Firefox on Android, or an in-app browser), the row explains itself instead of
  showing a button that would do nothing.
-->
<script lang="ts">
  import { auth, signOut } from '../lib/auth.svelte'
  import { household } from '../lib/household.svelte'
  import { MEALS, MEAL_LABELS, type Meal } from '../lib/plan'
  import { setHouseholdMeals } from '../lib/plan.svelte'
  import { install, promptInstall } from '../lib/install.svelte'
  import { setTheme, theme, type ThemeChoice } from '../lib/theme.svelte'
  import ShopsCard from '../components/ShopsCard.svelte'
  import GoogleCard from '../components/GoogleCard.svelte'
  import NotifyCard from '../components/NotifyCard.svelte'
  import HouseholdCard from '../components/HouseholdCard.svelte'
  import {
    prefs,
    setAskConfirm,
    setIconStyle,
    setWeekNumbers,
    setSortMode,
    setViewMode,
    SORT_MODES,
    type IconStyle,
    type ViewMode,
  } from '../lib/prefs.svelte'
  import { strings } from '../lib/strings'

  /**
   * Turns a meal on or off for the household.
   *
   * The last one cannot be turned off: a day with no meals is a planner with
   * nothing to plan into. The button goes disabled rather than failing on tap.
   *
   * MEALS order is kept rather than the tap order, so breakfast is always drawn
   * before dinner however they were switched on.
   */
  function toggleMeal(meal: Meal) {
    const on = household.meals.includes(meal)
    if (on && household.meals.length === 1) return

    const next = MEALS.filter((m) => (m === meal ? !on : household.meals.includes(m)))
    void setHouseholdMeals(next)
  }

  const choices: { id: ThemeChoice; label: string }[] = [
    { id: 'system', label: strings.theme.system },
    { id: 'light', label: strings.theme.light },
    { id: 'dark', label: strings.theme.dark },
  ]

  const iconStyles: { id: IconStyle; label: string }[] = [
    { id: 'line', label: strings.prefs.iconsLine },
    { id: 'emoji', label: strings.prefs.iconsEmoji },
    { id: 'inked', label: strings.prefs.iconsInked },
  ]

  const viewModes: { id: ViewMode; label: string }[] = [
    { id: 'grid-4', label: strings.prefs.viewGrid4 },
    { id: 'grid-3', label: strings.prefs.viewGrid3 },
    { id: 'list', label: strings.prefs.viewList },
  ]
</script>

<section class="settings">
  <!-- Its own heading since round 11.1: the top bar that used to name the
       screen is gone, and Settings is the one place with no other landmark. -->
  <h1>{strings.header.settings}</h1>

  <!-- Your household and Google come first: both are set up once and then
       never touched, and burying a first-run step under four display
       preferences is how a first-run step gets missed. You are the first row of
       the household card — round 11.2 folded the separate "You" card into it,
       because editing yourself and editing a child are the same sheet. -->
  {#if auth.status === 'signed-in'}
    <HouseholdCard />
    <GoogleCard />
    <NotifyCard />
    <ShopsCard userId={auth.userId} />
  {/if}

  <div class="card">
    <div class="row stack">
      <div class="text">
        <h2>{strings.theme.title}</h2>
      </div>
      <div class="segmented" role="group" aria-label={strings.theme.title}>
        {#each choices as choice (choice.id)}
          <button
            class="segment"
            class:on={theme.choice === choice.id}
            aria-pressed={theme.choice === choice.id}
            onclick={() => setTheme(choice.id)}
          >
            {choice.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="row stack">
      <div class="text">
        <h2>{strings.prefs.sortTitle}</h2>
        <p>{strings.prefs.sortHint}</p>
      </div>
      <div class="segmented pairs" role="group" aria-label={strings.prefs.sortTitle}>
        {#each SORT_MODES as mode (mode.id)}
          <button
            class="segment"
            class:on={prefs.sortMode === mode.id}
            aria-pressed={prefs.sortMode === mode.id}
            onclick={() => setSortMode(mode.id)}
          >
            {mode.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="row stack">
      <div class="text">
        <h2>{strings.prefs.iconsTitle}</h2>
        <p>{strings.prefs.iconsHint}</p>
      </div>
      <div class="segmented" role="group" aria-label={strings.prefs.iconsTitle}>
        {#each iconStyles as style (style.id)}
          <button
            class="segment"
            class:on={prefs.iconStyle === style.id}
            aria-pressed={prefs.iconStyle === style.id}
            onclick={() => setIconStyle(style.id)}
          >
            {style.label}
          </button>
        {/each}
      </div>
      <!-- OpenMoji is CC BY-SA 4.0 and asks to be credited where it is used.
           See docs/OPENMOJI.md for what that licence does and doesn't require. -->
      <p class="credit">
        <a href="https://openmoji.org" target="_blank" rel="noreferrer">
          {strings.prefs.iconsCredit}
        </a>
      </p>
    </div>

    <div class="row stack">
      <div class="text">
        <h2>{strings.prefs.viewTitle}</h2>
      </div>
      <div class="segmented" role="group" aria-label={strings.prefs.viewTitle}>
        {#each viewModes as mode (mode.id)}
          <button
            class="segment"
            class:on={prefs.viewMode === mode.id}
            aria-pressed={prefs.viewMode === mode.id}
            onclick={() => setViewMode(mode.id)}
          >
            {mode.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="row stack">
      <div class="text">
        <h2>{strings.prefs.askTitle}</h2>
        <p>{strings.prefs.askHint}</p>
      </div>
      <div class="segmented" role="group" aria-label={strings.prefs.askTitle}>
        <button
          class="segment"
          class:on={!prefs.askConfirm}
          aria-pressed={!prefs.askConfirm}
          onclick={() => setAskConfirm(false)}
        >
          {strings.prefs.askOff}
        </button>
        <button
          class="segment"
          class:on={prefs.askConfirm}
          aria-pressed={prefs.askConfirm}
          onclick={() => setAskConfirm(true)}
        >
          {strings.prefs.askOn}
        </button>
      </div>
    </div>

    <div class="row stack">
      <div class="text">
        <h2>{strings.prefs.weeksTitle}</h2>
        <p>{strings.prefs.weeksHint}</p>
      </div>
      <div class="segmented" role="group" aria-label={strings.prefs.weeksTitle}>
        <button
          class="segment"
          class:on={prefs.weekNumbers}
          aria-pressed={prefs.weekNumbers}
          onclick={() => setWeekNumbers(true)}
        >
          {strings.prefs.weeksOn}
        </button>
        <button
          class="segment"
          class:on={!prefs.weekNumbers}
          aria-pressed={!prefs.weekNumbers}
          onclick={() => setWeekNumbers(false)}
        >
          {strings.prefs.weeksOff}
        </button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="row stack">
      <div class="text">
        <h2>{strings.prefs.mealsTitle}</h2>
        <p>{strings.prefs.mealsHint}</p>
      </div>
      <div class="segmented" role="group" aria-label={strings.prefs.mealsTitle}>
        {#each MEALS as meal (meal)}
          {@const on = household.meals.includes(meal)}
          <button
            class="segment"
            class:on
            aria-pressed={on}
            disabled={on && household.meals.length === 1}
            onclick={() => toggleMeal(meal)}
          >
            {MEAL_LABELS[meal]}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="row">
      <div class="text">
        <h2>{strings.settings.installTitle}</h2>
        <p>
          {#if install.installed}
            {strings.settings.installedBody}
          {:else if install.available}
            {strings.settings.availableBody}
          {:else}
            {strings.settings.unavailableBody}
            <strong>{strings.settings.unavailableAction}</strong>.
          {/if}
        </p>
      </div>
      {#if install.available}
        <button class="button" onclick={promptInstall}>{strings.settings.installButton}</button>
      {/if}
    </div>
  </div>

  {#if auth.status === 'signed-in'}
    <div class="card">
      <div class="row">
        <div class="text">
          <h2>{strings.settings.accountTitle}</h2>
          <p>{strings.settings.signedInAs} {auth.email ?? ''}</p>
        </div>
        <button class="button ghost" onclick={signOut}>{strings.auth.signOut}</button>
      </div>
    </div>

    {#if auth.error}
      <p class="error" role="alert">{auth.error}</p>
    {/if}
  {:else}
    <div class="card">
      <div class="row muted">
        <div class="text">
          <h2>{strings.settings.notConnectedTitle}</h2>
          <p>{strings.settings.notConnectedBody}</p>
        </div>
      </div>
      <div class="row muted">
        <div class="text">
          <h2>{strings.settings.householdTitle}</h2>
          <p>{strings.settings.householdBody}</p>
        </div>
      </div>
    </div>
  {/if}

  <p class="version">{strings.settings.version}</p>
</section>

<style>
  .settings h1 {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    letter-spacing: -0.01em;
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    /* Extra room at the bottom so the last card never hugs the nav bar. */
    padding: var(--space-4) var(--space-4) var(--space-6);
  }

  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    min-height: var(--tap-min);
  }

  .row + .row {
    border-top: 1px solid var(--color-border);
  }

  /* A flex item's default min-width is its content's natural width, not 0 — so
     a long unbroken string (an email address, a household name) couldn't
     shrink and pushed the row, and the page, wider than the screen. */
  .text {
    min-width: 0;
  }

  /* The theme picker needs its control under the label, not beside it — three
     segments won't fit next to a heading at 412px. */
  .row.stack {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
  }

  .segment {
    min-height: 2.5rem;
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    transition:
      background var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease);
  }


  /* The licence credit. Quiet, but it has to be visible — see docs/OPENMOJI.md. */
  .credit {
    font-size: var(--text-xs);
  }

  .credit a {
    color: var(--color-text-faint);
    text-decoration: none;
  }

  /* Four options don't fit on one line at 412px, so they go two by two. */
  .segmented.pairs {
    grid-template-columns: repeat(2, 1fr);
  }

  .segment.on {
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }

  .row.muted h2,
  .row.muted p {
    color: var(--color-text-faint);
  }

  h2 {
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    overflow-wrap: anywhere;
  }

  p {
    margin-top: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .button {
    flex: none;
    min-height: var(--tap-min);
    padding: 0 var(--space-5);
    border-radius: var(--radius-full);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .button:active {
    background: var(--color-accent-hover);
  }

  /* Sign out is destructive-ish and shouldn't compete with Install for
     attention, so it gets an outline rather than the filled accent. */
  .button.ghost {
    background: none;
    border: 1px solid var(--color-border-strong);
    color: var(--color-text-muted);
    padding: 0 var(--space-4);
  }

  .button.ghost:active {
    background: var(--color-surface-sunken);
  }

  .error {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-danger);
    font-size: var(--text-sm);
    text-align: center;
  }

  .version {
    text-align: center;
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }
</style>
