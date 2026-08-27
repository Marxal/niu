<!--
  "Which category?" — moving one shopping item somewhere it makes more sense.

  Reached from the tile's long-press menu, and it is a per-household opinion
  rather than an edit: most of the catalogue is a shared seed, so this writes an
  override beside the row (see 0011_planner_tweaks.sql). One house deciding that
  halloumi belongs under Cheese must not move it for everybody.

  The existing categories come first and are the whole point. A free field alone
  would fill the shopping tab with "Cupboard", "cupboard" and "Cupboards" inside
  a month — categories here are names, not rows with ids, so two spellings really
  are two categories. Writing a new one is still possible, one tap further in.
-->
<script lang="ts">
  import { strings } from '../lib/strings'

  let {
    itemName,
    current,
    categories,
    isOverridden,
    onPick,
    onReset,
    onClose,
  }: {
    itemName: string
    /** Where it sits right now. */
    current: string
    /** Every category in this household's catalogue, in shopping-tab order. */
    categories: string[]
    /** True when it has already been moved, so it can be put back. */
    isOverridden: boolean
    onPick: (category: string) => void
    onReset: () => void
    onClose: () => void
  } = $props()

  let writing = $state(false)
  let name = $state('')

  let canWrite = $derived(
    name.trim() !== '' &&
      !categories.some((c) => c.toLocaleLowerCase() === name.trim().toLocaleLowerCase()),
  )

  function submit(event: Event) {
    event.preventDefault()
    if (!canWrite) return
    onPick(name.trim())
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.shopping.categoryTitle}>
  <header>
    <div>
      <h2>{strings.shopping.categoryTitle}</h2>
      <p>{itemName} — {strings.shopping.categoryHint}</p>
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
    <div class="chips">
      {#each categories as category (category)}
        <button
          class="chip"
          class:on={category === current}
          aria-pressed={category === current}
          onclick={() => onPick(category)}
        >
          {category}
        </button>
      {/each}
    </div>

    {#if writing}
      <form onsubmit={submit}>
        <input
          type="text"
          bind:value={name}
          placeholder={strings.shopping.categoryNamePlaceholder}
          aria-label={strings.shopping.categoryNew}
          maxlength="40"
          enterkeyhint="done"
        />
        <button type="submit" class="write" disabled={!canWrite}>
          {strings.dishes.tagsAdd}
        </button>
      </form>
    {:else}
      <button class="new" onclick={() => (writing = true)}>
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
        {strings.shopping.categoryNew}
      </button>
    {/if}

    {#if isOverridden}
      <button class="reset" onclick={onReset}>{strings.shopping.categoryReset}</button>
    {/if}
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
    gap: var(--space-3);
    max-height: 76vh;
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
    gap: var(--space-3);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    min-height: 2.5rem;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
  }

  .chip.on {
    border-color: var(--color-tab-shopping);
    background: var(--color-tab-shopping);
    color: var(--color-accent-ink);
    font-weight: var(--weight-bold);
  }

  form {
    display: flex;
    gap: var(--space-2);
  }

  input {
    flex: 1;
    min-width: 0;
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--text-base);
  }

  .write,
  .new {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border-radius: var(--radius-full);
    background: var(--color-tab-shopping);
    color: var(--color-accent-ink);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .write:disabled {
    opacity: 0.5;
  }

  .reset {
    min-height: var(--tap-min);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    text-decoration: underline;
  }
</style>
