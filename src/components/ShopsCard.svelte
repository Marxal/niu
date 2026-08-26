<!--
  Managing the shops, in Settings.

  This is a once-a-year screen — you add Willys the first time you go there and
  then never touch it again — which is exactly why it isn't on the shopping tab.
  Choosing *which* of them you're in right now is a weekly thing, and that lives
  where a thumb is already: the chip row at the top of the list.

  Removing a shop throws away everything it had learned about its own aisles, so
  it asks first. The confirmation is inline rather than a dialog: it is one row
  turning into a question, which is proportionate to a decision you can undo by
  walking round the shop twice.

  There is always at least one shop. The database makes another one on the next
  load if you get rid of them all, which would look like the delete had silently
  failed, so the last one simply can't be removed.
-->
<script lang="ts">
  import { type Shop, addShop, makeDefaultShop, removeShop, shops } from '../lib/shops.svelte'
  import { strings } from '../lib/strings'

  let { userId }: { userId: string | null } = $props()

  let name = $state('')
  let confirming = $state<string | null>(null)

  function submit(event: Event) {
    event.preventDefault()
    if (!userId) return
    void addShop(name, userId)
    name = ''
  }

  function confirmRemove(shop: Shop) {
    confirming = null
    void removeShop(shop.id)
  }
</script>

<div class="card">
  <div class="row stack">
    <div class="text">
      <h2>{strings.shops.title}</h2>
      <p>{strings.shops.hint}</p>
    </div>
  </div>

  {#each shops.all as shop (shop.id)}
    <div class="row">
      {#if confirming === shop.id}
        <div class="text">
          <h2>{strings.shops.removeTitle}</h2>
          <p>{strings.shops.removeBody}</p>
        </div>
        <div class="pair">
          <button class="small" onclick={() => (confirming = null)}>
            {strings.shops.removeCancel}
          </button>
          <button class="small danger" onclick={() => confirmRemove(shop)}>
            {strings.shops.remove}
          </button>
        </div>
      {:else}
        <div class="text">
          <h2>{shop.name}</h2>
          {#if shop.isDefault}
            <p>{strings.shops.main}</p>
          {:else}
            <button class="link" onclick={() => void makeDefaultShop(shop.id)}>
              {strings.shops.makeMain}
            </button>
          {/if}
        </div>
        {#if shops.all.length > 1}
          <button class="small" onclick={() => (confirming = shop.id)}>
            {strings.shops.remove}
          </button>
        {/if}
      {/if}
    </div>
  {/each}

  <div class="row">
    <form onsubmit={submit}>
      <input
        type="text"
        bind:value={name}
        maxlength="40"
        enterkeyhint="done"
        placeholder={strings.shops.addPlaceholder}
        aria-label={strings.shops.addPlaceholder}
      />
      <button class="small add" type="submit" disabled={name.trim() === ''}>
        {strings.shops.add}
      </button>
    </form>
  </div>

  {#if shops.error}
    <p class="error" role="alert">{shops.error}</p>
  {/if}
</div>

<style>
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
    min-height: var(--tap-min);
  }

  .row + .row {
    border-top: 1px solid var(--color-border);
  }

  .row.stack {
    flex-direction: column;
    align-items: stretch;
  }

  .text {
    min-width: 0;
  }

  h2 {
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    overflow-wrap: anywhere;
  }

  p {
    margin-top: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .link {
    margin-top: var(--space-1);
    color: var(--color-accent);
    font-size: var(--text-sm);
    text-decoration: underline;
  }

  .pair {
    display: flex;
    flex: none;
    gap: var(--space-2);
  }

  .small {
    flex: none;
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .small.danger {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }

  .small.add {
    background: var(--color-accent);
    border-color: transparent;
    color: var(--color-accent-ink);
  }

  .small:disabled {
    opacity: 0.45;
  }

  form {
    display: flex;
    gap: var(--space-2);
    width: 100%;
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

  .error {
    padding: var(--space-3) var(--space-4);
    background: var(--color-accent-soft);
    color: var(--color-danger);
    font-size: var(--text-sm);
  }
</style>
