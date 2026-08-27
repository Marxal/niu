<!--
  One person, as a circle.

  Three ways of drawing the same thing, in order of preference: the emoji they
  picked, the first letter of their name, a question mark. NIU.md §9 rules
  photos out of v1 and a household of two does not need face recognition — a
  ring of colour and a letter is enough to tell two people apart at a glance,
  which is the whole job.

  The colour arrives as a *name* and goes through tagStyle(), exactly as a dish
  tag does. That is the rule: a colour is never written down outside tokens.css,
  including one a person chose for themselves.

  `on` is the selected state for the attendee row. It fills rather than outlines,
  for the same reason TagChip does — at arm's length, filled reads as chosen and
  outlined reads as merely present.
-->
<script lang="ts">
  import { type Member, memberInitial, memberName } from '../lib/members.svelte'
  import { tagStyle } from '../lib/dish-tags'

  let {
    member,
    size = 'md',
    on = null,
    onclick,
  }: {
    member: Member | null
    size?: 'sm' | 'md' | 'lg'
    /** Null draws a plain avatar. A boolean makes it read as a choice. */
    on?: boolean | null
    onclick?: (() => void) | undefined
  } = $props()

  let label = $derived(memberName(member))
  let style = $derived(tagStyle(member?.colour ?? 'stone'))
</script>

{#if onclick}
  <button
    class="avatar {size}"
    class:on={on === true}
    class:choosable={on !== null}
    {style}
    aria-pressed={on === null ? undefined : on}
    aria-label={label}
    title={label}
    {onclick}
  >
    {#if member?.avatar}<span class="emoji">{member.avatar}</span>{:else}{memberInitial(member)}{/if}
  </button>
{:else}
  <span class="avatar {size}" {style} title={label} aria-label={label} role="img">
    {#if member?.avatar}<span class="emoji">{member.avatar}</span>{:else}{memberInitial(member)}{/if}
  </span>
{/if}

<style>
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    border-radius: var(--radius-full);
    border: 2px solid var(--tag-ink);
    background: var(--tag-fill);
    color: var(--tag-ink);
    font-weight: var(--weight-bold);
    line-height: 1;
    user-select: none;
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

  .on {
    background: var(--tag-ink);
    color: var(--color-surface);
  }

  button.avatar:active {
    transform: scale(0.94);
  }
</style>
