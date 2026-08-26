<!--
  The drawing shown when the list is empty.

  Same language as the tile icons — one colour, stroked outlines, round caps —
  just bigger and looser. It is a shopping basket with a few things resting in
  it and a couple of leaves above, which reads as "nothing here yet" without
  needing the word "empty" drawn into it.

  Deliberately low contrast: this sits above real text and a picker full of
  tappable tiles, and it should be the quietest thing on screen, not the loudest.
-->
<svg
  viewBox="0 0 160 130"
  fill="none"
  stroke="currentColor"
  stroke-width="2.4"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  class="art"
>
  <!-- basket -->
  <path d="M26 54h108l-9.5 49a12 12 0 0 1-11.8 9.6H47.3A12 12 0 0 1 35.5 103Z" />
  <path d="M18 54h124" />
  <!-- weave -->
  <path d="M46 66.5 49.5 97" opacity="0.55" />
  <path d="M66 66.5 68 97" opacity="0.55" />
  <path d="M94 66.5 92 97" opacity="0.55" />
  <path d="M114 66.5 110.5 97" opacity="0.55" />
  <path d="M32.5 79h95" opacity="0.55" />
  <!-- handle -->
  <path d="M56 54a24 24 0 0 1 48 0" />
  <!-- a loaf and a bottle resting inside -->
  <path d="M60 54c0-7 5.5-12 12.5-12S85 47 85 54" opacity="0.75" />
  <path d="M99 54V40.5a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4V54" opacity="0.75" />
  <path d="M102.5 36.5v-4h7v4" opacity="0.75" />
  <!-- leaves drifting above, borrowed from the nest mark -->
  <path d="M78 26c0-7-5-12-12-12 0 7 5 12 12 12Z" opacity="0.6" />
  <path d="M84 22c0-6 4.5-10.5 10.5-10.5C94.5 17.5 90 22 84 22Z" opacity="0.6" />
  <path d="M80 32V22" opacity="0.6" />
</svg>

<style>
  .art {
    width: 100%;
    max-width: 12rem;
    height: auto;
    color: var(--color-border-strong);
  }
</style>
