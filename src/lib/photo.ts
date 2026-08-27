/*
 * Turning whatever came out of the phone's photo picker into a small square
 * JPEG. The arithmetic is here and tested; the canvas work is in
 * photo.svelte.ts, which is a dozen lines around it.
 *
 * ## Why resize at all
 *
 * A photo off an Android camera is four or five megabytes. An avatar is drawn
 * at 48 pixels and never larger than 96. Uploading the original would spend a
 * chunk of a free Storage tier on data nobody will ever see, and every load of
 * the calendar would pull megabytes to draw a circle the size of a thumbnail.
 *
 * 256×256 at JPEG quality 0.8 is about 20KB and is still crisp on a 3× screen
 * at the largest size anything draws it.
 *
 * ## Why cover rather than fit
 *
 * An avatar is a circle. A photo letterboxed into a square would show bars
 * inside that circle; a photo cropped to fill it shows a face. That invariant —
 * the picture always fills the hole — is what crop.ts exists to keep, at any
 * zoom and in any position.
 */

/** The side of the square we store. See the header for the arithmetic. */
export const AVATAR_SIZE = 256

/** JPEG quality. 0.8 is where the size curve flattens and the artefacts start. */
export const AVATAR_QUALITY = 0.8

/**
 * Whether a file is worth handing to the decoder.
 *
 * Any `image/*` at all, plus an empty type — some Android pickers report none
 * for a perfectly good JPEG. Round 11.2 had a list of five specific types, and
 * that list was a way to reject a real photo for having an unusual label while
 * adding no safety at all: the input is already `accept="image/*"`, and the
 * decoder is the thing that actually knows whether the bytes are a picture.
 */
export function looksLikeImage(type: string): boolean {
  return type === '' || type.toLowerCase().startsWith('image/')
}

/**
 * The largest file worth even trying to decode, before resizing.
 *
 * 20MB is far above any phone photo and far below the point where decoding one
 * would run a phone out of memory. It exists to fail politely on somebody
 * picking a video or a RAW file rather than to police anything.
 */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024

/** Why a chosen file was refused, or null when it is fine. */
export type PhotoProblem = 'type' | 'size' | null

export function checkPhoto(file: { type: string; size: number }): PhotoProblem {
  if (!looksLikeImage(file.type)) return 'type'
  if (file.size > MAX_INPUT_BYTES) return 'size'
  return null
}

/**
 * Where a person's photo lives in the bucket.
 *
 * **This shape is the security model, not a convention.** Every Storage policy
 * in 0013 reads the household out of the first folder, so a path built any
 * other way is a path those policies will refuse — which is the failure mode we
 * want, but it means this function and that migration have to change together.
 */
export function photoPath(householdId: string, personId: string): string {
  return `${householdId}/${personId}.jpg`
}
