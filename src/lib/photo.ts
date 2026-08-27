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
 * inside that circle; a photo cropped to fill it shows a face. So the short
 * side is used whole and the long side is cropped evenly from both ends, which
 * for a phone photo of a person means keeping the middle — where people put
 * faces.
 */

/** The side of the square we store. See the header for the arithmetic. */
export const AVATAR_SIZE = 256

/** JPEG quality. 0.8 is where the size curve flattens and the artefacts start. */
export const AVATAR_QUALITY = 0.8

/** What the picker is allowed to hand back. */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/**
 * The largest file worth even trying to decode, before resizing.
 *
 * 20MB is far above any phone photo and far below the point where decoding one
 * would run a phone out of memory. It exists to fail politely on somebody
 * picking a video or a RAW file rather than to police anything.
 */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024

/** The rectangle to take out of the source image. */
export interface CropRect {
  x: number
  y: number
  size: number
}

/**
 * The square to cut out of a `width × height` image so it fills an avatar.
 *
 * The short side becomes the square's side; the long side is trimmed equally
 * from both ends. Fractional halves are floored, so a 101px overhang takes 50
 * off the left and 51 off the right — off by one pixel, in the direction that
 * cannot round the rectangle off the edge of the image.
 */
export function coverCrop(width: number, height: number): CropRect {
  const size = Math.max(1, Math.min(width, height))
  return {
    x: Math.floor((width - size) / 2),
    y: Math.floor((height - size) / 2),
    size,
  }
}

/**
 * How big to draw it: the crop's own size, capped at AVATAR_SIZE.
 *
 * The cap is a *maximum*, never a stretch. Somebody's 90px avatar from an old
 * export should stay 90px and slightly soft rather than be blown up to 256 and
 * be exactly as soft but four times the file.
 */
export function outputSize(crop: CropRect): number {
  return Math.min(AVATAR_SIZE, crop.size)
}

/** Why a chosen file was refused, or null when it is fine. */
export type PhotoProblem = 'type' | 'size' | null

export function checkPhoto(file: { type: string; size: number }): PhotoProblem {
  // An empty type happens on some Android pickers even for a real JPEG, so it
  // is allowed through and left for the decoder to reject.
  if (file.type !== '' && !ACCEPTED_TYPES.includes(file.type.toLowerCase())) return 'type'
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

/**
 * A cache-busting suffix for a photo's URL.
 *
 * The path never changes when somebody replaces their photo — same household,
 * same person — so the browser and Supabase's CDN would both go on serving the
 * old bytes. A changing query string is what makes a new picture appear.
 */
export function photoVersion(now: number = Date.now()): string {
  return now.toString(36)
}
