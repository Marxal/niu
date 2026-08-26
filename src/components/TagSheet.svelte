<!--
  Writing or editing one "part of a meal".

  Reached two ways from the dish editor: **Add**, which opens it empty, and a
  long press on a chip, which opens it on that one. Same sheet, because it is
  the same three questions — what is it called, what colour, and (only when it
  already exists) do you still want it.

  The colour is picked from eight swatches rather than a wheel. That is a design
  decision, not a shortcut: the eight are defined in the token file with a light
  and a dark value each, so whatever gets picked is legible in both themes and
  sits in the same muted register as the rest of the app. A free colour picker
  can produce yellow-on-white, and on a shared list that is a real problem
  rather than a matter of taste.

  Deleting says what it will do first, because a part is a label on many dishes:
  the dishes survive, the label does not.
-->
<script lang="ts">
  import { type DishTag, type TagColour, DEFAULT_TAG_COLOUR, TAG_COLOURS, tagStyle } from '../lib/dish-tags'
  import { createTag, dishes, removeTag, updateTag } from '../lib/dishes.svelte'
  import { strings } from '../lib/strings'

  let {
    tag,
    userId,
    onSaved,
    onClose,
  }: {
    /** The part being edited, or null to write a new one. */
    tag: DishTag | null
    userId: string | null
    /** The id that was written, so a new part can be selected straight away. */
    onSaved: (tagId: string) => void
    onClose: () => void
  } = $props()

  /* svelte-ignore state_referenced_locally */
  let name = $state(tag?.name ?? '')
  /* svelte-ignore state_referenced_locally */
  let colour = $state<TagColour>(tag?.colour ?? DEFAULT_TAG_COLOUR)

  let confirmingDelete = $state(false)
  let saving = $state(false)

  let canSave = $derived(name.trim() !== '' && !saving)

  async function save() {
    if (!canSave) return
    saving = true

    if (tag) {
      const ok = await updateTag(tag.id, { name, colour })
      saving = false
      if (ok) {
        onSaved(tag.id)
        onClose()
      }
      return
    }

    if (!userId) {
      saving = false
      return
    }

    const id = await createTag(name, colour, userId)
    saving = false
    // A failure leaves the sheet open with the typing in it and the reason
    // underneath — most often "there is already a part with that name".
    if (id) {
      onSaved(id)
      onClose()
    }
  }

  function confirmDelete() {
    if (tag) void removeTag(tag.id)
    onClose()
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div
  class="sheet"
  role="dialog"
  aria-modal="true"
  aria-label={tag ? strings.dishes.tagEdit : strings.dishes.tagNew}
>
  <header>
    <h2>{tag ? strings.dishes.tagEdit : strings.dishes.tagNew}</h2>
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

  <input
    type="text"
    bind:value={name}
    maxlength="24"
    placeholder={strings.dishes.tagNamePlaceholder}
    aria-label={strings.dishes.tagName}
    enterkeyhint="done"
    autocomplete="off"
  />

  <div class="control">
    <span class="label">{strings.dishes.tagColour}</span>
    <div class="swatches" role="group" aria-label={strings.dishes.tagColour}>
      {#each TAG_COLOURS as option (option)}
        <button
          class="swatch"
          class:on={colour === option}
          style={tagStyle(option)}
          aria-pressed={colour === option}
          aria-label={strings.dishes.tagColourNamed(option)}
          onclick={() => (colour = option)}
        ></button>
      {/each}
    </div>
  </div>

  {#if dishes.error}
    <p class="error" role="alert">{dishes.error}</p>
  {/if}

  {#if tag}
    {#if confirmingDelete}
      <div class="confirm">
        <p><strong>{strings.dishes.tagDeleteTitle}</strong> {strings.dishes.tagDeleteBody}</p>
        <div class="actions">
          <button class="cancel" onclick={() => (confirmingDelete = false)}>
            {strings.dishes.deleteCancel}
          </button>
          <button class="destroy" onclick={confirmDelete}>{strings.dishes.deleteConfirm}</button>
        </div>
      </div>
    {:else}
      <button class="delete" onclick={() => (confirmingDelete = true)}>
        {strings.dishes.deleteConfirm}
      </button>
    {/if}
  {/if}

  <div class="actions">
    <button class="cancel" onclick={onClose}>{strings.dishes.cancel}</button>
    <button class="save" onclick={save} disabled={!canSave}>{strings.dishes.save}</button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    /* Above the dish sheet this opens on top of, not level with it. */
    z-index: calc(var(--z-sheet) + 1);
    background: var(--color-overlay);
  }

  .sheet {
    position: fixed;
    inset: auto 0 var(--keyboard-inset, 0px) 0;
    z-index: calc(var(--z-sheet) + 1);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: var(--content-max);
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

  input {
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    /* 16px floor stops Android zooming in on focus. */
    font-size: var(--text-base);
  }

  input::placeholder {
    color: var(--color-text-faint);
  }

  .control {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: var(--space-2);
  }

  .swatch {
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: var(--radius-full);
    background: var(--tag-ink);
  }

  /* A ring in the page colour, then the ink again: the chosen swatch reads as
     picked without needing a tick drawn on top of a colour we don't control. */
  .swatch.on {
    border-color: var(--color-bg);
    box-shadow: 0 0 0 2px var(--tag-ink);
  }

  .actions {
    display: flex;
    gap: var(--space-3);
  }

  .cancel,
  .save,
  .destroy {
    flex: 1;
    min-height: var(--tap-min);
    border-radius: var(--radius-full);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .cancel {
    border: 1px solid var(--color-border-strong);
    color: var(--color-text);
  }

  .save {
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: var(--weight-bold);
  }

  .save:disabled {
    opacity: 0.45;
  }

  .destroy {
    background: var(--color-danger);
    color: var(--color-accent-ink);
  }

  .delete {
    align-self: center;
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    color: var(--color-danger);
    font-size: var(--text-sm);
  }

  .confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-md);
  }

  .confirm p {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .error {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-danger);
    font-size: var(--text-sm);
    text-align: center;
  }
</style>
