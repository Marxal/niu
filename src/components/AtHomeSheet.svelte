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

  ## Three things a row does

  **Tap "Out of it"** and it goes on the shopping list.

  **Swipe it away** and it goes, and nothing else happens (round 15). This is
  the answer the sheet was missing: the other two both *disagree* with a row,
  and most rows are simply right. Something you bought on Saturday and know
  perfectly well is in the fridge has nothing to tell you, and reading past six
  of those to reach the one you were unsure about is why a sheet stops getting
  opened. The dismissal is per device and expires by itself the next time the
  thing is bought — see dismissed.svelte.ts.

  **Hold it** and you carry it onto the plan: the sheet gets out of the way
  immediately — you cannot aim at a week you cannot see — and the item follows
  your finger until you drop it on a meal.

  "Out of the way" is `hidden`, not unmounted, and that distinction is the whole
  reason the gesture works. A touch pointer is implicitly captured by the element
  it started on; remove that element and the browser fires `pointercancel` and
  the carry dies on the first move. So the sheet goes invisible and inert while
  the finger is down, and the screen unmounts it afterwards. See drag.svelte.ts.

  ## The explanation moved behind an ⓘ

  Three lines of caveat above the content is a paragraph you read once and then
  scroll past forever, and it pushed the actual answer below the fold. The
  caveat still matters — this is a guess and it says so — so it is one tap away
  rather than deleted.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import type { CarriedItem } from '../lib/drag.svelte'
  import type { AtHomeItem } from '../lib/plannable'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'
  import { swipeAway } from '../lib/swipe-away'

  let {
    items,
    itemsById,
    busyId = null,
    hidden = false,
    onAddToList,
    onDismiss,
    onCarry,
    onClose,
  }: {
    /** Already ordered, freshest first — see atHomeItems(). */
    items: AtHomeItem[]
    itemsById: ReadonlyMap<string, CatalogueItem>
    /** The row waiting on a write, so it can't be tapped twice. */
    busyId?: string | null
    /**
     * Out of sight but still in the DOM, while something picked up here is being
     * carried across the plan. Never unmount instead — see the header.
     */
    hidden?: boolean
    onAddToList: (itemId: string, name: string) => void
    /** Swiped off the sheet. Nothing goes on any list — see the header. */
    onDismiss: (entry: AtHomeItem, name: string) => void
    /** Held long enough to carry onto the plan. Closes the sheet, then follows. */
    onCarry: (item: CarriedItem, at: { x: number; y: number }) => void
    onClose: () => void
  } = $props()

  /** Same as the card drag, so one gesture means one thing across the app. */
  const LONG_PRESS_MS = 380
  const MOVE_TOLERANCE = 10

  let showInfo = $state(false)

  let sure = $derived(items.filter((item) => item.confidence === 'sure'))
  let check = $derived(items.filter((item) => item.confidence === 'check'))

  /**
   * The long press that starts a carry.
   *
   * Kept here rather than reusing `draggable`, because that action is built
   * around an element that stays put and a slot to drop into. This one's whole
   * job is to hand over to a window-level gesture and then vanish with its row.
   */
  let timer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0

  function cancelPress() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function pressStart(event: PointerEvent, entry: AtHomeItem) {
    const item = itemsById.get(entry.itemId)
    if (!item) return

    startX = event.clientX
    startY = event.clientY
    cancelPress()

    timer = setTimeout(() => {
      timer = null
      onCarry(
        { itemId: item.id, name: item.name, icon: item.icon, emoji: item.emoji },
        { x: startX, y: startY },
      )
    }, LONG_PRESS_MS)
  }

  function pressMove(event: PointerEvent) {
    if (timer === null) return
    // Moved before the press landed: that was the sheet being scrolled.
    if (
      Math.abs(event.clientX - startX) > MOVE_TOLERANCE ||
      Math.abs(event.clientY - startY) > MOVE_TOLERANCE
    ) {
      cancelPress()
    }
  }
</script>

<div class="backdrop" class:hidden role="presentation" onclick={onClose}></div>

<div
  class="sheet"
  class:hidden
  role="dialog"
  aria-modal="true"
  aria-label={strings.plan.homeTitle}
>
  <header>
    <div class="title">
      <h2>{strings.plan.homeTitle}</h2>
      <button
        class="info"
        class:on={showInfo}
        aria-expanded={showInfo}
        aria-label={strings.plan.homeInfo}
        onclick={() => (showInfo = !showInfo)}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </svg>
      </button>
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

  {#if showInfo}
    <p class="explain">{strings.plan.homeHint}</p>
  {/if}

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

  <!-- The one line that makes the gesture findable. A swipe nobody knows about
       is a swipe nobody makes, and this is cheaper than a tutorial. It hides
       with the list, because there is nothing to swipe off an empty sheet. -->
  {#if items.length > 0}
    <p class="swipe-hint">{strings.plan.homeSwipeHint}</p>
  {/if}
</div>

{#snippet rows(list: AtHomeItem[])}
  <ul class="list">
    {#each list as entry (entry.itemId)}
      {@const item = itemsById.get(entry.itemId)}
      <li
        class="row"
        class:unsure={entry.confidence === 'check'}
        use:swipeAway={{ onAway: () => onDismiss(entry, item?.name ?? '') }}
        onpointerdown={(event) => pressStart(event, entry)}
        onpointermove={pressMove}
        onpointerup={cancelPress}
        onpointercancel={cancelPress}
      >
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

  /* Invisible and untouchable, but still in the document, so the row that a
     carry started on stays alive to keep receiving the pointer. */
  .hidden {
    opacity: 0;
    pointer-events: none;
  }

  .sheet {
    position: fixed;
    inset: auto 0 0 0;
    z-index: var(--z-sheet);
    display: grid;
    /* Header, the optional explanation, the scrolling list, and the swipe
       hint pinned under it — the hint must not scroll away with the rows it
       is describing. */
    grid-template-rows: auto auto minmax(0, 1fr) auto;
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

  .title {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  /* Discreet on purpose. It is a footnote you can open, not a warning. */
  .info {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-full);
    color: var(--color-text-faint);
  }

  .info.on {
    background: var(--color-surface-sunken);
    color: var(--color-text-muted);
  }

  .explain {
    max-width: 26rem;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
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
    /* A row flying off must not widen the sheet on its way out. */
    overflow: hidden;
  }

  .swipe-hint {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    text-align: center;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap-min);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
    /* Vertical panning stays the browser's so the sheet still scrolls; the long
       press that starts a carry needs neither axis, and the callout menu a hold
       would otherwise raise is what this suppresses. */
    touch-action: pan-y;
    -webkit-touch-callout: none;
    user-select: none;
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
