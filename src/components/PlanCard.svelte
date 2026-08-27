<!--
  One thing planned into one meal — and the thing a long press picks up.

  Four kinds, one card, because they all answer the same question ("what are we
  having?") and giving each its own shape would make a day read as four unrelated
  lists:

    dish       its picture, its name, and what it costs you in cooking
    item       a plain catalogue thing — broccoli on a Tuesday
    leftovers  the same dish again, drawn quieter, with the round-again glyph
    out        eating out

  The colour down the left edge is the dish's *first* meal-part tag, exactly as
  it is on a shopping list badge (dishes.ts, dishBadges) — a card is a few
  millimetres of colour and can carry one answer, and the first in the
  household's own tag order is the stable one.

  A repeat is drawn quieter than a cook, and that is the whole visual answer to
  §4.2's "surface the cook-then-repeat rhythm so the plan reads correctly at a
  glance": a week with two lasagne cards where the second is faint reads as one
  cook and one easy night, which is what it is.

  Two marks and they are not the same kind of thing. The **repeat** mark is
  worked out — plan a dish two nights running and the second says so. The **cook**
  mark is set by hand, and that is the point of it: a note you left yourself that
  tonight somebody has to actually do this. See 0011_planner_tweaks.sql.

  The card slides sideways to be thrown away, so it is drawn in two layers: a bin
  that sits still underneath, and the card itself, which is the element the
  gesture moves. Everything visible is in the top layer — otherwise the bin would
  show through the gaps.
-->
<script lang="ts">
  import CookIcon from './CookIcon.svelte'
  import CookMark from './CookMark.svelte'
  import GroceryIcon from './GroceryIcon.svelte'
  import MarkerIcon from './MarkerIcon.svelte'
  import { COOK_LABELS, type Dish, describeDish } from '../lib/dishes'
  import { type DishTag, tagStyle, tagsOf } from '../lib/dish-tags'
  import { type DragSlot, draggable } from '../lib/drag.svelte'
  import type { PlanEntry, Rhythm } from '../lib/plan'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    entry,
    dish = null,
    item = null,
    tags = [],
    rhythm = null,
    size = 'full',
    dragging = false,
    fresh = false,
    onDrop,
    onSwipeAway,
    onclick,
  }: {
    entry: PlanEntry
    /** The dish behind it, when there is one and it still exists. */
    dish?: Dish | null
    /** The catalogue item behind it, for a plain 'item' entry. */
    item?: CatalogueItem | null
    tags?: DishTag[]
    rhythm?: Rhythm | null
    size?: 'full' | 'compact'
    /** True on the copy that follows the finger, and on the original beneath it. */
    dragging?: boolean
    /** Just planted by this phone — plays the arrival flourish once. */
    fresh?: boolean
    onDrop?: ((id: string, slot: DragSlot) => void) | undefined
    onSwipeAway?: ((id: string) => void) | undefined
    onclick?: (() => void) | undefined
  } = $props()

  let repeat = $derived(rhythm === 'repeat' || entry.kind === 'leftovers')

  let colour = $derived(dish ? tagsOf(dish.tagIds, tags)[0]?.colour : undefined)

  let title = $derived.by(() => {
    if (entry.kind === 'out') return strings.plan.out
    if (entry.kind === 'item') return item?.name ?? '—'
    if (entry.kind === 'leftovers') {
      return dish ? strings.plan.leftoversOf(dish.name) : strings.plan.leftovers
    }
    // A dish deleted on the other phone: the row is on its way out by cascade,
    // but a realtime delete can arrive in either order and this must not be blank.
    return dish?.name ?? '—'
  })

  let meta = $derived.by(() => {
    if (entry.note) return entry.note
    if (entry.kind === 'dish' && dish) return describeDish(dish)
    if (entry.kind === 'leftovers') return strings.plan.leftovers
    return ''
  })
</script>

<div class="wrap">
  {#if onSwipeAway}
    <!-- Sits still under the card and is only seen while one is sliding off. -->
    <span class="bin" aria-hidden="true">
      <svg
        width={size === 'full' ? 20 : 16}
        height={size === 'full' ? 20 : 16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </span>
  {/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card {size}"
  class:repeat
  class:lifted={dragging}
  class:fresh
  style={colour ? tagStyle(colour) : undefined}
  class:tinted={colour !== undefined}
  use:draggable={{
    id: entry.id,
    onDrop: onDrop ?? (() => {}),
    onSwipeAway,
    enabled: onDrop !== undefined,
  }}
>
  <button class="hit" {onclick} disabled={onclick === undefined}>
    <span class="glyph">
      {#if entry.kind === 'out' || (entry.kind === 'leftovers' && !dish)}
        <MarkerIcon kind={entry.kind === 'out' ? 'out' : 'leftovers'} size={size === 'full' ? 22 : 18} />
      {:else if entry.kind === 'item'}
        <GroceryIcon
          icon={item?.icon ?? null}
          emoji={item?.emoji ?? null}
          name={item?.name ?? '?'}
          size={size === 'full' ? 24 : 18}
        />
      {:else}
        <GroceryIcon icon={dish?.icon ?? null} name={dish?.name ?? '?'} size={size === 'full' ? 24 : 18} />
      {/if}
    </span>

    <span class="text">
      <span class="name">{title}</span>
      {#if size === 'full' && meta !== ''}
        <span class="meta">
          {#if entry.kind === 'dish' && dish && dish.cook !== 'none' && !entry.note}
            <span class="cook" title={COOK_LABELS[dish.cook]}><CookIcon cook={dish.cook} size={14} /></span>
          {/if}
          {meta}
        </span>
      {/if}
    </span>

    <span class="marks">
      {#if entry.toCook}
        <span class="cook-mark" title={strings.plan.toCookTitle}>
          <CookMark size={size === 'full' ? 17 : 14} />
        </span>
      {/if}
      {#if repeat}
        <span class="again" title={strings.plan.againTitle}>
          <MarkerIcon kind="leftovers" size={size === 'full' ? 16 : 13} />
        </span>
      {/if}
    </span>
  </button>
</div>
</div>

<style>
  /* The two layers a swipe needs: the bin stays, the card moves over it. */
  .wrap {
    position: relative;
    border-radius: var(--radius-md);
  }

  .bin {
    position: absolute;
    inset: 0;
    z-index: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-need-soft);
    color: var(--color-need);
    /* Never in the way of the card's own gestures, or of elementFromPoint
       looking for a drop target underneath a dragged copy. */
    pointer-events: none;
  }

  .card {
    position: relative;
    z-index: 1;
    /* The colour bar is a border rather than a pseudo-element so a card with no
       dish (eating out) simply has no bar, with nothing to switch off. */
    border-left: var(--space-1) solid transparent;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-1);
    overflow: hidden;
    /* Stops Chrome offering to select the name or open its own menu on a long
       press, which would cancel the drag before it starts. */
    -webkit-touch-callout: none;
  }

  .card.tinted {
    border-left-color: var(--tag-ink);
    background: var(--tag-fill);
  }

  /* The original, while its copy is under the finger. Left in place so the day
     it came from keeps its height — see drag.svelte.ts. */
  .card.lifted {
    opacity: 0.35;
  }

  .hit {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--tap-min);
    padding: var(--space-2) var(--space-3);
    text-align: left;
  }

  .compact .hit {
    gap: var(--space-2);
    min-height: 2.25rem;
    padding: var(--space-1) var(--space-2);
  }

  .hit:disabled {
    cursor: default;
  }

  .glyph {
    display: grid;
    flex: none;
    place-items: center;
    color: var(--color-text-muted);
  }

  .tinted .glyph {
    color: var(--tag-ink);
  }

  .text {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 1px;
  }

  .name {
    overflow: hidden;
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    line-height: var(--leading-tight);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact .name {
    font-size: var(--text-xs);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cook {
    display: grid;
    flex: none;
    place-items: center;
  }

  /* A repeat is the same food a second time, so it is the same card with less
     of it: quieter, and marked. */
  .repeat .name {
    font-weight: var(--weight-regular);
  }

  .repeat.card {
    background: var(--color-surface-sunken);
    box-shadow: none;
  }

  .repeat.tinted.card {
    background: transparent;
    border: 1px dashed var(--color-border-strong);
    border-left: var(--space-1) solid var(--tag-ink);
  }

  .marks {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-1);
    margin-left: auto;
  }

  .again {
    display: grid;
    place-items: center;
    color: var(--color-text-faint);
  }

  /* Louder than the repeat mark, and deliberately so: a repeat is the app
     noticing something, and this is a person having asked for it. */
  .cook-mark {
    display: grid;
    place-items: center;
    color: var(--color-tab-meals);
  }

  /*
    The arrival flourish. It plays once, on the card this phone just planted, so
    that adding something from a sheet that then closes doesn't look like nothing
    happened — especially when the new card lands below the fold of a full day.
  */
  .card.fresh {
    animation: land 420ms ease-out;
  }

  @keyframes land {
    0% {
      transform: scale(0.9);
      opacity: 0;
    }
    55% {
      transform: scale(1.03);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card.fresh {
      animation: none;
    }
  }
</style>
