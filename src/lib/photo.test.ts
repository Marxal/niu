import { describe, expect, it } from 'vitest'
import {
  AVATAR_SIZE,
  MAX_INPUT_BYTES,
  checkPhoto,
  coverCrop,
  outputSize,
  photoPath,
  photoVersion,
} from './photo'

describe('coverCrop', () => {
  it('takes the whole of a square', () => {
    expect(coverCrop(500, 500)).toEqual({ x: 0, y: 0, size: 500 })
  })

  it('trims the sides of a landscape photo evenly', () => {
    // 1000 wide, 600 tall: a 600 square with 200 off each side.
    expect(coverCrop(1000, 600)).toEqual({ x: 200, y: 0, size: 600 })
  })

  it('trims the top and bottom of a portrait photo evenly', () => {
    expect(coverCrop(600, 1000)).toEqual({ x: 0, y: 200, size: 600 })
  })

  it('never runs off the edge on an odd overhang', () => {
    // 101px to lose: 50 off the left, 51 off the right. Flooring is what keeps
    // x + size inside the image rather than one pixel past it.
    const crop = coverCrop(701, 600)
    expect(crop.x).toBe(50)
    expect(crop.x + crop.size).toBeLessThanOrEqual(701)
    expect(crop.y + crop.size).toBeLessThanOrEqual(600)
  })

  it('stays inside the image for a spread of awkward sizes', () => {
    for (const [w, h] of [
      [3, 7], [7, 3], [1, 1], [4032, 3024], [3024, 4032], [1000, 999], [999, 1000],
    ] as const) {
      const crop = coverCrop(w, h)
      expect(crop.x).toBeGreaterThanOrEqual(0)
      expect(crop.y).toBeGreaterThanOrEqual(0)
      expect(crop.x + crop.size).toBeLessThanOrEqual(w)
      expect(crop.y + crop.size).toBeLessThanOrEqual(h)
      expect(crop.size).toBe(Math.min(w, h))
    }
  })

  it('never returns a zero-sized square', () => {
    expect(coverCrop(0, 500).size).toBe(1)
    expect(coverCrop(0, 0).size).toBe(1)
  })
})

describe('outputSize', () => {
  it('caps a big photo at the avatar size', () => {
    expect(outputSize(coverCrop(4032, 3024))).toBe(AVATAR_SIZE)
  })

  it('leaves a small one alone rather than blowing it up', () => {
    expect(outputSize(coverCrop(90, 120))).toBe(90)
  })

  it('is exactly the avatar size at the boundary', () => {
    expect(outputSize(coverCrop(AVATAR_SIZE, AVATAR_SIZE))).toBe(AVATAR_SIZE)
  })
})

describe('checkPhoto', () => {
  it('accepts what a phone picker hands back', () => {
    expect(checkPhoto({ type: 'image/jpeg', size: 3_000_000 })).toBe(null)
    expect(checkPhoto({ type: 'image/png', size: 100 })).toBe(null)
    expect(checkPhoto({ type: 'image/HEIC', size: 100 })).toBe(null)
  })

  it('lets an empty type through for the decoder to judge', () => {
    // Some Android pickers report no type at all for a perfectly good JPEG.
    expect(checkPhoto({ type: '', size: 100 })).toBe(null)
  })

  it('refuses something that is not an image', () => {
    expect(checkPhoto({ type: 'video/mp4', size: 100 })).toBe('type')
    expect(checkPhoto({ type: 'application/pdf', size: 100 })).toBe('type')
  })

  it('refuses something far too big to decode', () => {
    expect(checkPhoto({ type: 'image/jpeg', size: MAX_INPUT_BYTES + 1 })).toBe('size')
    expect(checkPhoto({ type: 'image/jpeg', size: MAX_INPUT_BYTES })).toBe(null)
  })
})

describe('photoPath', () => {
  it('puts the household first, because that is what the policies read', () => {
    const path = photoPath('11111111-1111-4111-8111-111111111111', 'abc')
    expect(path).toBe('11111111-1111-4111-8111-111111111111/abc.jpg')
    expect(path.split('/')[0]).toBe('11111111-1111-4111-8111-111111111111')
  })
})

describe('photoVersion', () => {
  it('changes when the photo does, so the old bytes stop being served', () => {
    expect(photoVersion(1000)).not.toBe(photoVersion(2000))
  })

  it('is short enough to sit in a query string', () => {
    expect(photoVersion(Date.now()).length).toBeLessThan(12)
  })
})
