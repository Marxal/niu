/*
 * The arithmetic behind pinch-and-drag cropping: where the image sits, how far
 * it may be moved, and which square of it ends up in the avatar.
 *
 * Pure — no DOM, no Svelte — and tested, because every bug this can have is an
 * off-by-a-bit that shows as a gap at the edge of a circle or a jump under the
 * finger, and neither is something you can reason about from the code.
 *
 * ## The model
 *
 * A square **viewport** of `V` screen pixels shows part of an image that is
 * `iw × ih` image pixels.
 *
 *   scale   screen pixels per image pixel
 *   offset  where the image's top-left corner is, relative to the viewport's
 *           top-left, in screen pixels. Always zero or negative: the image is
 *           bigger than the hole it is seen through.
 *
 * The one rule everything else falls out of: **the image must always cover the
 * viewport.** No gap, ever, at any zoom or position. `clampScale` enforces it
 * for the zoom and `clampOffset` for the position, and because they are
 * separate the caller has to apply them in that order — a scale that has been
 * clamped smaller changes what offsets are legal.
 *
 * ## Why screen pixels and not a percentage
 *
 * A gesture arrives in screen pixels. Keeping the model in the same unit means
 * the maths in the middle of a pinch is subtraction rather than conversion, and
 * a finger that moves 10px moves the image 10px, which is the whole feel of it.
 */

/** Where the image is, in the viewport's coordinates. */
export interface View {
  scale: number
  offsetX: number
  offsetY: number
}

/** A square of the source image, in image pixels. */
export interface CropRect {
  x: number
  y: number
  size: number
}

/**
 * How far in you may zoom, as a multiple of the scale that just covers.
 *
 * Four is generous and still honest: the avatar is written out at 256px, so a
 * 4× crop of even a small phone photo has more detail than the output needs.
 * Past that you would be enlarging pixels to store them smaller again.
 */
export const MAX_ZOOM = 4

/** The smallest scale that still covers the viewport — "fit by the short side". */
export function minScale(imageW: number, imageH: number, viewport: number): number {
  if (imageW <= 0 || imageH <= 0 || viewport <= 0) return 1
  return Math.max(viewport / imageW, viewport / imageH)
}

/** A scale held between just-covering and MAX_ZOOM times that. */
export function clampScale(
  scale: number,
  imageW: number,
  imageH: number,
  viewport: number,
): number {
  const min = minScale(imageW, imageH, viewport)
  return Math.min(Math.max(scale, min), min * MAX_ZOOM)
}

/**
 * An offset pulled back inside the image.
 *
 * Zero is the image's left edge flush with the viewport's; the lower bound is
 * its right edge flush with the viewport's right. When the image is exactly the
 * viewport's size in one axis both bounds are zero, which is why the max/min
 * are written in this order — the other way round they cross and produce NaN
 * for the one case that happens every time somebody crops a square photo.
 */
export function clampOffset(
  view: View,
  imageW: number,
  imageH: number,
  viewport: number,
): View {
  const width = imageW * view.scale
  const height = imageH * view.scale

  return {
    scale: view.scale,
    offsetX: Math.min(0, Math.max(view.offsetX, viewport - width)),
    offsetY: Math.min(0, Math.max(view.offsetY, viewport - height)),
  }
}

/** The view that shows the middle of the image, just covering the viewport. */
export function centeredView(imageW: number, imageH: number, viewport: number): View {
  const scale = minScale(imageW, imageH, viewport)
  return clampOffset(
    {
      scale,
      offsetX: (viewport - imageW * scale) / 2,
      offsetY: (viewport - imageH * scale) / 2,
    },
    imageW,
    imageH,
    viewport,
  )
}

/**
 * Zooms around a fixed point — the midpoint between two fingers, or the middle
 * of the viewport for a double tap.
 *
 * The point stays under the fingers, which is the whole trick of a pinch: the
 * image grows *around* where you are holding it rather than around its own
 * corner. Everything else is bookkeeping.
 */
export function zoomAround(
  view: View,
  nextScale: number,
  pointX: number,
  pointY: number,
  imageW: number,
  imageH: number,
  viewport: number,
): View {
  const scale = clampScale(nextScale, imageW, imageH, viewport)
  const ratio = scale / view.scale

  return clampOffset(
    {
      scale,
      offsetX: pointX - (pointX - view.offsetX) * ratio,
      offsetY: pointY - (pointY - view.offsetY) * ratio,
    },
    imageW,
    imageH,
    viewport,
  )
}

/** Moves the image by a finger's travel, staying inside it. */
export function panBy(
  view: View,
  dx: number,
  dy: number,
  imageW: number,
  imageH: number,
  viewport: number,
): View {
  return clampOffset(
    { scale: view.scale, offsetX: view.offsetX + dx, offsetY: view.offsetY + dy },
    imageW,
    imageH,
    viewport,
  )
}

/**
 * The square of the source image the viewport is currently showing.
 *
 * Rounded outward — floor on the corner, ceil on the size — and then pulled
 * back inside the image. Rounding inward instead would leave a sub-pixel sliver
 * of nothing along one edge, which after the draw is a one-pixel transparent
 * line on the circle and is exactly the kind of thing that looks like a
 * rendering bug rather than a rounding one.
 */
export function cropRect(
  view: View,
  imageW: number,
  imageH: number,
  viewport: number,
): CropRect {
  const size = Math.min(
    Math.ceil(viewport / view.scale),
    Math.floor(Math.min(imageW, imageH)),
  )
  const x = Math.floor(-view.offsetX / view.scale)
  const y = Math.floor(-view.offsetY / view.scale)

  return {
    size: Math.max(1, size),
    x: Math.min(Math.max(0, x), Math.max(0, imageW - size)),
    y: Math.min(Math.max(0, y), Math.max(0, imageH - size)),
  }
}

/** The distance between two points — a pinch's span. */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay)
}
