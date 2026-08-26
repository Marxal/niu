<!--
  The little marks on a shopping row that say which dish asked for it.

  "When ingredients are entered via a dish, add a small tag saying which dish it
  belongs to. If several dishes share an ingredient, add both." The hard part is
  that a grid tile at four-across is about eighty pixels wide, so the badge
  cannot be the dish's name — it is the dish's own picture, in the colour of the
  first part-of-a-meal tag it carries.

  That picture is doing double duty on purpose: it is the same glyph the dish
  wears in the library and in the Dishes category, so the connection is one you
  recognise rather than one you read. The name is still there for anyone who
  needs it — as the tooltip, and as the accessible label.

  In row layout there is room for the first name in words, so it says it.

  Spans, never buttons: this renders inside the tile's own <button>, and a
  button inside a button is invalid HTML that browsers quietly reparent.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import type { DishBadge } from '../lib/dishes'
  import { tagStyle } from '../lib/dish-tags'
  import { strings } from '../lib/strings'

  let {
    badges,
    layout = 'tile',
  }: {
    badges: DishBadge[]
    layout?: 'tile' | 'row'
  } = $props()

  /** Past this many, the badges are wider than the tile they sit on. */
  const MAX = 3

  let shown = $derived(badges.slice(0, MAX))
  let extra = $derived(badges.length - shown.length)
</script>

<span class="badges {layout}">
  {#each shown as badge (badge.id)}
    <span
      class="badge"
      style={tagStyle(badge.colour)}
      title={strings.dishes.forDish(badge.name)}
      role="img"
      aria-label={strings.dishes.forDish(badge.name)}
    >
      <GroceryIcon icon={badge.icon} name={badge.name} size={14} />
      {#if layout === 'row'}<span class="name">{badge.name}</span>{/if}
    </span>
  {/each}
  {#if extra > 0}
    <span class="more">+{extra}</span>
  {/if}
</span>

<style>
  .badges {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    max-width: 100%;
    min-width: 0;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    padding: 1px var(--space-1);
    border: 1px solid var(--tag-ink);
    border-radius: var(--radius-sm);
    background: var(--tag-fill);
    color: var(--tag-ink);
  }

  .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 0.6875rem;
    font-weight: var(--weight-medium);
    line-height: var(--leading-tight);
  }

  .more {
    color: var(--color-text-faint);
    font-size: 0.6875rem;
    font-weight: var(--weight-medium);
  }

  /* Only the first badge gets to be wide in a row; the rest stay glyph-sized so
     three dishes can't push the quantity off the end. */
  .badges.row .badge:not(:first-child) .name {
    display: none;
  }
</style>
