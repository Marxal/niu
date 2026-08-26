<!-- The trolley section's heading icon. Same line language as the item icons. -->
<script lang="ts">
  let { size = 20 }: { size?: number } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d="M2.6 4.4h2.6l2.2 9.6h9.4l2-7.2H6.2" />
  <path d="M9.4 18.6a1.3 1.3 0 1 0 0-.1Z" />
  <path d="M16 18.6a1.3 1.3 0 1 0 0-.1Z" />
</svg>
