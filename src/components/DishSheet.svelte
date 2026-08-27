<!--
  Writing down a dish: what it's called, what it looks like, where it sits in a
  meal, how much cooking it is, and what it's made of.

  One deliberate difference from ItemDetailSheet, which saves every edit as you
  make it: this one has a Save button. Three reasons, and they are specific to a
  dish rather than a matter of taste —

    1. A dish needs a name to exist at all, and the name is unique per
       household. Saving as you type would try to create "L", then "La", then
       "Las", and the second of those would already have collided with itself.
    2. Ingredients are rows in a second table. Saving them live would write and
       delete rows while someone was still making up their mind, and every one of
       those writes lands on the other phone.
    3. A dish is edited once and then left alone for months. The cost of a Save
       button is one tap in a rare flow; the cost of getting the above wrong is
       paid every time.

  Closing without saving therefore discards, which is why Cancel says Cancel.

  The picture is chosen with exactly the same sheet the shopping tiles use, so a
  dish can be an emoji, an OpenMoji drawing or one of the house line icons —
  whichever reads best at tile size for something like "that rice thing".
-->
<script lang="ts">
  import CookIcon from './CookIcon.svelte'
  import GroceryIcon from './GroceryIcon.svelte'
  import IconPickerSheet from './IconPickerSheet.svelte'
  import IngredientPicker from './IngredientPicker.svelte'
  import TagChip from './TagChip.svelte'
  import TagSheet from './TagSheet.svelte'
  import { type Dish, type DishCook, DISH_COOKS, isSaveable } from '../lib/dishes'
  import type { DishTag } from '../lib/dish-tags'
  import { dishes, removeDish, saveDish } from '../lib/dishes.svelte'
  import { strings } from '../lib/strings'

  let {
    dish,
    userId,
    seedItemIds = [],
    onSaved,
    onClose,
  }: {
    /** The dish being edited, or null to write a new one. */
    dish: Dish | null
    userId: string | null
    /**
     * Ingredients a *new* dish starts with. Set when the sheet is opened from
     * "Add to a dish → New dish" on the shopping tab: the tile you long-pressed
     * is the reason the dish is being written, so it should already be in it.
     * Ignored when editing, which has its own list.
     */
    seedItemIds?: string[]
    /**
     * Called with the dish that was just written, before onClose.
     *
     * The planner uses it to plant a brand-new dish straight onto the meal its
     * picker was opened from (Marçal, round 10.1): before this, "+ Add → New
     * dish → Add it" wrote the dish and then dropped you back on an empty meal,
     * which looked exactly like the tap having failed.
     */
    onSaved?: ((dish: Dish) => void) | undefined
    onClose: () => void
  } = $props()

  const cookLabels: Record<DishCook, string> = {
    none: strings.dishes.cookNone,
    fast: strings.dishes.cookFast,
    slow: strings.dishes.cookSlow,
  }

  // Local copies, snapshotted once. The parent keys this sheet on the dish, so
  // editing a different one mounts a fresh component — and a realtime update
  // from the other phone must never overwrite a field under someone's thumb.
  /* svelte-ignore state_referenced_locally */
  let name = $state(dish?.name ?? '')
  /* svelte-ignore state_referenced_locally */
  let icon = $state<string | null>(dish?.icon ?? null)
  /* svelte-ignore state_referenced_locally */
  let cook = $state<DishCook>(dish?.cook ?? 'none')
  /* svelte-ignore state_referenced_locally */
  let tagIds = $state<string[]>([...(dish?.tagIds ?? [])])
  /* svelte-ignore state_referenced_locally */
  let itemIds = $state<string[]>([...(dish?.itemIds ?? seedItemIds)])

  let pickingIcon = $state(false)
  let confirmingDelete = $state(false)
  let saving = $state(false)
  /**
   * The tag editor: 'new' from the Add button, a tag from a long press on its
   * chip. Both open the same sheet — it is the same three questions either way.
   */
  let editingTag = $state<DishTag | 'new' | null>(null)

  let chosenTags = $derived(new Set(tagIds))

  let draft = $derived({ name, icon, cook, tagIds, itemIds })
  let canSave = $derived(isSaveable(draft) && !saving)

  async function save() {
    if (!canSave || !userId) return
    saving = true
    const savedId = await saveDish(draft, userId, dish)
    saving = false

    // A failure leaves the sheet open with the typing still in it, and the
    // reason underneath — closing here would throw the work away.
    if (!savedId) return

    // Read back from the store rather than reusing the draft: saveDish re-reads,
    // so this is the row as the database actually holds it, ids and all.
    const saved = dishes.byId.get(savedId)
    if (saved && onSaved) {
      onSaved(saved)
      return
    }
    onClose()
  }

  function confirmDelete() {
    confirmingDelete = false
    if (dish) void removeDish(dish.id)
    onClose()
  }

  function toggleTag(tagId: string) {
    tagIds = chosenTags.has(tagId)
      ? tagIds.filter((id) => id !== tagId)
      : [...tagIds, tagId]
  }

  /**
   * A part just written or renamed. Selecting it is the point of having written
   * it — nobody adds "Pudding" in the middle of editing a dish for later.
   */
  function tagSaved(tagId: string) {
    if (!chosenTags.has(tagId)) tagIds = [...tagIds, tagId]
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div
  class="sheet"
  role="dialog"
  aria-modal="true"
  aria-label={dish ? strings.dishes.edit : strings.dishes.new}
>
  <header>
    <h2>{dish ? strings.dishes.edit : strings.dishes.new}</h2>
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
    <!-- The picture sits beside the name rather than under it: it is a one-tap
         choice, and putting it on its own row would push everything else down
         for something most dishes never change. -->
    <div class="named">
      <button
        class="glyph"
        onclick={() => (pickingIcon = true)}
        aria-label={strings.dishes.iconLabel}
      >
        <GroceryIcon {icon} name={name === '' ? '?' : name} size={28} />
      </button>
      <input
        type="text"
        bind:value={name}
        maxlength="60"
        placeholder={strings.dishes.namePlaceholder}
        aria-label={strings.dishes.nameLabel}
        enterkeyhint="done"
        autocomplete="off"
      />
    </div>

    <!-- Tags, not one choice out of four. A lasagne is protein *and* carbs, and
         the fourth value used to be "other", which was a shrug. Long-press a
         chip to rename or recolour it; Add writes a new one. -->
    <div class="control">
      <span class="label">{strings.dishes.tagsTitle}</span>
      <div class="chips" role="group" aria-label={strings.dishes.tagsTitle}>
        {#each dishes.tags as tag (tag.id)}
          <TagChip
            {tag}
            on={chosenTags.has(tag.id)}
            onclick={() => toggleTag(tag.id)}
            onlongpress={() => (editingTag = tag)}
          />
        {/each}
        <button class="add-tag" onclick={() => (editingTag = 'new')}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {strings.dishes.tagsAdd}
        </button>
      </div>
      {#if dishes.tags.length === 0}
        <p class="none">{strings.dishes.tagNone}</p>
      {/if}
    </div>

    <div class="control">
      <span class="label">{strings.dishes.cookTitle}</span>
      <div class="segmented" role="group" aria-label={strings.dishes.cookTitle}>
        {#each DISH_COOKS as option (option)}
          <button
            class="segment cook"
            class:on={cook === option}
            aria-pressed={cook === option}
            onclick={() => (cook = option)}
          >
            <CookIcon cook={option} size={18} />
            {cookLabels[option]}
          </button>
        {/each}
      </div>
    </div>

    <IngredientPicker chosen={itemIds} {userId} onChange={(ids) => (itemIds = ids)} />
  </div>

  {#if dishes.error}
    <p class="error" role="alert">{dishes.error}</p>
  {/if}

  {#if dish}
    {#if confirmingDelete}
      <div class="confirm">
        <p><strong>{strings.dishes.deleteTitle}</strong> {strings.dishes.deleteBody}</p>
        <div class="actions">
          <button class="cancel" onclick={() => (confirmingDelete = false)}>
            {strings.dishes.deleteCancel}
          </button>
          <button class="destroy" onclick={confirmDelete}>{strings.dishes.deleteConfirm}</button>
        </div>
      </div>
    {:else}
      <button class="delete" onclick={() => (confirmingDelete = true)}>
        {strings.dishes.delete}
      </button>
    {/if}
  {/if}

  <div class="actions">
    <button class="cancel" onclick={onClose}>{strings.dishes.cancel}</button>
    <button class="save" onclick={save} disabled={!canSave}>
      {dish ? strings.dishes.save : strings.dishes.create}
    </button>
  </div>
</div>

{#if editingTag}
  {#key editingTag === 'new' ? 'new' : editingTag.id}
    <TagSheet
      tag={editingTag === 'new' ? null : editingTag}
      {userId}
      onSaved={tagSaved}
      onClose={() => (editingTag = null)}
    />
  {/key}
{/if}

{#if pickingIcon}
  <IconPickerSheet
    {name}
    current={icon}
    onPick={(picked) => {
      icon = picked
      pickingIcon = false
    }}
    onReset={() => {
      icon = null
      pickingIcon = false
    }}
    onClose={() => (pickingIcon = false)}
  />
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-sheet);
    background: var(--color-overlay);
  }

  .sheet {
    position: fixed;
    /* Rides above the on-screen keyboard rather than under it. */
    inset: auto 0 var(--keyboard-inset, 0px) 0;
    z-index: var(--z-sheet);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: var(--content-max);
    max-height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    margin-inline: auto;
    /* No padding at the bottom: the pinned action row below carries it, so it
       can sit flush with the bottom of the scroll area. Without that, the strip
       of padding under a sticky element is exactly where the content scrolling
       past it shows through. */
    padding: var(--space-4) var(--space-4) 0;
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

  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .named {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .glyph {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--tap-min);
    height: var(--tap-min);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-tab-meals);
  }

  input {
    flex: 1;
    min-width: 0;
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

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .add-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 2.25rem;
    padding: 0 var(--space-3);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .none {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }

  /* Same segmented control as Settings. Four across fits at 412px because the
     labels are one short word each. */
  .segmented {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
  }

  .segment {
    min-height: 2.5rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  /* Icon *beside* its label rather than above it (Marçal, round 10.2), which
     halves the height of this row. It fits at 412px because the three words are
     short and the glyph is 16px: measured, not hoped for. `min-width: 0` lets a
     segment shrink rather than pushing the row wider than the sheet. */
  .cook {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    min-width: 0;
    gap: var(--space-1);
    white-space: nowrap;
    min-height: var(--tap-min);
    font-size: var(--text-xs);
  }

  .segment.on {
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-1);
  }

  /* Stuck to the bottom of the sheet rather than the end of its content: the
     ingredient list can be long, and Save should never need a scroll to reach.
     The negative margins let the background run to the sheet's own edges. */
  .actions {
    position: sticky;
    bottom: 0;
    display: flex;
    gap: var(--space-3);
    margin: 0 calc(var(--space-4) * -1);
    padding: var(--space-3) var(--space-4);
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
    background: var(--color-surface);
  }

  /* The delete confirmation has its own pair inside a bordered box — that one
     scrolls with the content it belongs to. */
  .confirm .actions {
    position: static;
    margin: 0;
    padding: 0;
    background: none;
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

  /* Quiet, and at the very bottom: destroying a dish is not what this sheet is
     for, and it shouldn't compete with Save. */
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
