<!--
  "What are we having?" — the sheet a meal's + button opens.

  Four things can go into a meal and all four are offered here, in the order you
  are likely to want them:

    1. dishes you have most of already — the shop → plan direction, at the exact
       moment it is useful
    2. the rest of the library, what this household plans most first (§4.2)
    3. a plain catalogue item, because "broccoli on Tuesday" is a complete
       thought and shouldn't need a dish written for it first (§4.2)
    4. leftovers, or eating out

  Group 1 is the round-10 idea and it is worth being precise about what it
  claims. It does *not* say what is in your cupboards — that is stock inference,
  and NIU.md §5 defers it for good reasons. It says: of this dish's ingredients,
  this many are on your shopping list right now or were bought in the last few
  days. See plannable.ts. Every dish with ingredients carries that count, in
  every group, so the ordering never has to be taken on trust.

  The search box searches both halves at once. Typing "brocc" should find the
  broccoli whether you were after the vegetable or a dish made of it, and asking
  the user which of two indexes to look in is asking them to do the work.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import ItemTile from './ItemTile.svelte'
  import MarkerIcon from './MarkerIcon.svelte'
  import TagChip from './TagChip.svelte'
  import { type Dish, filterDishes, sortDishes } from '../lib/dishes'
  import { type DishTag, tagsOf } from '../lib/dish-tags'
  import { type PickerItem, matchesSearch, suggestedPicks } from '../lib/list-view'
  import { MEAL_LABELS, type Meal } from '../lib/plan'
  import { MAKEABLE_FLOOR, type Pantry, scoreDish } from '../lib/plannable'
  import type { PlanTarget } from '../lib/plan.svelte'
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
    onPick: (target: PlanTarget) => void
    onNewDish: () => void
    onClose: () => void
  } = $props()

  /** Enough to thumb through; past that, type. Same number the ingredient picker uses. */
  const MAX_ITEMS = 18

  let query = $state('')
  let trimmed = $derived(query.trim())
  let searching = $derived(trimmed !== '')

  let matching = $derived(searching ? filterDishes(library, trimmed) : sortDishes(library))

  /**
   * The library, split by whether the ingredients are to hand.
   *
   * Sorted within the first group by how complete it is, and within the second
   * by how often this household plans it — "most-used" (§4.2), which is
   * times_planned rather than times_added: planning a dish and shopping for it
   * are different events (0010_meal_plan.sql).
   */
  let scored = $derived(
    matching.map((dish) => ({ dish, score: scoreDish(dish, pantry) })),
  )

  let haveMost = $derived(
    scored
      .filter((row) => row.score !== null && row.score.coverage >= MAKEABLE_FLOOR)
      .sort((a, b) => (b.score?.coverage ?? 0) - (a.score?.coverage ?? 0)),
  )

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

  /** Plain catalogue things: what matches, or the usual suspects. */
  let items = $derived.by<PickerItem[]>(() => {
    if (!searching) return suggestedPicks(shopping.picker, new Set(), 8)
    return shopping.picker
      .filter((item) => matchesSearch(item.name, trimmed))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, MAX_ITEMS)
  })

  let nothing = $derived(searching && haveMost.length === 0 && rest.length === 0 && items.length === 0)

  function coverage(score: ReturnType<typeof scoreDish>): string {
    if (!score) return ''
    if (score.have === score.total) return strings.plan.haveAll
    return strings.plan.haveSome(score.have, score.total)
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

  <div class="scroller">
    {#if nothing}
      <p class="none">{strings.plan.pickNone}</p>
    {/if}

    {#if haveMost.length > 0}
      <section>
        <h3>{strings.plan.makeableTitle}</h3>
        <p class="why">{strings.plan.haveFrom}</p>
        <div class="rows">
          {#each haveMost as row (row.dish.id)}
            {@render dishRow(row.dish, row.score)}
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
        <div class="rows">
          {#each rest as row (row.dish.id)}
            {@render dishRow(row.dish, row.score)}
          {/each}
        </div>
      {/if}
      <button class="new" onclick={onNewDish}>
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
    </section>

    <section>
      <h3>{strings.plan.pickItems}</h3>
      <div class="rows">
        {#each items as item (item.id)}
          <ItemTile
            name={item.name}
            icon={item.icon}
            emoji={item.emoji}
            layout="row"
            state="pick"
            onclick={() => onPick({ kind: 'item', itemId: item.id })}
          />
        {/each}
      </div>
    </section>

    <section>
      <h3>{strings.plan.pickMarkers}</h3>
      <div class="markers">
        <button onclick={() => onPick({ kind: 'leftovers', dishId: null })}>
          <MarkerIcon kind="leftovers" />
          {strings.plan.leftovers}
        </button>
        <button onclick={() => onPick({ kind: 'out' })}>
          <MarkerIcon kind="out" />
          {strings.plan.out}
        </button>
      </div>
    </section>
  </div>
</div>

{#snippet dishRow(dish: Dish, score: ReturnType<typeof scoreDish>)}
  <button class="dish" onclick={() => onPick({ kind: 'dish', dishId: dish.id })}>
    <span class="glyph"><GroceryIcon icon={dish.icon} name={dish.name} size={24} /></span>
    <span class="text">
      <span class="name">{dish.name}</span>
      {#if score}
        <span class="score" class:full={score.have === score.total}>{coverage(score)}</span>
      {/if}
    </span>
    <span class="chips">
      {#each tagsOf(dish.tagIds, tags) as tag (tag.id)}
        <TagChip {tag} size="dot" />
      {/each}
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
    /* Header and search stay put; only the choices scroll. Half this sheet is
       under the keyboard as soon as anyone types. */
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: var(--space-3);
    max-height: 82vh;
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
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

  .scroller {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    overflow-y: auto;
    overscroll-behavior: contain;
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

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .dish {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap-min);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-pick-border);
    border-radius: var(--radius-md);
    background: var(--color-pick-soft);
    text-align: left;
  }

  .dish:active {
    transform: scale(0.99);
  }

  .glyph {
    display: grid;
    flex: none;
    place-items: center;
    color: var(--color-pick);
  }

  .text {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
  }

  .name {
    overflow: hidden;
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .score {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }

  .score.full {
    color: var(--color-pick);
    font-weight: var(--weight-bold);
  }

  .chips {
    display: flex;
    flex: none;
    gap: var(--space-1);
  }

  .markers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .markers button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .markers button:active {
    background: var(--color-surface-sunken);
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
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .none {
    padding: var(--space-3) var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
</style>
