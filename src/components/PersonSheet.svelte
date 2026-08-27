<!--
  Editing one person: their name, their colour, and their face.

  One sheet for everybody, whether or not they have an account, because the
  fields are the same. Two things differ, and both are the database's rules
  showing through rather than the app's:

   - **You cannot edit somebody else's account.** The sheet is read-only for a
     person with a `userId` that is not yours, and says so. A silent refusal
     from RLS would just look like a broken Save.
   - **Only somebody without an account can be removed.** Leaving a household is
     its own act, not something a housemate does to you.

  ## The photo

  `<input type="file" accept="image/*">` is the whole picker — on Android that
  offers the camera and the gallery, which is the two things anybody wants and
  nothing to build. What comes back is decoded here, cropped by hand in
  PhotoCropper, and shrunk to 256px *on the phone* before it goes anywhere.

  Nothing is uploaded until the crop is confirmed, so backing out of the cropper
  costs nothing and leaves nothing behind.

  The input is hidden behind a real button rather than styled, because a file
  input cannot be made to look like anything and every attempt is worse than a
  button that clicks it.
-->
<script lang="ts">
  import { TAG_COLOURS, tagStyle, type TagColour } from '../lib/dish-tags'
  import {
    type Person,
    personName,
    removePerson,
    removePhoto,
    updatePerson,
    uploadPhoto,
  } from '../lib/people.svelte'
  import type { CropRect } from '../lib/crop'
  import { checkPhoto } from '../lib/photo'
  import { type Decoded, decodeImage, renderSquare } from '../lib/photo.svelte'
  import PhotoCropper from './PhotoCropper.svelte'
  import { auth } from '../lib/auth.svelte'
  import { strings } from '../lib/strings'
  import PersonAvatar from './PersonAvatar.svelte'

  let { person, onclose }: { person: Person; onclose: () => void } = $props()

  /** A short row of faces that read as people rather than as fruit. */
  const FACES = ['🙂', '😎', '🦊', '🐻', '🐧', '🌿', '⭐', '🎧', '🍀', '🐿️', '🦉', '🌊']

  // Snapshotted once, like every text field in this app: re-syncing from the
  // server would move the cursor under somebody mid-word.
  // svelte-ignore state_referenced_locally
  let name = $state(person.name ?? '')
  let busy = $state(false)
  let problem = $state<string | null>(null)
  let confirmingRemove = $state(false)
  let picker = $state<HTMLInputElement | null>(null)
  /** The decoded picture while the cropper is open. Null the rest of the time. */
  let cropping = $state<Decoded | null>(null)

  // Whatever happens, the decoded bitmap and its object URL are freed. Without
  // this, picking three photos in a row leaks three full-size decodes.
  function closeCropper() {
    cropping?.release()
    cropping = null
    if (picker) picker.value = ''
  }

  /** Somebody else's account: theirs to edit, not yours. */
  let readOnly = $derived(person.userId !== null && person.userId !== auth.userId)
  let removable = $derived(person.userId === null)
  let hasPhoto = $derived(person.photoPath !== null || person.photoUrl !== null)

  function saveName() {
    if (readOnly || (person.name ?? '') === name.trim()) return
    void updatePerson(person.id, { name })
  }

  function pickColour(colour: TagColour) {
    if (readOnly) return
    void updatePerson(person.id, { colour })
  }

  function pickFace(avatar: string | null) {
    if (readOnly) return
    // Choosing an emoji means choosing it *instead* of the photo, otherwise the
    // photo would go on winning and the tap would look like it did nothing.
    void updatePerson(person.id, { avatar, photoPath: null, photoUrl: null })
  }

  /**
   * A picked file: check it, decode it, and hand it to the cropper.
   *
   * Nothing is uploaded here. Round 11.2 went straight from the picker to the
   * bucket taking the middle square, and the middle is a decent guess and a
   * poor decision — see PhotoCropper.
   */
  async function onFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return

    problem = null

    const bad = checkPhoto(file)
    if (bad !== null) {
      problem = bad === 'type' ? strings.people.photoWrongType : strings.people.photoTooBig
      if (picker) picker.value = ''
      return
    }

    busy = true
    const decoded = await decodeImage(file)
    busy = false

    if (decoded === null) {
      problem = strings.people.photoUnreadable
      if (picker) picker.value = ''
      return
    }

    cropping = decoded
  }

  /** The square they chose: draw it small, upload it, close. */
  async function useCrop(crop: CropRect) {
    const decoded = cropping
    if (!decoded) return

    busy = true
    const square = await renderSquare(decoded, crop)

    if (square === null) {
      busy = false
      problem = strings.people.photoUnreadable
      closeCropper()
      return
    }

    const failure = await uploadPhoto(person.id, square)
    busy = false
    problem = failure
    closeCropper()
  }

  async function clearPhoto() {
    busy = true
    await removePhoto(person.id)
    busy = false
  }

  async function remove() {
    busy = true
    const ok = await removePerson(person.id)
    busy = false
    if (ok) onclose()
  }
</script>

{#if cropping}
  <PhotoCropper decoded={cropping} {busy} onuse={useCrop} oncancel={closeCropper} />
{/if}

<div class="backdrop" role="presentation" onclick={onclose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={personName(person)}>
  <header class="head">
    <h2>{personName(person)}</h2>
    <button class="text-button" onclick={onclose}>{strings.people.done}</button>
  </header>

  <div class="body">
    <div class="face-row">
      <PersonAvatar {person} size="xl" />
      {#if !readOnly}
        <div class="face-actions">
          <button class="action" disabled={busy} onclick={() => picker?.click()}>
            {busy
              ? strings.people.faceUploading
              : hasPhoto
                ? strings.people.faceReplace
                : strings.people.faceChoose}
          </button>
          {#if hasPhoto}
            <button class="quiet" disabled={busy} onclick={clearPhoto}>
              {strings.people.faceRemove}
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if !readOnly}
      <!-- accept="image/*" is what makes Android offer the camera as well as
           the gallery. Hidden because a file input cannot be styled. -->
      <input
        class="picker"
        type="file"
        accept="image/*"
        bind:this={picker}
        onchange={onFile}
      />
      <p class="hint">{strings.people.photoHint}</p>
    {/if}

    {#if problem}<p class="error">{problem}</p>{/if}

    <label class="field">
      <span class="label">{strings.people.nameLabel}</span>
      <input
        class="input"
        type="text"
        maxlength="40"
        disabled={readOnly}
        placeholder={strings.people.addPlaceholder}
        bind:value={name}
        onblur={saveName}
      />
    </label>

    {#if !readOnly}
      <div class="field">
        <span class="label">{strings.people.faceEmoji}</span>
        <div class="faces">
          {#each FACES as emoji (emoji)}
            <button
              class="emoji"
              class:on={person.avatar === emoji}
              aria-pressed={person.avatar === emoji}
              aria-label={emoji}
              onclick={() => pickFace(emoji)}
            >
              {emoji}
            </button>
          {/each}
          <button class="emoji clear" onclick={() => pickFace(null)}>
            {strings.people.faceClear}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label">{strings.people.colourLabel}</span>
        <div class="colours">
          {#each TAG_COLOURS as colour (colour)}
            <button
              class="swatch"
              class:on={person.colour === colour}
              style={tagStyle(colour)}
              aria-label={colour}
              aria-pressed={person.colour === colour}
              onclick={() => pickColour(colour)}
            ></button>
          {/each}
        </div>
      </div>
    {:else}
      <p class="hint">{strings.people.theirsToEdit}</p>
    {/if}

    {#if removable}
      {#if confirmingRemove}
        <div class="remove-row">
          <span>{strings.people.removeConfirm}</span>
          <button class="danger" disabled={busy} onclick={remove}>
            {strings.people.remove}
          </button>
          <button class="text-button" onclick={() => (confirmingRemove = false)}>
            {strings.people.cancel}
          </button>
        </div>
      {:else}
        <button class="text-button danger-text" onclick={() => (confirmingRemove = true)}>
          {strings.people.remove}
        </button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    z-index: var(--z-sheet);
  }

  .sheet {
    position: fixed;
    inset: auto 0 0 0;
    z-index: var(--z-sheet);
    display: flex;
    flex-direction: column;
    max-height: 88vh;
    margin: 0 auto;
    max-width: var(--content-max);
    background: var(--color-surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-2);
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--keyboard-inset));
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-4) var(--space-2);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4) var(--space-4);
  }

  .face-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .face-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }

  .picker {
    /* Present for the click(), never seen. `display: none` would stop some
       browsers firing the picker at all. */
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
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

  .input:disabled {
    opacity: 0.6;
  }

  .faces {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .emoji {
    width: var(--tap-min);
    height: var(--tap-min);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-bg);
    font-size: var(--text-lg);
    filter: var(--icon-emoji-filter);
  }

  .emoji.on {
    border-color: var(--color-tab-calendar);
    border-width: 2px;
    background: var(--color-surface-sunken);
  }

  .emoji.clear {
    width: auto;
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    filter: none;
  }

  .colours {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .swatch {
    flex: 1;
    min-width: 2rem;
    height: 2.25rem;
    border: 2px solid var(--tag-ink);
    border-radius: var(--radius-full);
    background: var(--tag-fill);
  }

  .swatch.on {
    background: var(--tag-ink);
  }

  .action {
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .action:disabled {
    opacity: 0.5;
  }

  .quiet,
  .text-button {
    min-height: var(--tap-min);
    padding: 0 var(--space-2);
    border: none;
    background: none;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .text-button {
    align-self: flex-start;
    font-size: var(--text-base);
  }

  .danger-text {
    color: var(--color-danger);
  }

  .remove-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .danger {
    min-height: var(--tap-min);
    padding: 0 var(--space-4);
    border: none;
    border-radius: var(--radius-full);
    background: var(--color-danger);
    color: var(--color-accent-ink);
    font-weight: var(--weight-medium);
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--color-text-faint);
    line-height: var(--leading-normal);
  }

  .error {
    font-size: var(--text-sm);
    color: var(--color-danger);
  }

  button:active:not(:disabled) {
    transform: scale(0.97);
  }
</style>
