<!--
  "What can we make?" — the shop → plan direction, given a screen of its own.

  The same scoring appears quietly inside the picker when you tap a meal. This is
  the version you go looking for: you have just shopped, or you are staring at a
  full fridge on a Wednesday, and the question is not "what shall we have on
  Thursday" but "what have we got".

  What it is careful not to claim: this is **not** a guess at what is in the
  house. NIU.md §5 files that under stock inference and defers it, for the good
  reason that it needs months of data and a wrong answer is worse than none.
  This says only what it can prove — on the list now, or bought in the last few
  days — and the line under the heading says exactly that, because a suggestion
  nobody believes is worse than no suggestion.

  Tapping one plans it into the day and meal you were looking at, which is why
  this sheet is opened from the planner and not from the shopping tab.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import TagChip from './TagChip.svelte'
  import { type DishTag, tagsOf } from '../lib/dish-tags'
  import { MEAL_LABELS, type Meal } from '../lib/plan'
  import type { Makeable } from '../lib/plannable'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    makeable,
    tags,
    itemsById,
    targetLabel,
    meals,
    onPlan,
    onClose,
  }: {
    makeable: Makeable[]
    tags: DishTag[]
    itemsById: ReadonlyMap<string, CatalogueItem>
    /** Which day it will land on, said in words. */
    targetLabel: string
    /** The household's meals, so you can say which one. */
    meals: readonly Meal[]
    onPlan: (dishId: string, meal: Meal) => void
    onClose: () => void
  } = $props()

  /** Which row has its meal buttons open. One at a time. */
  let choosing = $state<string | null>(null)

  function missingNames(row: Makeable): string {
    return row.missing
      .map((id) => itemsById.get(id)?.name)
      .filter((name): name is string => Boolean(name))
      .join(', ')
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.plan.makeableTitle}>
  <header>
    <div>
      <h2>{strings.plan.makeableTitle}</h2>
      <p>{strings.plan.makeableHint}</p>
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

  <div class="scroller">
    {#if makeable.length === 0}
      <p class="none">{strings.plan.makeableNone}</p>
    {:else}
      <div class="rows">
        {#each makeable as row (row.dish.id)}
          <div class="card" class:open={choosing === row.dish.id}>
            <button
              class="top"
              onclick={() => (choosing = choosing === row.dish.id ? null : row.dish.id)}
            >
              <span class="glyph"><GroceryIcon icon={row.dish.icon} name={row.dish.name} size={26} /></span>
              <span class="text">
                <span class="name">
                  {row.dish.name}
                  {#each tagsOf(row.dish.tagIds, tags) as tag (tag.id)}
                    <TagChip {tag} size="dot" />
                  {/each}
                </span>
                <span class="score" class:full={row.missing.length === 0}>
                  {row.missing.length === 0
                    ? strings.plan.haveAll
                    : `${strings.plan.haveSome(row.have, row.total)} — ${missingNames(row)}`}
                </span>
              </span>
              <span class="bar" aria-hidden="true">
                <span class="fill" style={`height: ${Math.round(row.coverage * 100)}%`}></span>
              </span>
            </button>

            {#if choosing === row.dish.id}
              <div class="meals">
                <span class="into">{targetLabel}</span>
                {#each meals as meal (meal)}
                  <button class="meal" onclick={() => onPlan(row.dish.id, meal)}>
                    {MEAL_LABELS[meal]}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

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
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--space-3);
    max-height: 80vh;
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
    max-width: 26rem;
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

  .scroller {
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    overflow: hidden;
  }

  .card.open {
    border-color: var(--color-tab-meals);
  }

  .top {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--tap-min);
    padding: var(--space-2) var(--space-3);
    text-align: left;
  }

  .glyph {
    display: grid;
    flex: none;
    place-items: center;
    color: var(--color-text-muted);
  }

  .text {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    overflow: hidden;
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    white-space: nowrap;
  }

  .score {
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .score.full {
    color: var(--color-pick);
    font-weight: var(--weight-bold);
  }

  /* A bar rather than a percentage: the number is already spelled out to the
     left, and the bar is what makes the list scannable at a glance.

     It fills from the bottom, so the height *is* the fraction — which is the
     whole point, and which it was not the first time round: the fill was sized
     by width on a 3px-wide bar, so every dish looked complete. */
  .bar {
    display: flex;
    flex: none;
    width: 3px;
    align-self: stretch;
    justify-content: stretch;
    align-items: flex-end;
    border-radius: var(--radius-full);
    background: var(--color-border);
  }

  .fill {
    display: block;
    width: 100%;
    border-radius: var(--radius-full);
    background: var(--color-pick);
  }

  .meals {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3) var(--space-3);
    border-top: 1px solid var(--color-border);
  }

  .into {
    margin-right: auto;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .meal {
    min-height: 2.5rem;
    padding: 0 var(--space-4);
    border-radius: var(--radius-full);
    background: var(--color-tab-meals);
    color: var(--color-accent-ink);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }
</style>
