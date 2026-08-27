<!--
  A line of text that says what just happened, then goes away.

  It exists because of one specific problem: tapping a dish adds several things
  at once, and the tile it was tapped from doesn't change — unlike a grocery
  tile, which greys out and reappears in the list above. Without a word from the
  app, tapping "Lasagne" looks exactly like tapping nothing, especially when
  every ingredient was already on the list and so nothing visibly moves.

  Deliberately not a toast library. It is a sentence, it sits above the search
  field where the thumb already is, and it leaves on its own.

  It grew exactly one button, in round 10.1, and only for the case that earns it:
  swiping a meal off the plan. Every other message here reports something you can
  see and undo yourself — a tile greyed out, four things added to a list you are
  looking at. A swipe is the one gesture that *removes* something, can be done by
  accident on a scroll, and leaves nothing behind to put back. Nothing else
  should take this button; if a second thing wants it, that is the moment to ask
  whether it is really the same kind of message.

  role="status" rather than role="alert" — a screen reader should mention it at
  the next pause, not interrupt whatever it was reading.
-->
<script lang="ts">
  let {
    message,
    tone = 'good',
    action,
    onAction,
    onDone,
  }: {
    message: string
    /** 'bad' for a failure — same shape, different colour. */
    tone?: 'good' | 'bad'
    /** The button's label. Leave both out for the ordinary, wordless message. */
    action?: string | undefined
    onAction?: (() => void) | undefined
    onDone: () => void
  } = $props()

  /** Long enough to read a short sentence, short enough not to linger. */
  const SHOW_MS = 2800

  $effect(() => {
    const timer = setTimeout(onDone, SHOW_MS)
    return () => clearTimeout(timer)
  })
</script>

<div class="flash {tone}" class:with-action={action !== undefined} role="status">
  <span>{message}</span>
  {#if action && onAction}
    <button onclick={onAction}>{action}</button>
  {/if}
</div>

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

  .flash.with-action {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding-right: var(--space-2);
    /* The button is a real target, so the pill grows to a tappable height rather
       than the text's line box. */
    min-height: var(--tap-min);
  }

  .flash button {
    min-height: 2.25rem;
    padding: 0 var(--space-3);
    border-radius: var(--radius-full);
    background: rgb(255 255 255 / 0.22);
    color: inherit;
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .flash button:active {
    background: rgb(255 255 255 / 0.34);
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
