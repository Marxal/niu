<!--
  The optional extras on a list item: quantity, unit, note, urgency, remove.

  "Quantity is an optional edit afterwards, not a step in adding" (NIU.md §4.1).
  So this is only ever reached by long-pressing or tapping through from an item
  already on the list — never in the path of adding one.

  Edits save as you make them rather than behind a Save button: there is nothing
  here that needs confirming, and a Save button you can forget to press loses
  work.
-->
<script lang="ts">
  import { strings } from '../lib/strings'
  import type { DisplayItem } from '../lib/list-view'

  let {
    item,
    onChange,
    onRemove,
    onClose,
  }: {
    item: DisplayItem
    onChange: (changes: {
      quantity?: number | null
      unit?: string | null
      note?: string | null
      urgent?: boolean
    }) => void
    onRemove: () => void
    onClose: () => void
  } = $props()

  // Local copies so typing feels instant and every keystroke isn't a round trip.
  // These deliberately snapshot the item once, on open, and do not re-sync: a
  // realtime update arriving from the other phone mid-edit must not overwrite
  // the field under someone's thumb. The sheet is keyed on the item id by its
  // parent, so opening a different item mounts a fresh component.
  /* svelte-ignore state_referenced_locally */
  let quantity = $state(item.quantity === null ? '' : String(item.quantity))
  /* svelte-ignore state_referenced_locally */
  let unit = $state(item.unit ?? '')
  /* svelte-ignore state_referenced_locally */
  let note = $state(item.note ?? '')

  function commitQuantity() {
    const trimmed = quantity.trim()
    if (trimmed === '') {
      onChange({ quantity: null })
      return
    }
    const parsed = Number(trimmed)
    // The database rejects zero and negatives; don't send what it will refuse.
    if (!Number.isFinite(parsed) || parsed <= 0) {
      quantity = item.quantity === null ? '' : String(item.quantity)
      return
    }
    onChange({ quantity: parsed })
  }

  function commitText(field: 'unit' | 'note', value: string) {
    const trimmed = value.trim()
    onChange({ [field]: trimmed === '' ? null : trimmed })
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={item.name}>
  <header>
    <h2>{item.name}</h2>
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

  <div class="fields">
    <div class="pair">
      <label>
        <span>{strings.shopping.quantity}</span>
        <input
          type="number"
          inputmode="decimal"
          min="0"
          step="any"
          bind:value={quantity}
          onblur={commitQuantity}
        />
      </label>
      <label>
        <span>{strings.shopping.unit}</span>
        <input
          type="text"
          bind:value={unit}
          maxlength="12"
          autocapitalize="none"
          onblur={() => commitText('unit', unit)}
        />
      </label>
    </div>

    <label>
      <span>{strings.shopping.note}</span>
      <input
        type="text"
        bind:value={note}
        maxlength="200"
        placeholder={strings.shopping.notePlaceholder}
        onblur={() => commitText('note', note)}
      />
    </label>

    <button
      class="toggle"
      class:on={item.urgent}
      onclick={() => onChange({ urgent: !item.urgent })}
      aria-pressed={item.urgent}
    >
      <span class="dot" aria-hidden="true"></span>
      {strings.shopping.urgent}
    </button>
  </div>

  <footer>
    <button class="remove" onclick={onRemove}>{strings.shopping.remove}</button>
    <button class="done" onclick={onClose}>{strings.shopping.done}</button>
  </footer>
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
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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
    justify-content: space-between;
    gap: var(--space-3);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  .close {
    display: grid;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    margin-right: calc(var(--space-2) * -1);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  label span {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  input {
    min-width: 0;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    /* 16px floor stops Android zooming in on focus. */
    font-size: var(--text-base);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
  }

  .toggle.on {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }

  .dot {
    width: 0.75rem;
    height: 0.75rem;
    border: 2px solid currentColor;
    border-radius: var(--radius-full);
  }

  .toggle.on .dot {
    background: currentColor;
  }

  footer {
    display: flex;
    gap: var(--space-3);
  }

  .remove,
  .done {
    flex: 1;
    min-height: var(--tap-min);
    border-radius: var(--radius-full);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .remove {
    border: 1px solid var(--color-border-strong);
    color: var(--color-danger);
  }

  .done {
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }
</style>
