<!--
  The mark on both magic buttons.

  A wand with two sparks rather than a robot or a brain, and that is a choice
  about honesty as much as style. Nothing behind either button is AI — it is
  counting, the same dull arithmetic as the shop order and the "you usually
  need…" strip (NIU.md §5) — but the *feeling* it should give is that the app
  did something for you. A wand says that without claiming anything it cannot
  back up.

  One component because the two buttons are a pair and must read as one idea: a
  household that learns what Fill the week means has learnt what Fill the list
  means too. No icon npm package, per CLAUDE.md; this is a hand-written path
  like every other glyph in the app.
-->
<script lang="ts">
  let { size = 20 }: { size?: number } = $props()
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
  <!-- The wand, corner to corner. -->
  <path d="m5 19 9.5-9.5" />
  <path d="m13 7.5 3.5 3.5" />
  <!-- Two sparks: one big off the tip, one small trailing it. -->
  <path d="M17.5 3v3M16 4.5h3" />
  <path d="M20 9.5v2M19 10.5h2" />
</svg>
