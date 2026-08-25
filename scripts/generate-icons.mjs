/*
 * Draws Niu's app icons and writes them as PNGs into public/icons/.
 *
 * Why a script instead of checked-in art: the icon is just the brand colour plus
 * a nest mark, and the brand colour lives in the token file. When that colour
 * changes, `npm run icons` regenerates every size rather than someone re-exporting
 * three files by hand and getting one of them wrong.
 *
 * There is no image library here on purpose — no npm dependency for four small
 * shapes. It rasterises circles by distance, samples each pixel 4x4 for smooth
 * edges, and encodes the PNG with node's built-in zlib.
 *
 * The mark: a bowl (a half ring) with an egg resting in it. Niu means "nest".
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

// Kept in sync by hand with --color-accent / --color-accent-ink in tokens.css.
const CLAY = [0xc2, 0x5a, 0x3a]
const CREAM = [0xff, 0xf6, 0xef]

/** Nest mark, drawn in a 0..1 square. `inset` shrinks it for maskable icons. */
function markAlpha(x, y, inset) {
  const cx = 0.5
  const cy = 0.54
  const r = 0.275 * inset
  const thickness = 0.10 * inset

  // Bowl: the lower half of a ring centred on (cx, cy).
  const d = Math.hypot(x - cx, y - cy)
  const inBowl = y > cy - r * 0.15 && Math.abs(d - r) < thickness / 2

  // Egg: a circle sitting in the bowl, slightly above centre.
  const eggR = 0.125 * inset
  const inEgg = Math.hypot(x - cx, y - (cy - r * 0.30)) < eggR

  // Two small twigs poking out of the rim, so it reads as a nest, not a cup.
  const twig = (x0, y0, x1, y1) => {
    const vx = x1 - x0
    const vy = y1 - y0
    const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / (vx * vx + vy * vy)))
    return Math.hypot(x - (x0 + t * vx), y - (y0 + t * vy)) < thickness * 0.26
  }
  const inTwigs =
    twig(cx - r * 0.95, cy + r * 0.02, cx - r * 1.34, cy - r * 0.30) ||
    twig(cx + r * 0.95, cy + r * 0.02, cx + r * 1.34, cy - r * 0.30)

  return inBowl || inEgg || inTwigs
}

/** Rounded-square background, drawn in a 0..1 square. */
function squircleAlpha(x, y, radius) {
  const dx = Math.max(Math.abs(x - 0.5) - (0.5 - radius), 0)
  const dy = Math.max(Math.abs(y - 0.5) - (0.5 - radius), 0)
  return Math.hypot(dx, dy) <= radius
}

function render(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4)
  const samples = 4
  // A maskable icon can be cropped to a circle by the launcher, so the artwork
  // must survive losing the outer ~10% on every side: bleed the background to
  // the full square and pull the mark into the safe zone.
  const inset = maskable ? 0.72 : 1
  const cornerRadius = maskable ? 0.5 : 0.22

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let bg = 0
      let fg = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (pxi + (sx + 0.5) / samples) / size
          const y = (py + (sy + 0.5) / samples) / size
          if (maskable || squircleAlpha(x, y, cornerRadius)) bg++
          if (markAlpha(x, y, inset)) fg++
        }
      }
      const total = samples * samples
      const bgA = bg / total
      const fgA = (fg / total) * bgA
      const i = (py * size + pxi) * 4
      for (let c = 0; c < 3; c++) {
        px[i + c] = Math.round(CLAY[c] * (1 - fgA / Math.max(bgA, 1e-6)) + CREAM[c] * (fgA / Math.max(bgA, 1e-6)))
      }
      px[i + 3] = Math.round(bgA * 255)
    }
  }
  return px
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  // Each scanline is prefixed with filter byte 0 (none).
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT_DIR, { recursive: true })

const jobs = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-180.png', 180, { maskable: false }], // apple-touch-icon
  ['icon-maskable-512.png', 512, { maskable: true }],
]

for (const [name, size, opts] of jobs) {
  const file = join(OUT_DIR, name)
  writeFileSync(file, encodePng(size, render(size, opts)))
  console.log(`wrote ${name} (${size}x${size})`)
}
