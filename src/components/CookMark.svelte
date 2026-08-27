<!--
  "Somebody has to cook this."

  A pot with a rising check, because the mark means two things at once and both
  matter: *this needs doing*, and *it is something you tick off*. Distinct at a
  glance from CookIcon's three glyphs, which describe the dish itself (no cook /
  quick / slow) rather than the evening.
-->
<script lang="ts">
  let { size = 18 }: { size?: number } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.9"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M4 11h16v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-4Z" />
  <path d="M3 11h18" />
  <path d="m9 7 1.5-2M14 7l1.5-2" />
</svg>
