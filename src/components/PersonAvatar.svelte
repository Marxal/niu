<!--
  One person, as a circle. Was MemberAvatar until round 11.2, when people
  stopped being the same thing as accounts.

  Four ways of drawing the same thing, in order: a photo this household
  uploaded, the Google picture that came with the account, the emoji they
  picked, the first letter of their name. Each can be absent and none is worth
  blocking on — the same stance NIU.md §6 takes about item icons.

  The ring is always the person's colour, whatever is inside it. That is the
  half §4.3 asks for: "category as the event's fill, person as an avatar ring",
  so a person's colour and an event's colour can sit side by side and still be
  told apart. A photo would otherwise lose the colour entirely.

  The colour arrives as a *name* and goes through tagStyle(), so no component
  ever writes down a colour value — including one somebody chose themselves.
-->
<script lang="ts">
  import { tagStyle } from '../lib/dish-tags'
  import { type Person, personInitial, personName, personPhoto } from '../lib/people.svelte'

  let {
    person,
    size = 'md',
    on = null,
    onclick,
  }: {
    person: Person | null
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Null draws a plain avatar. A boolean makes it read as a choice. */
    on?: boolean | null
    onclick?: (() => void) | undefined
  } = $props()

  let label = $derived(personName(person))
  let style = $derived(tagStyle(person?.colour ?? 'stone'))
  let photo = $derived(personPhoto(person))

  /**
   * Set when a photo fails to load, so it falls back rather than showing a
   * broken frame. A Google picture can 404 once the account changes it, and a
   * signed link expires after an hour.
   */
  let broken = $state(false)

  /**
   * Whether there is a *picture* in the circle rather than a letter.
   *
   * It decides how "chosen" is drawn. A letter is text and inverts cleanly —
   * dark circle, pale letter. A photo cannot invert at all, and an emoji is a
   * coloured glyph, so putting it on a dark fill makes a muddy blob rather than
   * a selected face. Both of those say it on the edge instead.
   */
  let hasPicture = $derived((photo !== null && !broken) || (person?.avatar ?? null) !== null)

  // A new photo deserves a fresh attempt: without this, one failure would stick
  // for as long as the component lived.
  $effect(() => {
    photo
    broken = false
  })
</script>

{#snippet face()}
  {#if photo && !broken}
    <img class="photo" src={photo} alt="" loading="lazy" onerror={() => (broken = true)} />
  {:else if person?.avatar}
    <span class="emoji">{person.avatar}</span>
  {:else}
    {personInitial(person)}
  {/if}
{/snippet}

{#if onclick}
  <button
    class="avatar {size}"
    class:on={on === true}
    class:choosable={on !== null}
    class:has-picture={hasPicture}
    {style}
    aria-pressed={on === null ? undefined : on}
    aria-label={label}
    title={label}
    {onclick}
  >
    {@render face()}
  </button>
{:else}
  <span
    class="avatar {size}"
    class:has-picture={hasPicture}
    {style}
    title={label}
    aria-label={label}
    role="img"
  >
    {@render face()}
  </span>
{/if}

<style>
  .avatar {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    overflow: hidden;
    border-radius: var(--radius-full);
    border: 2px solid var(--tag-ink);
    background: var(--tag-fill);
    color: var(--tag-ink);
    font-weight: var(--weight-bold);
    line-height: 1;
    user-select: none;
    padding: 0;
    transition:
      background var(--dur-fast) var(--ease),
      color var(--dur-fast) var(--ease),
      opacity var(--dur-fast) var(--ease);
  }

  .sm {
    width: 1.5rem;
    height: 1.5rem;
    font-size: var(--text-xs);
    border-width: 1px;
  }

  .md {
    width: 2.25rem;
    height: 2.25rem;
    font-size: var(--text-sm);
  }

  .lg {
    width: 3rem;
    height: 3rem;
    font-size: var(--text-lg);
  }

  .xl {
    width: 5rem;
    height: 5rem;
    font-size: var(--text-2xl);
    border-width: 3px;
  }

  .photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* The phone's own emoji arrives far louder than the rest of the palette.
     Same treatment the shopping tiles get — a filter, never an edit. */
  .emoji {
    filter: var(--icon-emoji-filter);
    font-size: 1.1em;
  }

  /* An unpicked avatar in a chooser is present but not chosen: readable, and
     clearly not the same as the one beside it that is. */
  .choosable:not(.on) {
    opacity: 0.45;
    border-style: dashed;
  }

  /* A picture already fills the circle, so "chosen" is said on the edge. */
  .choosable.on.has-picture {
    box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--tag-ink);
  }

  /* Only a letter inverts — see hasPicture above. */
  .on:not(.has-picture) {
    background: var(--tag-ink);
    color: var(--color-surface);
  }

  button.avatar:active {
    transform: scale(0.94);
  }
</style>
