<!--
  The sign-in screen. The whole app sits behind this once Supabase is configured.

  It is a full-height centred column rather than a card, because it's the first
  thing seen on a cold open and a card floating on an empty screen reads as an
  error state. The button is the only tappable thing on the page and sits well
  above the gesture bar.

  Tapping the button hands the browser to Google, so there is no "success" state
  to design — the page is replaced. `busy` only covers the moment between the
  tap and the redirect starting, which is usually too fast to see but is very
  visible on a bad connection.
-->
<script lang="ts">
  import { auth, signInWithGoogle } from '../lib/auth.svelte'
  import { strings } from '../lib/strings'
  import GoogleMark from '../components/GoogleMark.svelte'
  import NestMark from '../components/NestMark.svelte'
</script>

<main class="signin">
  <div class="brand">
    <NestMark size={72} />
    <h1>{strings.app.name}</h1>
    <p class="tagline">{strings.auth.tagline}</p>
  </div>

  <div class="actions">
    {#if auth.error}
      <p class="error" role="alert">{auth.error}</p>
    {/if}

    <button class="google" onclick={signInWithGoogle} disabled={auth.busy}>
      <GoogleMark />
      <span>{auth.busy ? strings.auth.signingIn : strings.auth.googleButton}</span>
    </button>

    <p class="privacy">{strings.auth.privacy}</p>
  </div>
</main>

<style>
  .signin {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--space-6);
    height: 100%;
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--space-7) var(--space-5);
    padding-top: calc(var(--space-7) + env(safe-area-inset-top, 0px));
    padding-bottom: calc(var(--space-7) + env(safe-area-inset-bottom, 0px));
    text-align: center;
  }

  .brand {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
  }

  h1 {
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    letter-spacing: -0.02em;
  }

  .tagline {
    max-width: 20rem;
    color: var(--color-text-muted);
    font-size: var(--text-base);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .google {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--tap-min);
    padding: var(--space-3) var(--space-5);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    box-shadow: var(--shadow-1);
  }

  .google:active {
    background: var(--color-surface-sunken);
  }

  .google:disabled {
    color: var(--color-text-muted);
    cursor: default;
  }

  .error {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-danger);
    font-size: var(--text-sm);
  }

  .privacy {
    color: var(--color-text-faint);
    font-size: var(--text-xs);
  }
</style>
