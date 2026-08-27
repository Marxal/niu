<!--
  "Shop for this week" — what it would put on the list, before it does.

  A preview rather than a straight tap, and that is the one place this differs
  from tapping a dish tile. A dish adds four things you can see; a week can add
  twenty, from days you last looked at on Sunday. "The user always taps" (§4.1)
  means less if the user cannot see what they are agreeing to.

  It is also the most useful screen in the app for a different reason: it is the
  answer to "what do we actually need this week", with the dish that wants each
  thing written beside it. Half of shopping is working that out.

  Nothing here writes. It shows what planNeeds() worked out and hands the tap
  back to the planner, which calls add_plan_to_list() — one round trip, and the
  database returns the count that gets reported.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import type { Need } from '../lib/plan-needs'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    needs,
    silent,
    itemsById,
    rangeLabel,
    busy = false,
    onAdd,
    onClose,
  }: {
    /** Everything the range wants, already split by planNeeds(). */
    needs: { all: Need[]; missing: Need[] }
    /** How many entries could never contribute — leftovers, nights out, names. */
    silent: number
    itemsById: ReadonlyMap<string, CatalogueItem>
    rangeLabel: string
    busy?: boolean
    onAdd: () => void
    onClose: () => void
  } = $props()

  /** Missing first: it is what the button is about. */
  let rows = $derived([
    ...needs.missing.map((need) => ({ need, on: false })),
    ...needs.all.filter((need) => need.onList).map((need) => ({ need, on: true })),
  ])

  let already = $derived(needs.all.length - needs.missing.length)
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.plan.shopTitle}>
  <header>
    <div>
      <h2>{strings.plan.shopTitle}</h2>
      <p>{rangeLabel}</p>
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
    {#if rows.length === 0}
      <p class="none">
        {#if silent > 0}
          {strings.plan.shopSilentOnly}
        {:else}
          {strings.plan.shopNothingPlanned}
        {/if}
      </p>
    {:else}
      {#if needs.missing.length === 0}
        <p class="none">{strings.plan.shopNothingNeeded}</p>
      {/if}

      <ul class="rows">
        {#each rows as row (row.need.itemId)}
          {@const item = itemsById.get(row.need.itemId)}
          <li class="row" class:on={row.on}>
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
              <span class="why">
                {row.need.dishNames.length > 0
                  ? strings.plan.shopFor(row.need.dishNames.join(', '))
                  : strings.plan.shopForNobody}
              </span>
            </span>
            {#if row.on}
              <svg
                class="tick"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            {/if}
          </li>
        {/each}
      </ul>

      {#if already > 0}
        <p class="already">{strings.plan.shopAlready(already)}</p>
      {/if}
    {/if}
  </div>

  {#if needs.missing.length > 0}
    <button class="go" onclick={onAdd} disabled={busy}>
      {strings.plan.shopAdd(needs.missing.length)}
    </button>
  {/if}
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
    grid-template-rows: auto minmax(0, 1fr) auto;
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
    gap: var(--space-2);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 2.75rem;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
  }

  /* Already on the list: still shown, because "we have that" is half the answer,
     but plainly not part of what the button will do. */
  .row.on {
    color: var(--color-text-muted);
    opacity: 0.7;
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

  .why {
    overflow: hidden;
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tick {
    flex: none;
    color: var(--color-success);
  }

  .already,
  .none {
    padding: var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .go {
    min-height: var(--tap-min);
    border-radius: var(--radius-full);
    background: var(--color-tab-shopping);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
    box-shadow: var(--shadow-1);
  }

  .go:disabled {
    opacity: 0.6;
  }
</style>
