<!--
  The optional extras on a list item: how many, a note, and how urgent it is.

  "Quantity is an optional edit afterwards, not a step in adding" (NIU.md §4.1).
  So this is only ever reached by long-pressing an item already on the list —
  never in the path of adding one.

  Round 6 cut this down. The unit field is gone: in practice nobody typed one,
  "2" on a tile means two of whatever that thing is bought in, and a text field
  you have to type into is the most expensive control on a phone. What is left is
  three things — a stepper, two tags, a note — which fits without scrolling.

  Two details that matter on a real phone:

  - The stepper is the point of the quantity row. Typing is still allowed for the
    rare "12", but the thumb path for 1 → 2 is one tap, not a keyboard.
  - The sheet rides above the on-screen keyboard (--keyboard-inset, see
    src/lib/keyboard.ts). Before that, opening the note field put the Done button
    underneath the keys.

  Edits save as you make them rather than behind a Save button: there is nothing
  here that needs confirming, and a Save button you can forget to press loses
  work. Done just closes.

  ## The pencil in the corner

  Round 15 added a second, quieter door out of here (Marçal): the things that
  belong to the *item* rather than to this shopping trip — its picture, which
  category it lives in, which dish wants it. Those were only reachable by
  holding the tile down in the picker below, which meant that the moment
  something was on the list it became uneditable, exactly when you are most
  likely to be looking at it and thinking "that icon is wrong".

  It is deliberately a small icon rather than a fourth big control. The three
  fields above are what you came here for nine times out of ten; this is the
  tenth. Tapping it hands back to the screen, which opens the same menu the
  picker's long press does.
-->
<script lang="ts">
  import { strings } from '../lib/strings'
  import type { DisplayItem } from '../lib/list-view'

  let {
    item,
    onChange,
    onEdit,
    onRemove,
    onClose,
  }: {
    item: DisplayItem
    onChange: (changes: {
      quantity?: number | null
      note?: string | null
      urgent?: boolean
      ifConvenient?: boolean
    }) => void
    /** The pencil: hands back to the screen for the icon/category/dish menu. */
    onEdit: () => void
    onRemove: () => void
    onClose: () => void
  } = $props()

  /** Above this the numbers stop meaning anything on a shopping list. */
  const MAX = 99

  // Local copies so typing feels instant and every keystroke isn't a round trip.
  // These deliberately snapshot the item once, on open, and do not re-sync: a
  // realtime update arriving from the other phone mid-edit must not overwrite
  // the field under someone's thumb. The sheet is keyed on the item id by its
  // parent, so opening a different item mounts a fresh component.
  /* svelte-ignore state_referenced_locally */
  let count = $state(item.quantity ?? 1)
  /* svelte-ignore state_referenced_locally */
  let note = $state(item.note ?? '')

  // One is the same as "no quantity given", and that is what gets stored, so a
  // tile isn't cluttered with a ×1 badge that tells nobody anything.
  function commitCount(next: number) {
    const clamped = Math.min(MAX, Math.max(1, Math.round(next)))
    count = clamped
    onChange({ quantity: clamped === 1 ? null : clamped })
  }

  function typed(value: string) {
    // Digits only: an inputmode keypad can still produce a stray character, and
    // the database rejects zero and negatives anyway.
    const digits = value.replace(/\D/g, '')
    if (digits === '') return
    commitCount(Number(digits))
  }

  function commitNote() {
    const trimmed = note.trim()
    onChange({ note: trimmed === '' ? null : trimmed })
  }

  // Urgent and "if convenient" are opposite ends of one question, so picking one
  // clears the other. Tapping the one that is already on turns it off.
  function setUrgent() {
    onChange({ urgent: !item.urgent, ifConvenient: false })
  }

  function setIfConvenient() {
    onChange({ ifConvenient: !item.ifConvenient, urgent: false })
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={item.name}>
  <header>
    <h2>{item.name}</h2>
    <button class="edit" onclick={onEdit} aria-label={strings.shopping.editDetails}>
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M4 20h4l10-10a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6 4 20Z" />
        <path d="m13.5 7.5 3 3" />
      </svg>
    </button>
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
    <div class="row">
      <span class="label" id="qty-label">{strings.shopping.quantity}</span>
      <div class="stepper">
        <button
          class="step"
          onclick={() => commitCount(count - 1)}
          disabled={count <= 1}
          aria-label={strings.shopping.fewer}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>
        </button>
        <input
          class="count"
          type="text"
          inputmode="numeric"
          maxlength="2"
          value={count}
          aria-labelledby="qty-label"
          oninput={(event) => typed(event.currentTarget.value)}
          onblur={(event) => (event.currentTarget.value = String(count))}
        />
        <button
          class="step"
          onclick={() => commitCount(count + 1)}
          disabled={count >= MAX}
          aria-label={strings.shopping.more}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>
        </button>
      </div>
    </div>

    <div class="tags">
      <button class="tag urgent" class:on={item.urgent} aria-pressed={item.urgent} onclick={setUrgent}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M13 3.5 5.5 14H11l-1.5 6.5L18 10h-5.5L13 3.5Z" />
        </svg>
        {strings.shopping.urgent}
      </button>
      <button
        class="tag later"
        class:on={item.ifConvenient}
        aria-pressed={item.ifConvenient}
        onclick={setIfConvenient}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 4.6a7.4 7.4 0 1 0 0 14.8 7.4 7.4 0 0 0 0-14.8Z" />
          <path d="M12 8.4V12l2.6 1.6" />
        </svg>
        {strings.shopping.ifConvenient}
      </button>
    </div>

    <label class="note">
      <span class="label">{strings.shopping.note}</span>
      <input
        type="text"
        bind:value={note}
        maxlength="200"
        enterkeyhint="done"
        placeholder={strings.shopping.notePlaceholder}
        onblur={commitNote}
      />
    </label>
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
    /* Sits on the keyboard's shoulder rather than under it. Zero when no field
       has focus, so this is the ordinary bottom sheet the rest of the time. */
    inset: auto 0 var(--keyboard-inset, 0px) 0;
    z-index: var(--z-sheet);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: var(--content-max);
    /* A short phone with the keyboard up still gets a scrollable sheet rather
       than a Done button pushed off the top. */
    max-height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    margin-inline: auto;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
    background: var(--color-surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-2);
    transition: bottom var(--dur-fast) var(--ease);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  h2 {
    /* Takes the slack, so the two icons stay pinned to the right whatever
       length the name is. */
    flex: 1;
    min-width: 0;
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
  }

  /* Faint on purpose: it is the door you take one time in ten. */
  .edit {
    display: grid;
    flex: none;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    border-radius: var(--radius-full);
    color: var(--color-text-faint);
  }

  .edit:active {
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
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

  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  /* ---- Quantity ---------------------------------------------------------- */

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
  }

  .step {
    display: grid;
    place-items: center;
    width: var(--tap-min);
    height: var(--tap-min);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    color: var(--color-text);
  }

  .step svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .step:disabled {
    color: var(--color-text-faint);
    opacity: 0.5;
  }

  .step:active:not(:disabled) {
    transform: scale(0.92);
  }

  .count {
    width: 3rem;
    border: 0;
    background: none;
    color: var(--color-text);
    font: inherit;
    /* 16px floor stops Android zooming in on focus. */
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  /* ---- The two tags ------------------------------------------------------ */

  .tags {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .tag {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    transition:
      background var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease);
  }

  .tag svg {
    flex: none;
    width: 1.25rem;
    height: 1.25rem;
  }

  .tag:active {
    transform: scale(0.97);
  }

  .tag.urgent.on {
    border-color: var(--color-need-border);
    background: var(--color-need-soft);
    color: var(--color-need);
  }

  .tag.later.on {
    border-color: var(--color-pick-border);
    background: var(--color-pick-soft);
    color: var(--color-pick);
  }

  /* ---- Note -------------------------------------------------------------- */

  .note {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .note input {
    min-width: 0;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    font-size: var(--text-base);
  }

  .note input::placeholder {
    color: var(--color-text-faint);
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
