<!--
  One dish in the library, as a tile in a grid of three.

  Round 8 made these rows, on the argument that a dish has three facts worth
  showing and a grid tile has room for none of them. That was right about the
  facts and wrong about the form: a library is something you *recognise* your
  way around — you know what lasagne looks like — and a column of near-identical
  rows makes you read twenty names to find it.

  So the tile shows the three facts as pictures instead of words:

    the dish's own glyph, large — the thing you actually recognise
    the card in the colour of its first part-of-a-meal tag, and a dot per tag
    the glyphs of what it is made of, along the bottom
    how much cooking it is, in the corner

  Three across rather than four: the ingredient strip needs about five glyphs to
  be worth having, and at four across there is room for three.

  The name is still words, and still the thing a screen reader gets first.
-->
<script lang="ts">
  import CookIcon from './CookIcon.svelte'
  import GroceryIcon from './GroceryIcon.svelte'
  import { type Dish, COOK_LABELS, describeDish } from '../lib/dishes'
  import { type DishTag, DEFAULT_TAG_COLOUR, tagStyle, tagsOf } from '../lib/dish-tags'
  import { shopping } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    dish,
    tags,
    onclick,
  }: {
    dish: Dish
    /** The household's tags, to resolve this dish's ids against. */
    tags: DishTag[]
    onclick: () => void
  } = $props()

  /** Beyond this the glyphs are too small to tell apart at tile width. */
  const MAX_INGREDIENTS = 5

  let mine = $derived(tagsOf(dish.tagIds, tags))
  let colour = $derived(mine[0]?.colour ?? DEFAULT_TAG_COLOUR)

  // An id with no catalogue item behind it is dropped rather than drawn as a
  // question mark: it means the item was hidden for good or removed on the
  // other phone, and neither is worth a mark on the tile.
  let ingredients = $derived(
    dish.itemIds.flatMap((id) => {
      const item = shopping.byId.get(id)
      return item ? [item] : []
    }),
  )

  let shown = $derived(ingredients.slice(0, MAX_INGREDIENTS))
  let extra = $derived(ingredients.length - shown.length)
</script>

<button
  class="card"
  class:untagged={mine.length === 0}
  style={tagStyle(colour)}
  {onclick}
  aria-label="{dish.name} — {describeDish(dish)}"
>
  <!-- Corner, not in the stack: it is a footnote about the dish, and it only
       appears once someone has actually said — "no cook" is the default nobody
       chose. -->
  {#if dish.cook !== 'none'}
    <span class="cook" title={COOK_LABELS[dish.cook]}><CookIcon cook={dish.cook} size={14} /></span>
  {/if}

  <span class="glyph"><GroceryIcon icon={dish.icon} name={dish.name} size={30} /></span>

  <span class="name">{dish.name}</span>

  {#if mine.length > 0}
    <span class="tags">
      {#each mine as tag (tag.id)}
        <span class="dot" style={tagStyle(tag.colour)} title={tag.name}></span>
      {/each}
    </span>
  {/if}

  {#if shown.length > 0}
    <span class="made-of" title={strings.dishes.itemCount(ingredients.length)}>
      {#each shown as item (item.id)}
        <span class="ingredient"><GroceryIcon icon={item.icon} emoji={item.emoji} name={item.name} size={13} /></span>
      {/each}
      {#if extra > 0}<span class="more">+{extra}</span>{/if}
    </span>
  {:else}
    <span class="made-of empty">{strings.dishes.noItems}</span>
  {/if}
</button>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    height: 100%;
    min-height: 7.5rem;
    padding: var(--space-3) var(--space-2) var(--space-2);
    border: 1px solid var(--tag-ink);
    border-radius: var(--radius-md);
    background: var(--tag-fill);
    color: var(--tag-ink);
    text-align: center;
    transition: transform var(--dur-fast) var(--ease);
  }

  /* A dish nobody has filed is not wrong, so it is not shouted at: it drops back
     to the ordinary card colours rather than wearing a colour it didn't choose. */
  .card.untagged {
    border-color: var(--color-border);
    background: var(--color-surface);
    color: var(--color-tab-meals);
  }

  .card:active {
    transform: scale(0.96);
  }

  .cook {
    position: absolute;
    top: var(--space-1);
    left: var(--space-1);
    display: grid;
    place-items: center;
    opacity: 0.65;
  }

  .glyph {
    display: grid;
    place-items: center;
    height: 1.875rem;
  }

  .name {
    color: var(--color-text);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    line-height: var(--leading-tight);
    /* Two lines then ellipsis, so a long name can't stretch its neighbours. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .tags {
    display: flex;
    gap: var(--space-1);
  }

  .dot {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--tag-ink);
  }

  /* Pushed to the bottom so the strip lines up across a row of tiles even when
     one name wraps to two lines and its neighbour doesn't. */
  .made-of {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1px;
    margin-top: auto;
    padding-top: var(--space-1);
    color: var(--color-text-muted);
    opacity: 0.85;
  }

  .ingredient {
    display: grid;
    place-items: center;
  }

  .more,
  .made-of.empty {
    font-size: 0.625rem;
    font-weight: var(--weight-medium);
  }

  .made-of.empty {
    color: var(--color-text-faint);
    font-style: italic;
    opacity: 1;
  }
</style>
