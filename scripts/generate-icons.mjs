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
 * Android's maskable icons get cropped to a circle by the launcher. Measured
 * against the source, the wordmark's own corners sit at ~85% of the icon's
 * half-width from centre — comfortably past the ~40%-radius "safe zone" a
 * maskable icon needs, which would clip the ends of the n and the u. So the
 * maskable variant alone gets shrunk before the crop, by however much its own
 * artwork's bounding box actually needs — computed from the image, not
 * guessed, so a future redesign at a different scale doesn't reintroduce the
 * clipping quietly.
 */

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'assets', 'brand', 'app-icon-source.png')
const OUT_DIR = join(ROOT, 'public', 'icons')

/** How much safety margin to leave inside the theoretical 40%-radius limit. */
const SAFE_RADIUS_FRACTION = 0.38

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
