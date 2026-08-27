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
-->
<script lang="ts">
  import CookIcon from './CookIcon.svelte'
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
    onDrop,
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
    onDrop?: ((id: string, slot: DragSlot) => void) | undefined
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card {size}"
  class:repeat
  class:lifted={dragging}
  style={colour ? tagStyle(colour) : undefined}
  class:tinted={colour !== undefined}
  use:draggable={{ id: entry.id, onDrop: onDrop ?? (() => {}), enabled: onDrop !== undefined }}
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

    {#if repeat}
      <span class="again" title={strings.plan.againTitle}>
        <MarkerIcon kind="leftovers" size={size === 'full' ? 16 : 13} />
      </span>
    {/if}
  </button>
</div>

<style>
  .card {
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

  .again {
    display: grid;
    flex: none;
    margin-left: auto;
    place-items: center;
    color: var(--color-text-faint);
  }
</style>
