<!--
  "Shop for this week" — what it would put on the list, before it does.

  A preview rather than a straight tap, and that is the one place this differs
  from tapping a dish tile. A dish adds four things you can see; a week can add
  twenty, from days you last looked at on Sunday. "The user always taps" (§4.1)
  means less if the user cannot see what they are agreeing to.

  It is also the most useful screen in the app for a different reason: it is the
  answer to "what do we actually need this week", with the dish that wants each
  thing written beside it. Half of shopping is working that out.

  Since round 10.1 it is a list you *tick* rather than an all-or-nothing button.
  That is not a small change to what it means: half of deciding what to buy is
  deciding what you already have enough of, and before this the only way to say
  "not the tomatoes, we have loads" was to add them anyway and take them off the
  list afterwards. What survives the ticking is what gets written.

  Everything starts ticked, because the common case is that the plan is right —
  the ticks are for the exceptions, not a checklist to complete.

  The **whole row** is the target, not the little box (Marçal, round 10.2). A
  1.6rem checkbox is below the tap floor this project sets, and aiming at one
  while walking is exactly the situation the floor exists for. The box is now
  drawn state rather than the control.

  Nothing here writes. It shows what planNeeds() worked out and hands the chosen
  ids back to the planner, which calls add_plan_to_list() — one round trip, and
  the database returns the count that gets reported.
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
    /** The catalogue ids that survived the ticking. */
    onAdd: (itemIds: string[]) => void
    onClose: () => void
  } = $props()

  /** Missing first: it is what the button is about. */
  let rows = $derived([
    ...needs.missing.map((need) => ({ need, on: false })),
    ...needs.all.filter((need) => need.onList).map((need) => ({ need, on: true })),
  ])

  let already = $derived(needs.all.length - needs.missing.length)

  /**
   * Which of the missing things are ticked.
   *
   * Seeded from the missing list the first time and then left alone — deriving
   * it would reset every tick each time the plan re-read itself over realtime,
   * which on a shared plan is often enough to be maddening. Anything that turns
   * up later (the other phone planned something while this was open) is treated
   * as ticked by the same "the plan is probably right" default.
   */
  let unticked = $state<Set<string>>(new Set())

  let chosen = $derived(
    needs.missing.map((need) => need.itemId).filter((id) => !unticked.has(id)),
  )

  function toggle(itemId: string) {
    const next = new Set(unticked)
    if (next.has(itemId)) next.delete(itemId)
    else next.add(itemId)
    unticked = next
  }

  function setAll(on: boolean) {
    unticked = on ? new Set() : new Set(needs.missing.map((need) => need.itemId))
  }
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
      {:else if needs.missing.length > 1}
        <div class="bulk">
          <button onclick={() => setAll(true)}>{strings.plan.shopAll}</button>
          <button onclick={() => setAll(false)}>{strings.plan.shopNone}</button>
        </div>
      {/if}

      <ul class="rows">
        {#each rows as row (row.need.itemId)}
          {@const item = itemsById.get(row.need.itemId)}
          {@const ticked = !row.on && !unticked.has(row.need.itemId)}
          <li>
            <button
              class="row"
              class:on={row.on}
              class:ticked
              role="checkbox"
              aria-checked={row.on ? true : ticked}
              aria-disabled={row.on}
              onclick={() => !row.on && toggle(row.need.itemId)}
            >
              <span class="box" class:done={row.on} aria-hidden="true">
                {#if ticked || row.on}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                {/if}
              </span>
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
            </button>
          </li>
        {/each}
      </ul>

      {#if already > 0}
        <p class="already">{strings.plan.shopAlready(already)}</p>
      {/if}
    {/if}
  </div>

  {#if needs.missing.length > 0}
    <button class="go" onclick={() => onAdd(chosen)} disabled={busy || chosen.length === 0}>
      {chosen.length === 0 ? strings.plan.shopNoneChosen : strings.plan.shopAdd(chosen.length)}
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
    width: 100%;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap-min);
    padding: var(--space-1) var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    text-align: left;
  }

  /* Ticked rows carry a tint as well as a mark, so the shape of what you are
     about to buy reads without having to check eight little boxes one by one. */
  .row.ticked {
    border-color: var(--color-pick-border);
    background: var(--color-pick-soft);
  }

  .row:active {
    transform: scale(0.995);
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

  .bulk {
    display: flex;
    gap: var(--space-2);
    padding: 0 var(--space-2) var(--space-1);
  }

  .bulk button {
    min-height: 2rem;
    padding: 0 var(--space-3);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
  }

  .box {
    display: grid;
    flex: none;
    place-items: center;
    width: 1.65rem;
    height: 1.65rem;
    border: 2px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    color: transparent;
  }

  .row.ticked .box {
    border-color: var(--color-pick);
    background: var(--color-pick);
    color: var(--color-accent-ink);
  }

  /* Already on the list: the same box, filled, but not a control — there is
     nothing to decide about something you have already got. */
  .box.done {
    border-color: var(--color-border);
    background: var(--color-border);
    color: var(--color-text-muted);
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
