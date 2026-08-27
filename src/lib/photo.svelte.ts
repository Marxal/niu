/*
 * Decoding a picked photo and drawing it into a small square JPEG.
 *
 * Everything that could be got wrong by arithmetic is in photo.ts and tested;
 * this is the part that needs a browser — a decoder and a canvas — and it is
 * deliberately as thin as it can be.
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
 * can still refuse a format (HEIC, mostly), and falling back costs twenty lines.
 *
 * Fail soft: anything that cannot be decoded comes back null and the caller
 * shows a line of text. Nothing here throws.
 */

import { AVATAR_QUALITY, coverCrop, outputSize } from './photo'

/** Decodes a file to something drawable, or null if it cannot be read. */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    return await createImageBitmap(file)
  } catch {
    // Fall through to the <img> decoder, which handles some formats the bitmap
    // one refuses.
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } catch {
    return null
  } finally {
    // Revoking immediately is safe: the bitmap has already been decoded into
    // the element by the time decode() resolves.
    URL.revokeObjectURL(url)
  }
}

function sizeOf(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height }
}

/**
 * A picked file as a square JPEG ready to upload, or null if it could not be
 * decoded.
 *
 * The crop is worked out by `coverCrop` and the size capped by `outputSize`;
 * this only draws what those two decide.
 */
export async function squarePhoto(file: Blob): Promise<Blob | null> {
  const source = await decode(file)
  if (source === null) return null

  try {
    const { width, height } = sizeOf(source)
    if (width === 0 || height === 0) return null

    const crop = coverCrop(width, height)
    const side = outputSize(crop)

    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side

    const context = canvas.getContext('2d')
    if (!context) return null

    // Browsers only smooth *down*-scaling well with this on, and a phone photo
    // is always a downscale.
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(source, crop.x, crop.y, crop.size, crop.size, 0, 0, side, side)

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', AVATAR_QUALITY)
    })
  } catch {
    return null
  } finally {
    if (!(source instanceof HTMLImageElement)) source.close()
  }
}
