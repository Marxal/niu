<!--
  A line of text that says what just happened, then goes away.

  It exists because of one specific problem: tapping a dish adds several things
  at once, and the tile it was tapped from doesn't change — unlike a grocery
  tile, which greys out and reappears in the list above. Without a word from the
  app, tapping "Lasagne" looks exactly like tapping nothing, especially when
  every ingredient was already on the list and so nothing visibly moves.

  Deliberately not a toast library and deliberately not interactive: no buttons,
  no undo, nothing to dismiss. It is a sentence, it sits above the search field
  where the thumb already is, and it leaves on its own.

  role="status" rather than role="alert" — a screen reader should mention it at
  the next pause, not interrupt whatever it was reading.
-->
<script lang="ts">
  let {
    message,
    tone = 'good',
    onDone,
  }: {
    message: string
    /** 'bad' for a failure — same shape, different colour. */
    tone?: 'good' | 'bad'
    onDone: () => void
  } = $props()

  /** Long enough to read a short sentence, short enough not to linger. */
  const SHOW_MS = 2800

  $effect(() => {
    const timer = setTimeout(onDone, SHOW_MS)
    return () => clearTimeout(timer)
  })
</script>

<div class="flash {tone}" role="status">{message}</div>

<style>
  .flash {
    position: fixed;
    right: 0;
    /* Clear of the search field, which sits on top of the nav. */
    bottom: calc(var(--nav-height) + var(--tap-min) + var(--space-5));
    left: 0;
    z-index: var(--z-toast);
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--space-3) var(--space-4);
    /* An inline-ish pill, centred, rather than a full-width bar: it is a remark,
       not a state the screen is in. */
    width: fit-content;
    max-inline-size: calc(100% - var(--space-6));
    border-radius: var(--radius-full);
    background: var(--color-pick);
    color: var(--color-accent-ink);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    text-align: center;
    box-shadow: var(--shadow-2);
    animation: rise var(--dur-base) var(--ease);
  }

  .flash.bad {
    background: var(--color-danger);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(var(--space-2));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .flash {
      animation: none;
    }
  }
</style>
