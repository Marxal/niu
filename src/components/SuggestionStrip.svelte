<!--
  "You usually need…" — the quiet strip.

  NIU.md §5 is firm about the shape of this: suggestions, never auto-add. So
  every tile here is an ordinary picker tile that puts the item on the list when
  tapped, exactly like the ones below it. Nothing happens on its own.

  It hides itself completely when there is nothing to say — which is most of the
  time, and always for the first few weeks while the app has no idea how often
  anything gets bought. A strip that is empty half the time is worse than one
  that isn't there, because it teaches you to ignore that part of the screen.

  The line underneath says where the guess comes from. That matters more than it
  looks: a suggestion you can't account for is one you stop trusting, and this
  one is only ever "about as long has passed as usually passes".

  **Holding a tile opens the same menu the catalogue's tiles have** (Marçal,
  round 15), with one extra item on it: *stop suggesting this*. That is the
  other half of "suggestions, never auto-add" — the app may say it thinks the
  milk is due, and the household may say it would rather not be told. Without
  it the only way to silence a wrong guess was to hide the item from the
  catalogue entirely, which is a much bigger thing to do to something you buy
  every week.
-->
<script lang="ts">
  import ItemTile from './ItemTile.svelte'
  import type { PickerItem } from '../lib/list-view'
  import { strings } from '../lib/strings'

  let {
    items,
    layout = 'tile',
    onAdd,
    onHold,
  }: {
    items: readonly PickerItem[]
    layout?: 'tile' | 'row'
    onAdd: (catalogueItemId: string) => void
    /** Held down: the screen's tile menu, with "stop suggesting" on it. */
    onHold: (item: PickerItem) => void
  } = $props()
</script>

{#if items.length > 0}
  <section class="strip">
    <h2 class="heading">{strings.shopping.dueTitle}</h2>

    <div class="grid">
      {#each items as item (item.id)}
        <ItemTile
          name={item.name}
          icon={item.icon}
          emoji={item.emoji}
          {layout}
          state="pick"
          onclick={() => onAdd(item.id)}
          onlongpress={() => onHold(item)}
        />
      {/each}
    </div>

    <p class="hint">{strings.shopping.dueHint}</p>
  </section>
{/if}

<style>
  .strip {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    /* Boxed like the trolley is, because it is the same kind of thing: a
       temporary area that isn't part of the list proper. */
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface-sunken);
  }

  .heading {
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--tile-columns, 4), minmax(0, 1fr));
    gap: var(--space-2);
    grid-auto-rows: 1fr;
    align-items: stretch;
  }

  .hint {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }
</style>
