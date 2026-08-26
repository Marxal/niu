<!--
  Which shop you're standing in.

  Only appears once there is more than one shop, because with one shop it would
  be a control with a single option — the row exists to answer a question, and
  until a second shop is added there isn't one. Shops are added in Settings,
  which is where the rest of the once-a-year decisions live.

  The choice is device-local, not household-wide: you and the other person can
  be in different shops at the same time, and this reordering their list from
  across town would be worse than useless. See shops.svelte.ts.

  It scrolls sideways rather than wrapping, so five shops don't push the list
  itself down the screen.
-->
<script lang="ts">
  import type { Shop } from '../lib/shops.svelte'
  import { strings } from '../lib/strings'

  let {
    shops,
    currentId,
    onChoose,
  }: {
    shops: readonly Shop[]
    currentId: string | null
    onChoose: (shopId: string) => void
  } = $props()
</script>

{#if shops.length > 1}
  <div class="picker" role="group" aria-label={strings.shops.whichShop}>
    {#each shops as shop (shop.id)}
      <button
        class="chip"
        class:on={shop.id === currentId}
        aria-pressed={shop.id === currentId}
        onclick={() => onChoose(shop.id)}
      >
        {shop.name}
      </button>
    {/each}
  </div>
{/if}

<style>
  .picker {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    /* Room for the chips' shadow, and for the scroll not to clip a focus ring. */
    margin: calc(var(--space-1) * -1);
    padding: var(--space-1);
    scrollbar-width: none;
  }

  .chip {
    flex: none;
    min-height: 2.25rem;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    white-space: nowrap;
    transition:
      background var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease);
  }

  .chip.on {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }

  .chip:active {
    transform: scale(0.97);
  }
</style>
