<!--
  "What are we having?" — the sheet a meal's + button opens.

  ## The shape, and why it is this way round

  Top: the three answers that need no browsing at all — **Eating out**,
  **Leftovers**, and **Cook it**. The first two plant a card and close the sheet.
  The third is not a thing you add; it is a *toggle* that stays on while you pick,
  so whatever you choose next arrives already marked as one somebody has to cook
  (Marçal, round 10.1).

  Middle, scrolling: three grids of tiles, in the order you are likely to want
  them.

    1. what you can make from what you already have — the shop → plan direction,
       at the exact moment it is useful
    2. the rest of the library, what this household plans most first (§4.2)
    3. **recently bought** — the things that came home on Saturday, which is what
       you are actually choosing between when you look at Tuesday on a Sunday
       evening. A plain catalogue thing can be planned directly, because
       "broccoli on Tuesday" is a complete thought and shouldn't need a dish
       written for it first (§4.2). Typing turns this group into ordinary
       catalogue search, so anything at all is still reachable.

  Bottom, pinned: the search box and **New dish**. They are last because they are
  the fallbacks — if what you wanted was on screen you never reach them, and a
  search field at the top of a sheet invites typing before looking. Pinning them
  means they are still one thumb-stretch away from wherever you have scrolled to.

  Tiles rather than rows since round 10.1. A library is something you recognise
  your way around rather than read — the same argument that made the dish library
  a grid in round 9 — and three across shows nine dishes in the space six rows
  took.

  On the coverage numbers: they do *not* claim to know your cupboards. See
  plannable.ts. Every dish that has ingredients carries its count in every group,
  so the ordering never has to be taken on trust.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import CookMark from './CookMark.svelte'
  import MarkerIcon from './MarkerIcon.svelte'
  import TagChip from './TagChip.svelte'
  import { type Dish, filterDishes, sortDishes } from '../lib/dishes'
  import { type DishTag, tagsOf } from '../lib/dish-tags'
  import { type PickerItem, matchesSearch } from '../lib/list-view'
  import { learning } from '../lib/learning.svelte'
  import { MEAL_LABELS, type Meal } from '../lib/plan'
  import { MAKEABLE_FLOOR, type Pantry, recentlyBought, scoreDish } from '../lib/plannable'
  import type { PlanOptions, PlanTarget } from '../lib/plan.svelte'
  import { shopping } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    meal,
    dayLabel,
    library,
    tags,
    pantry,
    onPick,
    onNewDish,
    onClose,
  }: {
    meal: Meal
    /** "Thursday", "Today" — whichever the day view is calling it. */
    dayLabel: string
    library: Dish[]
    tags: DishTag[]
    pantry: Pantry
    onPick: (target: PlanTarget, options: PlanOptions) => void
    onNewDish: (options: PlanOptions) => void
    onClose: () => void
  } = $props()

  /** Enough to thumb through; past that, type. */
  const MAX_ITEMS = 24

  let query = $state('')
  /** Sticky while you pick. See the header. */
  let toCook = $state(false)

  let trimmed = $derived(query.trim())
  let searching = $derived(trimmed !== '')

  let matching = $derived(searching ? filterDishes(library, trimmed) : sortDishes(library))

  let scored = $derived(matching.map((dish) => ({ dish, score: scoreDish(dish, pantry) })))

  let haveMost = $derived(
    scored
      .filter((row) => row.score !== null && row.score.coverage >= MAKEABLE_FLOOR)
      .sort((a, b) => (b.score?.coverage ?? 0) - (a.score?.coverage ?? 0)),
  )

  /**
   * The rest of the library, ordered by what this household plans most —
   * `timesPlanned` rather than `timesAdded`, because planning a dish and shopping
   * for it are different events (0010_meal_plan.sql).
   */
  let rest = $derived(
    scored
      .filter((row) => !haveMost.includes(row))
      .sort(
        (a, b) =>
          b.dish.timesPlanned - a.dish.timesPlanned ||
          b.dish.timesAdded - a.dish.timesAdded ||
          a.dish.name.localeCompare(b.dish.name),
      ),
  )

  /**
   * Idle: what this household bought most recently. Searching: the catalogue.
   *
   * Two different questions sharing one strip, which is why the heading changes
   * with it — a list headed "Recently bought" that quietly turns into search
   * results would be lying about where its contents came from.
   */
  let items = $derived.by<PickerItem[]>(() => {
    if (!searching) {
      return recentlyBought(learning.stats, 9).flatMap((id) => {
        const item = shopping.picker.find((row) => row.id === id)
        return item ? [item] : []
      })
    }
    return shopping.picker
      .filter((item) => matchesSearch(item.name, trimmed))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, MAX_ITEMS)
  })

  let nothing = $derived(
    searching && haveMost.length === 0 && rest.length === 0 && items.length === 0,
  )

  let options = $derived<PlanOptions>({ toCook })

  function coverage(score: ReturnType<typeof scoreDish>): string {
    if (!score) return ''
    if (score.have === score.total) return strings.plan.haveAll
    return `${score.have}/${score.total}`
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.plan.pickTitle}>
  <header>
    <div>
      <h2>{strings.plan.pickTitle}</h2>
      <p>{strings.plan.pickHint(MEAL_LABELS[meal], dayLabel)}</p>
    </div>
    <button class="close" onclick={onClose} aria-label={strings.shopping.close}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </header>

  <div class="quick">
    <button onclick={() => onPick({ kind: 'out' }, options)}>
      <MarkerIcon kind="out" size={18} />
      {strings.plan.out}
    </button>
    <button onclick={() => onPick({ kind: 'leftovers', dishId: null }, options)}>
      <MarkerIcon kind="leftovers" size={18} />
      {strings.plan.leftovers}
    </button>
    <button class="toggle" class:on={toCook} aria-pressed={toCook} onclick={() => (toCook = !toCook)}>
      <CookMark size={18} />
      {strings.plan.toCook}
    </button>
  </div>

  {#if toCook}
    <p class="cook-hint">{strings.plan.pickCookHint}</p>
  {/if}

  <!-- While a search is running the results hug the field below them rather
       than starting at the top of a tall box (Marçal, round 14). Two matches
       otherwise sit half a screen above the keyboard with nothing in between. -->
  <div class="scroller" class:searching>
    {#if nothing}
      <p class="none">{strings.plan.pickNone}</p>
    {/if}

    {#if haveMost.length > 0}
      <section>
        <h3>{strings.plan.makeableTitle}</h3>
        <p class="why">{strings.plan.haveFrom}</p>
        <div class="grid">
          {#each haveMost as row (row.dish.id)}
            {@render dishTile(row.dish, row.score, true)}
          {/each}
        </div>
      </section>
    {/if}

    <section>
      <h3>{strings.plan.pickDishes}</h3>
      {#if library.length === 0}
        <p class="none">{strings.plan.pickEmptyLibrary}</p>
      {:else if rest.length === 0 && !searching}
        <p class="none">{strings.plan.haveAll}</p>
      {:else}
        <div class="grid">
          {#each rest as row (row.dish.id)}
            {@render dishTile(row.dish, row.score, false)}
          {/each}
        </div>
      {/if}
    </section>

    <section>
      <h3>{searching ? strings.plan.pickItemsSearch : strings.plan.pickItems}</h3>
      <div class="grid">
        {#each items as item (item.id)}
          <button
            class="tile thing"
            onclick={() => onPick({ kind: 'item', itemId: item.id }, options)}
          >
            <span class="glyph">
              <GroceryIcon icon={item.icon} emoji={item.emoji} name={item.name} size={26} />
            </span>
            <span class="name">{item.name}</span>
          </button>
        {/each}
      </div>
    </section>
  </div>

  <div class="foot">
    <input
      type="search"
      bind:value={query}
      placeholder={strings.plan.pickSearch}
      aria-label={strings.plan.pickSearch}
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      enterkeyhint="search"
    />
    <button class="new" onclick={() => onNewDish(options)}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {strings.plan.newDish}
    </button>
  </div>
</div>

{#snippet dishTile(dish: Dish, score: ReturnType<typeof scoreDish>, ready: boolean)}
  <button
    class="tile dish"
    class:ready
    onclick={() => onPick({ kind: 'dish', dishId: dish.id }, options)}
  >
    <span class="glyph"><GroceryIcon icon={dish.icon} name={dish.name} size={26} /></span>
    <span class="name">{dish.name}</span>
    <span class="foot-row">
      {#each tagsOf(dish.tagIds, tags) as tag (tag.id)}
        <TagChip {tag} size="dot" />
      {/each}
      {#if score}
        <span class="score" class:full={score.have === score.total}>{coverage(score)}</span>
      {/if}
    </span>
  </button>
{/snippet}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-sheet);
    background: var(--color-overlay);
  }

  .sheet {
    position: fixed;
    inset: auto 0 0 0;
    z-index: var(--z-sheet);
    display: grid;
    /* Header, the three quick answers, the scrolling grids, then the pinned
       search and New dish. Only the middle row moves. */
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    gap: var(--space-3);
    max-height: 86vh;
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
    background: var(--color-surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-2);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  header p {
    margin-top: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .close {
    display: grid;
    flex: none;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    margin-right: calc(var(--space-2) * -1);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
  }

  .quick {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .quick button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .quick button:active {
    background: var(--color-surface-sunken);
  }

  /* The odd one out, and it looks it: the other two do something and close, this
     one stays on and changes what the next tap means. */
  .quick .toggle.on {
    border-color: var(--color-tab-meals);
    background: var(--color-tab-meals);
    color: var(--color-accent-ink);
  }

  .cook-hint {
    margin-top: calc(var(--space-2) * -1);
    color: var(--color-tab-meals);
    font-size: var(--text-xs);
  }

  .scroller {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* `margin-top: auto` on the first child rather than `justify-content: end` on
     the box: with an overflowing flex column, end-justification pushes the top
     of the content past the scroll origin and makes it unreachable. An auto
     margin collapses to nothing as soon as the content is taller than the box,
     so short results sink and long ones still scroll from the top. */
  .scroller.searching > :first-child {
    margin-top: auto;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  h3 {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .why {
    margin-top: calc(var(--space-1) * -1);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  /* Three across, rows sized to the tallest tile in them so a two-line name
     can't leave its neighbours short — same rule as the shopping grid. */
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    grid-auto-rows: 1fr;
    align-items: stretch;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    min-height: 5.25rem;
    padding: var(--space-2) var(--space-1);
    border: 1px solid var(--color-pick-border);
    border-radius: var(--radius-md);
    background: var(--color-pick-soft);
    color: var(--color-text);
    text-align: center;
  }

  .tile:active {
    transform: scale(0.97);
  }

  /* Everything you have the ingredients for, marked as such — the tile itself
     says it, not only the number in the corner. */
  .tile.ready {
    border-color: var(--color-pick);
  }

  .glyph {
    display: grid;
    place-items: center;
    color: var(--color-pick);
  }

  .name {
    display: -webkit-box;
    overflow: hidden;
    font-size: var(--text-xs);
    line-height: var(--leading-tight);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .foot-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-top: auto;
    padding-top: var(--space-1);
  }

  .score {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .score.full {
    color: var(--color-pick);
    font-weight: var(--weight-bold);
  }

  .foot {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border);
  }

  input {
    width: 100%;
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--text-base);
  }

  .new {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    border-radius: var(--radius-full);
    background: var(--color-tab-meals);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }

  .none {
    padding: var(--space-3) var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
</style>
