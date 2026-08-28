<!--
  A switch: a label with an on/off track beside it.

  The app's usual way of saying yes-or-no is a chip that fills in when it is on
  (`.chip.on`), and that works well in a row of several where only one is
  chosen. It works badly for a lone question — a filled chip reading "All day"
  says *what* rather than *whether*, and you have to have seen it in both states
  to know which one you are looking at.

  A switch says whether by itself, which is why Google's event editor uses one
  for exactly this question and why round 13 brought one in. Two places use it:
  All day, and whether to send the event round for confirmation.

  It is a real `<button role="switch">` rather than a checkbox, because the whole
  row is the tap target and 48px of it should be, not the 20px track on the end.
-->
<script lang="ts">
  let {
    label,
    on,
    hint = null,
    onchange,
  }: {
    label: string
    on: boolean
    /** A quiet line under the label, when the switch needs a word of context. */
    hint?: string | null
    onchange: (on: boolean) => void
  } = $props()
</script>

<button
  class="toggle"
  type="button"
  role="switch"
  aria-checked={on}
  onclick={() => onchange(!on)}
>
  <span class="text">
    <span class="label">{label}</span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </span>
  <span class="track" class:on aria-hidden="true"><span class="knob"></span></span>
</button>

<style>
  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--tap-min);
    padding: 0;
    border: none;
    background: none;
    color: var(--color-text);
    text-align: left;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .label {
    font-size: var(--text-base);
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
  }

  .track {
    flex: none;
    position: relative;
    width: 2.75rem;
    height: 1.625rem;
    border-radius: var(--radius-full);
    background: var(--color-surface-sunken);
    box-shadow: inset 0 0 0 1px var(--color-border-strong);
    transition: background var(--dur-fast) var(--ease);
  }

  .track.on {
    background: var(--color-tab-calendar);
    box-shadow: none;
  }

  .knob {
    position: absolute;
    top: 0.1875rem;
    left: 0.1875rem;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: var(--radius-full);
    background: var(--color-surface);
    box-shadow: var(--shadow-1);
    transition: transform var(--dur-fast) var(--ease);
  }

  .track.on .knob {
    transform: translateX(1.125rem);
  }

  @media (prefers-reduced-motion: reduce) {
    .track,
    .knob {
      transition: none;
    }
  }
</style>
