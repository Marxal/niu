<!--
  The two things a meal can be that aren't food you have to buy: leftovers, and
  eating out.

  Drawn rather than written wherever there is no room for the word — on a card in
  the week view, in the picker's marker row — and always with the word beside it
  where there is. Same stroke weight and round caps as every other glyph in the
  app, so a night out reads as a member of the set rather than as an exception.
-->
<script lang="ts">
  let { kind, size = 20 }: { kind: 'leftovers' | 'out'; size?: number } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if kind === 'leftovers'}
    <!-- Round again: a plate that comes back. -->
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 4v4h-4" />
  {:else}
    <!-- A fork and a knife, away from home. -->
    <path d="M7 3v7a2 2 0 0 0 4 0V3" />
    <path d="M9 10v11" />
    <path d="M17 3c-1.5 1.5-2 3-2 5s.7 3 2 3 2-1 2-3-.5-3.5-2-5Z" />
    <path d="M17 11v10" />
  {/if}
</svg>
