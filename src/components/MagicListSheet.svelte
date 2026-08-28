<!--
  "Fill the list" — the shop this household would usually be doing about now,
  shown before any of it is written.

  Same posture as PlanShopSheet, and for the same reason: NIU.md §5 promises
  suggestions and never auto-adds, and a button that quietly put twenty things
  on a shared list would break that promise however good the guesses were. So
  this is a list you tick, and what survives the ticking is what gets written.

  ## Two bands, and the second one is the point

  **Due about now** is the same bar the "you usually need…" strip uses — past
  four-fifths of the usual gap — so the two never disagree about a word as
  strong as "due". Ticked by default.

  **You usually get these too** is the half a weekly shop is actually made of:
  regulars that are only halfway through their cycle. The milk you buy every
  Saturday is four days old when you buy it again, and it is never "due" on a
  Saturday morning. These start **unticked**, deliberately — they are the
  band most likely to be wrong, and a proposal that starts by agreeing with
  itself about everything is one nobody reads.

  See list-magic.ts for what qualifies as either.

  Nothing here writes. It hands the ticked ids back to the screen.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import MagicIcon from './MagicIcon.svelte'
  import type { ProposedShopItem } from '../lib/list-magic'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    proposed,
    itemsById,
    busy = false,
    onAdd,
    onClose,
  }: {
    /** Already ordered — due first, then usual. See proposeShop(). */
    proposed: readonly ProposedShopItem[]
    itemsById: ReadonlyMap<string, CatalogueItem>
    busy?: boolean
    /** The catalogue ids that survived the ticking. */
    onAdd: (itemIds: string[]) => void
    onClose: () => void
  } = $props()

  let due = $derived(proposed.filter((entry) => entry.reason === 'due'))
  let usual = $derived(proposed.filter((entry) => entry.reason === 'usual'))

  /**
   * What is ticked.
   *
   * Held as one set seeded once, rather than derived, for the same reason
   * PlanShopSheet holds its own: the numbers behind this re-read themselves
   * whenever the other phone finishes a shop, and a tick that reset itself
   * under someone's thumb would be maddening. The sheet is mounted fresh each
   * time it opens, so "seeded once" means "once per opening".
   */
  /* svelte-ignore state_referenced_locally */
  let ticked = $state<Set<string>>(new Set(due.map((entry) => entry.itemId)))

  let chosen = $derived(proposed.filter((e) => ticked.has(e.itemId)).map((e) => e.itemId))

  function toggle(itemId: string) {
    const next = new Set(ticked)
    if (next.has(itemId)) next.delete(itemId)
    else next.add(itemId)
    ticked = next
  }

  function setAll(on: boolean) {
    ticked = on ? new Set(proposed.map((entry) => entry.itemId)) : new Set()
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.shopping.magicTitle}>
  <header>
    <div>
      <h2><MagicIcon size={19} />{strings.shopping.magicTitle}</h2>
      <p>{strings.shopping.magicSubtitle}</p>
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
    {#if proposed.length === 0}
      <p class="none">{strings.shopping.magicNone}</p>
    {:else}
      {#if proposed.length > 1}
        <div class="bulk">
          <button onclick={() => setAll(true)}>{strings.shopping.magicAll}</button>
          <button onclick={() => setAll(false)}>{strings.shopping.magicClear}</button>
        </div>
      {/if}

      {#if due.length > 0}
        <section>
          <h3>{strings.shopping.magicDue}</h3>
          {@render rows(due)}
        </section>
      {/if}

      {#if usual.length > 0}
        <section>
          <h3>{strings.shopping.magicUsual}</h3>
          <p class="why">{strings.shopping.magicUsualHint}</p>
          {@render rows(usual)}
        </section>
      {/if}
    {/if}
  </div>

  {#if proposed.length > 0}
    <button class="go" onclick={() => onAdd(chosen)} disabled={busy || chosen.length === 0}>
      {chosen.length === 0
        ? strings.shopping.magicNoneChosen
        : strings.shopping.magicAdd(chosen.length)}
    </button>
  {/if}
</div>

{#snippet rows(list: readonly ProposedShopItem[])}
  <ul class="rows">
    {#each list as entry (entry.itemId)}
      {@const item = itemsById.get(entry.itemId)}
      {@const on = ticked.has(entry.itemId)}
      <li>
        <!-- The whole row is the target, not the box (Marçal, round 10.2): a
             1.6rem checkbox is below the tap floor this project sets. -->
        <button
          class="row"
          class:on
          role="checkbox"
          aria-checked={on}
          onclick={() => toggle(entry.itemId)}
        >
          <span class="box" aria-hidden="true">
            {#if on}
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
          <span class="name">{item?.name ?? '—'}</span>
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
    display: flex;
    align-items: center;
    gap: var(--space-2);
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
    gap: var(--space-4);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  h3 {
    margin-bottom: var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .why,
  .none {
    color: var(--color-text-faint);
    font-size: var(--text-sm);
  }

  .why {
    margin: calc(var(--space-1) * -1) 0 var(--space-2);
    font-size: var(--text-xs);
  }

  .none {
    padding: var(--space-4) 0;
    text-align: center;
  }

  .bulk {
    display: flex;
    gap: var(--space-2);
  }

  .bulk button {
    min-height: 2rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
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
    width: 100%;
    min-height: var(--tap-min);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
    text-align: left;
  }

  .row.on {
    background: var(--color-pick-soft);
  }

  .box {
    display: grid;
    flex: none;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border: 2px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    color: var(--color-accent-ink);
  }

  .row.on .box {
    border-color: var(--color-accent);
    background: var(--color-accent);
  }

  .glyph {
    display: grid;
    flex: none;
    place-items: center;
    width: 2rem;
    height: 2rem;
    color: var(--color-text-muted);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .go {
    min-height: var(--tap-min);
    border-radius: var(--radius-full);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }

  .go:disabled {
    background: var(--color-surface-sunken);
    color: var(--color-text-faint);
  }
</style>
