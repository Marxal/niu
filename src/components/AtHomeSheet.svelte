<!--
  "What's home" — what the household has probably got in, from what it has
  bought.

  This is the nearest the app comes to §5's deferred stock inference, and it is
  careful to be the honest half of it. It does **not** model shelf life: a fish
  and a bag of rice bought on the same Saturday are treated identically, because
  nothing here knows which is which and inventing a difference would be inventing
  data. What it does have is each item's own purchase rhythm, learnt since round
  7, which is a real fact about this household.

  Hence two bands rather than one line, and the second one is the point:

    Bought this week   bought in the last few days. Barely a guess.
    Double-check       bought longer ago, but not yet as long ago as you usually
                       leave between buying it. Might be there.

  One cut-off would have been more confident and less true. And the tap on a
  double-check row — "out of it, add to the list" — is not a convenience bolted
  on the side: §5 says the *correction* is the half that eventually teaches the
  shelf-life guess. This is where those corrections would come from.

  Nothing here is ever automatic. Every row is a statement the user can disagree
  with in one tap.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import type { AtHomeItem } from '../lib/plannable'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    items,
    itemsById,
    busyId = null,
    onAddToList,
    onClose,
  }: {
    /** Already ordered, freshest first — see atHomeItems(). */
    items: AtHomeItem[]
    itemsById: ReadonlyMap<string, CatalogueItem>
    /** The row waiting on a write, so it can't be tapped twice. */
    busyId?: string | null
    onAddToList: (itemId: string, name: string) => void
    onClose: () => void
  } = $props()

  let sure = $derived(items.filter((item) => item.confidence === 'sure'))
  let check = $derived(items.filter((item) => item.confidence === 'check'))
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.plan.homeTitle}>
  <header>
    <div>
      <h2>{strings.plan.homeTitle}</h2>
      <p>{strings.plan.homeHint}</p>
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
    {#if items.length === 0}
      <p class="none">{strings.plan.homeNone}</p>
    {:else}
      {#if sure.length > 0}
        <section>
          <h3>{strings.plan.homeSure}</h3>
          {@render rows(sure)}
        </section>
      {/if}

      {#if check.length > 0}
        <section>
          <h3 class="warn">{strings.plan.homeCheck}</h3>
          <p class="why">{strings.plan.homeCheckHint}</p>
          {@render rows(check)}
        </section>
      {/if}
    {/if}
  </div>
</div>

{#snippet rows(list: AtHomeItem[])}
  <ul class="list">
    {#each list as entry (entry.itemId)}
      {@const item = itemsById.get(entry.itemId)}
      <li class="row" class:unsure={entry.confidence === 'check'}>
        <span class="glyph">
          <GroceryIcon
            icon={item?.icon ?? null}
            emoji={item?.emoji ?? null}
            name={item?.name ?? '?'}
            size={22}
          />
        </span>
        <span class="text">
          <span class="name">{item?.name ?? '—'}</span>
          <span class="ago">{strings.plan.homeAgo(entry.daysAgo)}</span>
        </span>
        <button
          class="out"
          disabled={busyId === entry.itemId}
          aria-label={strings.plan.homeAddLong(item?.name ?? '')}
          onclick={() => onAddToList(entry.itemId, item?.name ?? '')}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {strings.plan.homeAdd}
        </button>
      </li>
    {/each}
  </ul>
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
    grid-template-rows: auto minmax(0, 1fr);
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

  h3.warn {
    color: var(--color-warning);
  }

  .why {
    margin-top: calc(var(--space-1) * -1);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap-min);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
  }

  /* The dashed edge is the whole "we are not sure" signal, and it is the same
     grammar a repeat card uses in the planner. */
  .row.unsure {
    border: 1px dashed var(--color-border-strong);
    background: transparent;
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
  }

  .name {
    overflow: hidden;
    font-size: var(--text-base);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ago {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  .out {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-1);
    min-height: 2.25rem;
    padding: 0 var(--space-3);
    border-radius: var(--radius-full);
    background: var(--color-need-soft);
    color: var(--color-need);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
  }

  .out:disabled {
    opacity: 0.5;
  }
</style>
