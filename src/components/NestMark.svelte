<!--
  The Niu logo — a nest with an egg in it. "Niu" is Catalan for nest.

  Same shape as the app icon in scripts/generate-icons.mjs. If the mark ever
  changes, change both; this one is drawn on a 64-unit grid to match the
  favicon, while the icon script rasterises it with maths.
-->
<script lang="ts">
  let { size = 64 }: { size?: number } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 64 64"
  role="img"
  aria-label="Niu"
  class="mark"
>
  <rect width="64" height="64" rx="14" fill="var(--color-accent)" />
  <g fill="none" stroke="var(--color-accent-ink)" stroke-linecap="round">
    <path d="M14.4 34.6a17.6 17.6 0 0 0 35.2 0" stroke-width="6.4" />
    <!-- Loose straw. Thinner than the bowl, matching the rasterised app icon —
         at the same weight they merge into the rim and read as handles. -->
    <path d="M14.4 33.6 8.6 28.9" stroke-width="3.4" />
    <path d="M49.6 33.6 55.4 28.9" stroke-width="3.4" />
  </g>
  <circle cx="32" cy="28.7" r="8" fill="var(--color-accent-ink)" />
</svg>

<style>
  .mark {
    display: block;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2);
  }
</style>
