<!--
  "Fill the week" — a whole week proposed, before any of it is written.

  NIU.md §4.2 has asked for this since the beginning and has always attached one
  condition to it: *"Auto-suggest a week: yes, once there's enough data. The
  user always approves."* So this is a proposal you tick, not a week that
  appears. Untick Thursday and Thursday stays empty.

  ## What it is showing

  One row per proposed card, grouped by day, in the order the week reads. Each
  row says **why** it is there — "usually a Friday", "the night after", "you
  have this often" — because a suggestion you cannot account for is one you stop
  trusting. That is the same argument the "you usually need…" strip's hint line
  makes, and it matters more here: this one is proposing fourteen things at once.

  Everything starts ticked. The common case is that the pattern is right, and
  the ticks are for the exceptions.

  ## What it never does

  It never touches a meal that already has something in it — the proposal simply
  does not contain those slots (see plan-magic.ts). "Magic" that wiped
  Thursday's dinner because it thought it knew better would be used exactly
  once, so the sheet says so in as many words at the bottom.

  Nothing here writes. It hands the ticked cards back to the planner.
-->
<script lang="ts">
  import GroceryIcon from './GroceryIcon.svelte'
  import MagicIcon from './MagicIcon.svelte'
  import MarkerIcon from './MarkerIcon.svelte'
  import type { Dish } from '../lib/dishes'
  import type { ProposedEntry } from '../lib/plan-magic'
  import { MEAL_LABELS, dayName, shortDate } from '../lib/plan'
  import type { CatalogueItem } from '../lib/shopping.svelte'
  import { strings } from '../lib/strings'

  let {
    proposed,
    dishesById,
    itemsById,
    today,
    rangeLabel,
    busy = false,
    onApply,
    onClose,
  }: {
    /** Already ordered by day, then by the order meals happen. */
    proposed: readonly ProposedEntry[]
    dishesById: ReadonlyMap<string, Dish>
    itemsById: ReadonlyMap<string, CatalogueItem>
    today: string
    rangeLabel: string
    busy?: boolean
    /** The cards that survived the ticking, in the order they were proposed. */
    onApply: (chosen: ProposedEntry[]) => void
    onClose: () => void
  } = $props()

  /**
   * A key per proposed card. There is no id yet — nothing has been written —
   * and two cards can name the same dish on two days, so the slot is part of it.
   */
  function keyOf(entry: ProposedEntry): string {
    return `${entry.date}|${entry.meal}|${entry.kind}|${entry.dishId ?? entry.itemId ?? ''}`
  }

  /* svelte-ignore state_referenced_locally */
  let unticked = $state<Set<string>>(new Set())

  let chosen = $derived(proposed.filter((entry) => !unticked.has(keyOf(entry))))

  /** Grouped by day, so the sheet reads like the week it is proposing. */
  let days = $derived.by(() => {
    const out: { date: string; entries: ProposedEntry[] }[] = []
    for (const entry of proposed) {
      const last = out[out.length - 1]
      if (last && last.date === entry.date) last.entries.push(entry)
      else out.push({ date: entry.date, entries: [entry] })
    }
    return out
  })

  function nameOf(entry: ProposedEntry): string {
    if (entry.kind === 'out') return strings.plan.out
    if (entry.kind === 'item') return itemsById.get(entry.itemId ?? '')?.name ?? strings.plan.empty
    const dish = dishesById.get(entry.dishId ?? '')?.name ?? strings.plan.leftovers
    return entry.kind === 'leftovers' ? `${dish} again` : dish
  }

  function toggle(entry: ProposedEntry) {
    const key = keyOf(entry)
    const next = new Set(unticked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    unticked = next
  }

  function setAll(on: boolean) {
    unticked = on ? new Set() : new Set(proposed.map(keyOf))
  }
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={strings.plan.magicTitle}>
  <header>
    <div>
      <h2><MagicIcon size={19} />{strings.plan.magicTitle}</h2>
      <p>{rangeLabel} · {strings.plan.magicSubtitle}</p>
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
      <p class="none">{strings.plan.magicNone}</p>
    {:else}
      {#if proposed.length > 1}
        <div class="bulk">
          <button onclick={() => setAll(true)}>{strings.plan.magicAll}</button>
          <button onclick={() => setAll(false)}>{strings.plan.magicClear}</button>
        </div>
      {/if}

      {#each days as day (day.date)}
        <section>
          <h3>{dayName(day.date, today)} <span>{shortDate(day.date)}</span></h3>
          <ul class="rows">
            {#each day.entries as entry (keyOf(entry))}
              {@const on = !unticked.has(keyOf(entry))}
              {@const item = entry.itemId ? itemsById.get(entry.itemId) : null}
              <li>
                <button
                  class="row"
                  class:on
                  role="checkbox"
                  aria-checked={on}
                  onclick={() => toggle(entry)}
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
                  <!-- The same three-way split PlanCard makes, so a proposed
                       row and the card it becomes carry the same picture: the
                       two markers are drawn, not spelled with an initial. -->
                  <span class="glyph">
                    {#if entry.kind === 'out' || entry.kind === 'leftovers'}
                      <MarkerIcon kind={entry.kind === 'out' ? 'out' : 'leftovers'} size={22} />
                    {:else if entry.kind === 'item'}
                      <GroceryIcon
                        icon={item?.icon ?? null}
                        emoji={item?.emoji ?? null}
                        name={item?.name ?? '?'}
                        size={22}
                      />
                    {:else}
                      <GroceryIcon
                        icon={dishesById.get(entry.dishId ?? '')?.icon ?? null}
                        emoji={null}
                        name={nameOf(entry)}
                        size={22}
                      />
                    {/if}
                  </span>
                  <span class="text">
                    <span class="name">{nameOf(entry)}</span>
                    <span class="why">
                      {MEAL_LABELS[entry.meal]} ·
                      {strings.plan.magicWhy(
                        entry.reason,
                        dayName(entry.date, today),
                        MEAL_LABELS[entry.meal].toLocaleLowerCase(),
                      )}
                    </span>
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/each}

      <p class="keeps">{strings.plan.magicKeeps}</p>
    {/if}
  </div>

  {#if proposed.length > 0}
    <button class="go" onclick={() => onApply(chosen)} disabled={busy || chosen.length === 0}>
      {chosen.length === 0 ? strings.plan.magicNoneChosen : strings.plan.magicApply(chosen.length)}
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
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  h3 span {
    font-weight: var(--weight-medium);
    text-transform: none;
    color: var(--color-text-faint);
  }

  .none,
  .keeps {
    color: var(--color-text-faint);
    font-size: var(--text-sm);
  }

  .none {
    padding: var(--space-4) 0;
    text-align: center;
  }

  .keeps {
    font-size: var(--text-xs);
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

  .text {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }

  .why {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
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
