/*
 * Decoding a picked photo, and drawing a chosen square of it into a small JPEG.
 *
 * Everything that could be got wrong by arithmetic is in photo.ts and crop.ts
 * and tested; this is the part that needs a browser — a decoder and a canvas —
 * and it is deliberately as thin as it can be.
 *
 * Round 11.2 did the whole thing in one call, taking the middle square without
 * asking. Round 11.3 split it in two — `decodeImage` then `renderSquare` — so
 * the cropper can sit in between and let somebody choose the square. The middle
 * is still where it opens; it is now a starting point rather than a verdict.
 *
 * ## Why it happens on the phone
 *
 * The alternative is uploading four megabytes and resizing on a server, and
 * this project has no server (NIU.md §1). Doing it here also means the upload
 * is 20KB, which on mobile data is the difference between a photo appearing and
 * a photo eventually appearing.
 *
 * ## createImageBitmap, with a fallback
 *
 * `createImageBitmap` decodes off the main thread, so a five-megapixel photo
 * does not freeze the sheet mid-tap. Every browser this app targets has it; the
 * `<img>` path underneath is there because a decoder that is merely *present*
 * can still refuse a format, and falling back costs twenty lines.
 *
 * Fail soft: anything that cannot be decoded comes back null and the caller
 * shows a line of text. Nothing here throws.
 */

import type { CropRect } from './crop'
import { AVATAR_QUALITY, AVATAR_SIZE } from './photo'

/** A decoded picture, plus the size the cropper needs to do its maths. */
export interface Decoded {
  source: ImageBitmap | HTMLImageElement
  width: number
  height: number
  /** An address the cropper can put in an `<img>`. Revoked by `release`. */
  url: string
  /** Frees the bitmap and the object URL. Call it once, when done. */
  release: () => void
}

/**
 * Decodes a file, or null if it cannot be read.
 *
 * The object URL is kept alive rather than revoked immediately, because the
 * cropper draws the same picture in an `<img>` while you drag it. That is the
 * one difference from round 11.2's version, and it is why `release` exists: the
 * URL now outlives this function and something has to end it.
 */
export async function decodeImage(file: Blob): Promise<Decoded | null> {
  const url = URL.createObjectURL(file)

  try {
    const bitmap = await createImageBitmap(file)
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      url,
      release: () => {
        bitmap.close()
        URL.revokeObjectURL(url)
      },
    }
  } catch {
    // Fall through to the <img> decoder, which handles some formats the bitmap
    // one refuses.
  }

  try {
    const image = new Image()
    image.src = url
    await image.decode()

    if (image.naturalWidth === 0 || image.naturalHeight === 0) {
      URL.revokeObjectURL(url)
      return null
    }

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      url,
      release: () => URL.revokeObjectURL(url),
    }
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

/**
 * A chosen square of a decoded picture, as a JPEG ready to upload.
 *
 * The output is capped at AVATAR_SIZE and never enlarged past the crop's own
 * size: somebody's 90px crop stays 90px and slightly soft rather than becoming
 * 256px, exactly as soft, and four times the file.
 */
export async function renderSquare(decoded: Decoded, crop: CropRect): Promise<Blob | null> {
  try {
    const side = Math.max(1, Math.min(AVATAR_SIZE, crop.size))

    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side

    const context = canvas.getContext('2d')
    if (!context) return null

    // Browsers only smooth *down*-scaling well with this on, and a phone photo
    // is always a downscale.
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      decoded.source,
      crop.x,
      crop.y,
      crop.size,
      crop.size,
      0,
      0,
      side,
      side,
    )

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', AVATAR_QUALITY)
    })
  } catch {
    return null
  }
}
