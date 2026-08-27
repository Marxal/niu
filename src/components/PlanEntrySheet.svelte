<!--
  Tap a planned card and this opens: everything you can do to one meal that
  isn't moving it.

  The split is deliberate and it is the whole interaction model of the planner:
  **tap to act, hold to move.** Long-press is the drag (drag.svelte.ts), so it
  can't also be the menu — and a tap that opened nothing would waste the most
  natural gesture on the screen.

  "Mark as leftovers" is a toggle on the existing card rather than a delete and a
  re-add, because it is the same dish on the same night and only the cooking
  changed. A re-add would also count as a second planning of the dish and skew
  the picker's order.

  "Needs cooking" is the other half of the same conversation and the other place
  to set it — the picker's Cook it toggle catches it on the way in, this catches
  it after the fact. Any entry can carry it, including a plain item: broccoli
  does not roast itself.
-->
<script lang="ts">
  import CookMark from './CookMark.svelte'
  import GroceryIcon from './GroceryIcon.svelte'
  import MarkerIcon from './MarkerIcon.svelte'
  import type { Dish } from '../lib/dishes'
  import { MEAL_LABELS, type PlanEntry, dayName } from '../lib/plan'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    entry,
    dish = null,
    item = null,
    today,
    onToggleLeftovers,
    onToggleToCook,
    onShopFor,
    onEditDish,
    onNote,
    onRemove,
    onClose,
  }: {
    entry: PlanEntry
    dish?: Dish | null
    item?: CatalogueItem | null
    today: string
    onToggleLeftovers: () => void
    onToggleToCook: () => void
    onShopFor: () => void
    onEditDish: (dish: Dish) => void
    onNote: (note: string) => void
    onRemove: () => void
    onClose: () => void
  } = $props()

  // Snapshotted once, deliberately: the field holds a draft, and re-syncing it
  // from the entry would fight the person typing if the other phone touched the
  // same row mid-sentence. The sheet is keyed on the entry, so opening a
  // different card mounts a fresh one with the right note in it.
  // svelte-ignore state_referenced_locally
  let note = $state(entry.note ?? '')

  let title = $derived.by(() => {
    if (entry.kind === 'out') return strings.plan.out
    if (entry.kind === 'item') return item?.name ?? '—'
    if (entry.kind === 'leftovers') {
      return dish ? strings.plan.leftoversOf(dish.name) : strings.plan.leftovers
    }
    return dish?.name ?? '—'
  })

  /** Only a dish or a plain item has anything to buy. */
  let canShop = $derived(
    (entry.kind === 'dish' && dish !== null && dish.itemIds.length > 0) ||
      (entry.kind === 'item' && item !== null),
  )

  /** Leftovers is a thing you can be, or stop being, only if there is a dish. */
  let canToggle = $derived(
    (entry.kind === 'dish' || entry.kind === 'leftovers') && dish !== null,
  )

  function saveNote() {
    if ((entry.note ?? '') === note.trim()) return
    onNote(note)
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.plan.entryTitle}>
  <header>
    <span class="glyph">
      {#if entry.kind === 'out' || (entry.kind === 'leftovers' && !dish)}
        <MarkerIcon kind={entry.kind === 'out' ? 'out' : 'leftovers'} size={26} />
      {:else if entry.kind === 'item'}
        <GroceryIcon icon={item?.icon ?? null} emoji={item?.emoji ?? null} name={item?.name ?? '?'} size={28} />
      {:else}
        <GroceryIcon icon={dish?.icon ?? null} name={dish?.name ?? '?'} size={28} />
      {/if}
    </span>
    <div>
      <h2>{title}</h2>
      <p>{MEAL_LABELS[entry.meal]} · {dayName(entry.date, today)}</p>
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
    <label class="note">
      <span>{strings.plan.entryNote}</span>
      <input
        type="text"
        bind:value={note}
        onblur={saveNote}
        placeholder={strings.plan.entryNotePlaceholder}
        maxlength="120"
        enterkeyhint="done"
      />
    </label>

    <div class="actions">
      <button class:on={entry.toCook} onclick={onToggleToCook}>
        <CookMark size={18} />
        {entry.toCook ? strings.plan.toCookOff : strings.plan.toCookOn}
      </button>

      {#if canToggle}
        <button onclick={onToggleLeftovers}>
          <MarkerIcon kind="leftovers" size={18} />
          {entry.kind === 'leftovers'
            ? strings.plan.entryMarkCooked
            : strings.plan.entryMarkLeftovers}
        </button>
      {/if}

      {#if canShop}
        <button onclick={onShopFor}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 5h2l2.2 10.2a2 2 0 0 0 2 1.6h6.4a2 2 0 0 0 2-1.5L20 8H7" />
            <circle cx="10" cy="20" r="1" />
            <circle cx="17" cy="20" r="1" />
          </svg>
          {strings.plan.entryShopFor}
        </button>
      {/if}

      {#if dish}
        <button onclick={() => onEditDish(dish)}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
          </svg>
          {strings.plan.entryOpenDish}
        </button>
      {/if}

      <button class="danger" onclick={onRemove}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
        {strings.plan.entryRemove}
      </button>
    </div>

    <p class="hint">{strings.plan.entryMove}</p>
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
    gap: var(--space-4);
    max-height: 78vh;
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
    align-items: center;
    gap: var(--space-3);
  }

  .glyph {
    display: grid;
    flex: none;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
  }

  header div {
    flex: 1;
    min-width: 0;
  }

  h2 {
    overflow: hidden;
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  header p {
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

  .note {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .note span {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .note input {
    width: 100%;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--text-base);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .actions button {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
    font-size: var(--text-base);
    text-align: left;
  }

  .actions button:active {
    background: var(--color-border);
  }

  /* The one action here that is a *state* rather than a one-shot, so it shows
     which way it currently is. */
  .actions button.on {
    background: var(--color-tab-meals);
    color: var(--color-accent-ink);
  }

  .actions .danger {
    color: var(--color-danger);
    background: transparent;
  }

  .hint {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    text-align: center;
  }
</style>
