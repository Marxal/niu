/*
 * Derives Niu's app icons from the master artwork and writes them as PNGs into
 * public/icons/.
 *
 * Round 1 through round 7 drew the icon procedurally — a bowl and an egg,
 * rasterised by distance functions, with no image library at all, because the
 * mark really was just circles. That stopped being true the day the real "niu"
 * wordmark arrived: it's a photograph-like 3D render, not a shape a formula can
 * describe, so this script now reads assets/brand/app-icon-source.png and
 * resizes it instead. `sharp` is a devDependency for exactly this reason — it
 * never ships in the app bundle, only this script uses it.
 *
 * The source lives outside public/ on purpose. Vite copies everything under
 * public/ verbatim into the deployed site, and nothing ever links to the
 * source file directly — keeping it in assets/ means visitors never download
 * an 800+KB PNG that does nothing for them.
 *
 * One wrinkle worth knowing about: the wordmark is wide (roughly 1.6:1), and
 * Android's maskable icons get cropped by the launcher. So the maskable variant
 * alone gets shrunk before the crop, by however much its own artwork's bounding
 * box actually needs — computed from the image, not guessed, so a future
 * redesign at a different scale doesn't reintroduce clipping quietly.
 *
 * ## The safe zone, and the unit bug that made the logo tiny
 *
 * The maskable spec says the safe zone is a circle whose **diameter is 80% of
 * the icon's width** — so its radius is 40% of the icon's width.
 *
 * `measureMark` below reports distances as a fraction of the icon's **half**
 * width, because that is the natural unit when you are measuring outwards from
 * the centre. In those units the safe radius is 0.40 / 0.50 = **0.80**.
 *
 * Round 7 wrote 0.38 there, having read "40% radius" and taken it as a fraction
 * of the half-width rather than of the full width. That is out by a factor of
 * two, and the effect was exactly what you would expect: the wordmark, whose
 * corners sit at 0.858 half-widths, was scaled to 0.38 / 0.858 = **44%** of the
 * icon and floated in the middle of a sea of background. With the right unit it
 * comes out at 0.78 / 0.858 = **91%**, which is a logo.
 *
 * Fixed in round 10.1, after Marçal noticed the home-screen icon looked small.
 */

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'assets', 'brand', 'app-icon-source.png')
const OUT_DIR = join(ROOT, 'public', 'icons')

/**
 * The maskable safe radius, as a fraction of the icon's *half* width — which is
 * the unit measureMark() reports in. See the header for why this is 0.8 and not
 * 0.4: the spec's "40%" is of the full width.
 *
 * A shade under, at 0.78, so the very tips of the mark aren't sitting exactly on
 * the line a launcher might round differently.
 */
const SAFE_RADIUS_FRACTION = 0.78

/**
 * Finds the artwork's own bounding box against its background colour, and how
 * much a maskable icon needs to shrink it by to clear the safe-zone circle.
 */
async function measureMark(image) {
  const { width, height } = await image.metadata()
  const { data } = await image.raw().toBuffer({ resolveWithObject: true })

  // The background is whatever colour sits in the corner — read it rather than
  // assuming a hex, so this keeps working if the brand colour ever changes.
  const bg = [data[0], data[1], data[2]]
  const tolerance = 12
  const isBackground = (i) =>
    Math.abs(data[i] - bg[0]) <= tolerance &&
    Math.abs(data[i + 1] - bg[1]) <= tolerance &&
    Math.abs(data[i + 2] - bg[2]) <= tolerance

  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      if (!isBackground(i)) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const cx = width / 2
  const cy = height / 2
  const corners = [
    [minX, minY],
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
  ]
  const worstDistance = Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy)))
  const halfWidth = width / 2

  return { width, height, bg, worstFraction: worstDistance / halfWidth }
}

async function writeAnyIcon(name, size) {
  await sharp(SOURCE).resize(size, size).png().toFile(join(OUT_DIR, name))
  console.log(`wrote ${name} (${size}x${size})`)
}

/**
 * The notification badge — round 17.1, after Marçal saw a plain white blob in
 * the status bar instead of Niu's icon.
 *
 * Android draws a push notification's badge from the image's **alpha channel
 * only**: whatever is opaque becomes a white silhouette, whatever is
 * transparent stays empty. icon-192.png and friends are deliberately fully
 * opaque squares — they're built for the home screen, where a launcher masks
 * them into a circle or squircle and needs a solid background to crop safely.
 * Handed to a badge, "fully opaque square" reads as "solid white square",
 * which is the blob Marçal saw.
 *
 * A badge needs the opposite: mostly *transparent*, with only the mark itself
 * opaque. This one is drawn straight from the same nest-and-egg glyph as
 * favicon.svg (the mark used before the photographic wordmark arrived — see
 * the file header), stripped of its background rect, because a silhouette is
 * exactly what a simple line mark is good at and a photographic render is not.
 *
 * 96×96 is the size Chrome documents for Android badges, already covering a
 * 4x-density phone without the file being any bigger than it needs to be.
 */
const BADGE_GLYPH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="none" stroke="#ffffff" stroke-width="6.4" stroke-linecap="round">
    <path d="M14.4 34.6a17.6 17.6 0 0 0 35.2 0"/>
    <path d="M14.4 33.6 8.6 28.9"/>
    <path d="M49.6 33.6 55.4 28.9"/>
  </g>
  <circle cx="32" cy="28.7" r="8" fill="#ffffff"/>
</svg>
`

async function writeBadgeIcon(name, size) {
  await sharp(Buffer.from(BADGE_GLYPH_SVG)).resize(size, size).png().toFile(join(OUT_DIR, name))
  console.log(`wrote ${name} (${size}x${size}, transparent — for the notification badge)`)
}

async function writeMaskableIcon(name, size, worstFraction, bg) {
  const scale = Math.min(1, SAFE_RADIUS_FRACTION / worstFraction)
  const inner = Math.round(size * scale)

  const shrunk = await sharp(SOURCE).resize(inner, inner).toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: bg[0], g: bg[1], b: bg[2] },
    },
  })
    .composite([{ input: shrunk, gravity: 'center' }])
    .png()
    .toFile(join(OUT_DIR, name))

  console.log(`wrote ${name} (${size}x${size}, mark at ${Math.round(scale * 100)}% for the safe zone)`)
}

mkdirSync(OUT_DIR, { recursive: true })

const source = sharp(SOURCE)
const { bg, worstFraction } = await measureMark(source)

await writeAnyIcon('icon-192.png', 192)
await writeAnyIcon('icon-512.png', 512)
await writeAnyIcon('icon-180.png', 180) // apple-touch-icon
await writeMaskableIcon('icon-maskable-512.png', 512, worstFraction, bg)
await writeBadgeIcon('badge-96.png', 96)
