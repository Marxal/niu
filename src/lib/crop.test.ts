import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  type View,
  centeredView,
  clampOffset,
  clampScale,
  cropRect,
  distance,
  minScale,
  panBy,
  zoomAround,
} from './crop'

const V = 300

/** The rule the whole module exists to keep: no gap, ever. */
function covers(view: View, imageW: number, imageH: number, viewport = V): boolean {
  return (
    view.offsetX <= 0.0001 &&
    view.offsetY <= 0.0001 &&
    view.offsetX + imageW * view.scale >= viewport - 0.0001 &&
    view.offsetY + imageH * view.scale >= viewport - 0.0001
  )
}

describe('minScale', () => {
  it('fits by the short side, so the long one overflows', () => {
    // 600 tall is the short side: 300/600 = 0.5, which leaves the 1200 width
    // at 600 — twice the viewport, which is what "cover" means.
    expect(minScale(1200, 600, V)).toBe(0.5)
    expect(minScale(600, 1200, V)).toBe(0.5)
  })

  it('is exactly 1 for an image the size of the viewport', () => {
    expect(minScale(V, V, V)).toBe(1)
  })

  it('scales a small image up rather than leaving a gap', () => {
    expect(minScale(100, 100, V)).toBe(3)
  })

  it('does not divide by zero on a degenerate image', () => {
    expect(minScale(0, 500, V)).toBe(1)
    expect(minScale(500, 0, V)).toBe(1)
  })
})

describe('clampScale', () => {
  it('never goes below covering', () => {
    expect(clampScale(0.01, 1200, 600, V)).toBe(0.5)
  })

  it('stops at MAX_ZOOM times the covering scale', () => {
    expect(clampScale(999, 1200, 600, V)).toBe(0.5 * MAX_ZOOM)
  })

  it('leaves a sensible scale alone', () => {
    expect(clampScale(1, 1200, 600, V)).toBe(1)
  })
})

describe('clampOffset', () => {
  const wide = { w: 1200, h: 600 }

  it('stops the left edge coming inside the viewport', () => {
    const view = clampOffset({ scale: 0.5, offsetX: 50, offsetY: 0 }, wide.w, wide.h, V)
    expect(view.offsetX).toBe(0)
  })

  it('stops the right edge coming inside the viewport', () => {
    // 1200 * 0.5 = 600 wide, so the furthest left is 300 - 600 = -300.
    const view = clampOffset({ scale: 0.5, offsetX: -999, offsetY: 0 }, wide.w, wide.h, V)
    expect(view.offsetX).toBe(-300)
  })

  it('pins an axis that exactly fits, rather than producing NaN', () => {
    // 600 * 0.5 = 300 = the viewport. Both bounds are zero here, and getting
    // the max/min the wrong way round makes them cross.
    const view = clampOffset({ scale: 0.5, offsetX: 0, offsetY: 20 }, wide.w, wide.h, V)
    expect(view.offsetY).toBe(0)
    expect(Number.isNaN(view.offsetY)).toBe(false)
  })

  it('always leaves the image covering', () => {
    for (const [w, h] of [[1200, 600], [600, 1200], [300, 300], [4032, 3024]] as const) {
      const scale = minScale(w, h, V)
      for (const [x, y] of [[0, 0], [-9999, -9999], [9999, 9999], [-50, 20]] as const) {
        expect(covers(clampOffset({ scale, offsetX: x, offsetY: y }, w, h, V), w, h)).toBe(true)
      }
    }
  })
})

describe('centeredView', () => {
  it('takes the middle of a landscape photo', () => {
    const view = centeredView(1200, 600, V)
    expect(view.scale).toBe(0.5)
    // 600 wide on screen, viewport 300: 150 trimmed each side.
    expect(view.offsetX).toBe(-150)
    expect(view.offsetY).toBe(0)
  })

  it('takes the middle of a portrait photo', () => {
    const view = centeredView(600, 1200, V)
    expect(view.offsetX).toBe(0)
    expect(view.offsetY).toBe(-150)
  })

  it('covers for every shape', () => {
    for (const [w, h] of [[1200, 600], [600, 1200], [301, 300], [1, 5000], [4032, 3024]] as const) {
      expect(covers(centeredView(w, h, V), w, h)).toBe(true)
    }
  })

  it('matches the automatic centre crop it replaces', () => {
    // The cropper opens on exactly the square the old automatic crop produced,
    // so somebody who does not touch it gets the same result as before.
    const view = centeredView(1000, 600, V)
    const rect = cropRect(view, 1000, 600, V)
    expect(rect.size).toBe(600)
    expect(rect.x).toBe(200)
    expect(rect.y).toBe(0)
  })
})

describe('zoomAround', () => {
  const w = 1200
  const h = 600

  it('keeps the pinched point under the fingers', () => {
    const before = centeredView(w, h, V)
    const px = 100
    const py = 150
    // Which image pixel is under (px, py) before?
    const imageX = (px - before.offsetX) / before.scale
    const after = zoomAround(before, before.scale * 1.5, px, py, w, h, V)
    const afterImageX = (px - after.offsetX) / after.scale
    expect(afterImageX).toBeCloseTo(imageX, 5)
  })

  it('cannot be pinched below covering', () => {
    const before = centeredView(w, h, V)
    const after = zoomAround(before, 0.001, 150, 150, w, h, V)
    expect(after.scale).toBe(minScale(w, h, V))
    expect(covers(after, w, h)).toBe(true)
  })

  it('cannot be pinched past the zoom cap', () => {
    const before = centeredView(w, h, V)
    const after = zoomAround(before, 99, 150, 150, w, h, V)
    expect(after.scale).toBeCloseTo(minScale(w, h, V) * MAX_ZOOM, 5)
  })

  it('still covers after zooming at a corner', () => {
    const before = centeredView(w, h, V)
    expect(covers(zoomAround(before, before.scale * 3, 0, 0, w, h, V), w, h)).toBe(true)
    expect(covers(zoomAround(before, before.scale * 3, V, V, w, h, V), w, h)).toBe(true)
  })
})

describe('panBy', () => {
  const w = 1200
  const h = 600

  it('moves the image with the finger', () => {
    const before = centeredView(w, h, V)
    const after = panBy(before, 30, 0, w, h, V)
    expect(after.offsetX).toBe(before.offsetX + 30)
  })

  it('stops at the edge rather than tearing free', () => {
    const before = centeredView(w, h, V)
    const after = panBy(before, 9999, 0, w, h, V)
    expect(after.offsetX).toBe(0)
    expect(covers(after, w, h)).toBe(true)
  })

  it('cannot move an axis that exactly fits', () => {
    const before = centeredView(w, h, V)
    expect(panBy(before, 0, 40, w, h, V).offsetY).toBe(0)
  })
})

describe('cropRect', () => {
  it('is the whole short side at the covering scale', () => {
    const view = centeredView(1200, 600, V)
    expect(cropRect(view, 1200, 600, V).size).toBe(600)
  })

  it('halves as you zoom in twice', () => {
    const view = centeredView(1200, 600, V)
    const zoomed = zoomAround(view, view.scale * 2, V / 2, V / 2, 1200, 600, V)
    expect(cropRect(zoomed, 1200, 600, V).size).toBe(300)
  })

  it('never runs off the image, wherever it is panned', () => {
    for (const [w, h] of [[1200, 600], [600, 1200], [4032, 3024], [300, 300]] as const) {
      const base = centeredView(w, h, V)
      for (const [dx, dy] of [[0, 0], [9999, 9999], [-9999, -9999], [-40, 25]] as const) {
        const rect = cropRect(panBy(base, dx, dy, w, h, V), w, h, V)
        expect(rect.x).toBeGreaterThanOrEqual(0)
        expect(rect.y).toBeGreaterThanOrEqual(0)
        expect(rect.x + rect.size).toBeLessThanOrEqual(w)
        expect(rect.y + rect.size).toBeLessThanOrEqual(h)
      }
    }
  })

  it('picks the right-hand square when panned fully right', () => {
    const base = centeredView(1000, 600, V)
    const rect = cropRect(panBy(base, -9999, 0, 1000, 600, V), 1000, 600, V)
    expect(rect.x).toBe(400)
    expect(rect.size).toBe(600)
  })

  it('never returns a zero-sized square', () => {
    const view = centeredView(10, 10, V)
    expect(cropRect(view, 10, 10, V).size).toBeGreaterThan(0)
  })
})

describe('distance', () => {
  it('measures a pinch', () => {
    expect(distance(0, 0, 3, 4)).toBe(5)
    expect(distance(10, 10, 10, 10)).toBe(0)
  })
})
