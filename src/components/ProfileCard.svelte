<!--
  Your name, your colour and your face — the three things the calendar needs
  before "who goes" and "she said yes" can mean anything.

  Kept deliberately small. This is not a profile screen; it is three fields that
  exist so two people can tell each other apart on a 412px screen, and the whole
  card should be finishable in about fifteen seconds.

  The name saves on blur rather than on every keystroke: one write instead of
  twelve, and the field never fights the person typing.
-->
<script lang="ts">
  import { TAG_COLOURS, tagStyle, type TagColour } from '../lib/dish-tags'
  import { members, memberName, updateProfile } from '../lib/members.svelte'
  import { strings } from '../lib/strings'
  import MemberAvatar from './MemberAvatar.svelte'

  /** A short row of faces that read as people rather than as fruit. */
  const FACES = ['🙂', '😎', '🦊', '🐻', '🐧', '🌿', '⭐', '🎧', '🍀', '🐿️', '🦉', '🌊']

  // Snapshotted, like every other text field in the app: re-syncing it from the
  // server would move the cursor under someone mid-word.
  // svelte-ignore state_referenced_locally
  let name = $state(members.me?.name ?? '')
  let pickingFace = $state(false)

  function saveName() {
    if ((members.me?.name ?? '') === name.trim()) return
    void updateProfile({ name })
  }

  function pickColour(colour: TagColour) {
    void updateProfile({ colour })
  }

  function pickFace(avatar: string | null) {
    pickingFace = false
    void updateProfile({ avatar })
  }
</script>

<div class="card">
  <div class="head">
    <MemberAvatar member={members.me} size="lg" />
    <div class="text">
      <h2>{strings.members.profileTitle}</h2>
      <p class="sub">{memberName(members.me)}</p>
    </div>
    <button class="face-button" onclick={() => (pickingFace = !pickingFace)}>
      {strings.members.avatarLabel}
    </button>
  </div>

  {#if pickingFace}
    <div class="faces">
      {#each FACES as face (face)}
        <button
          class="face"
          class:on={members.me?.avatar === face}
          aria-pressed={members.me?.avatar === face}
          aria-label={face}
          onclick={() => pickFace(face)}
        >
          {face}
        </button>
      {/each}
      <button class="face clear" onclick={() => pickFace(null)}>
        {strings.members.avatarClear}
      </button>
    </div>
  {/if}

  <label class="field">
    <span class="label">{strings.members.nameLabel}</span>
    <input
      class="input"
      type="text"
      maxlength="40"
      autocomplete="name"
      placeholder={strings.members.namePlaceholder}
      bind:value={name}
      onblur={saveName}
    />
    <span class="hint">{strings.members.nameHint}</span>
  </label>

  <div class="field">
    <span class="label">{strings.members.colourLabel}</span>
    <div class="colours">
      {#each TAG_COLOURS as colour (colour)}
        <button
          class="swatch"
          class:on={members.me?.colour === colour}
          style={tagStyle(colour)}
          aria-label={colour}
          aria-pressed={members.me?.colour === colour}
          onclick={() => pickColour(colour)}
        ></button>
      {/each}
    </div>
  </div>

  {#if members.error}<p class="error">{members.error}</p>{/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .text {
    flex: 1;
    min-width: 0;
  }

  h2 {
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
  }

  .sub {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .face-button {
    flex: none;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: none;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .faces {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .face {
    width: var(--tap-min);
    height: var(--tap-min);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-bg);
    font-size: var(--text-lg);
    filter: var(--icon-emoji-filter);
  }

  .face.on {
    border-color: var(--color-tab-calendar);
    border-width: 2px;
    background: var(--color-surface-sunken);
  }

  .face.clear {
    width: auto;
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    filter: none;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--color-text-muted);
  }

  .input {
    width: 100%;
    min-height: var(--tap-min);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: var(--text-base);
    font-family: inherit;
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
    line-height: var(--leading-normal);
  }

  .colours {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .swatch {
    width: var(--tap-min);
    height: 2.25rem;
    border: 2px solid var(--tag-ink);
    border-radius: var(--radius-full);
    background: var(--tag-fill);
  }

  .swatch.on {
    background: var(--tag-ink);
  }

  .error {
    font-size: var(--text-sm);
    color: var(--color-danger);
  }

  button:active {
    transform: scale(0.97);
  }
</style>
