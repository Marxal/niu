import { describe, expect, it } from 'vitest'
import { MAX_INPUT_BYTES, checkPhoto, looksLikeImage, photoPath } from './photo'


describe('checkPhoto', () => {
  it('accepts what a phone picker hands back', () => {
    expect(checkPhoto({ type: 'image/jpeg', size: 3_000_000 })).toBe(null)
    expect(checkPhoto({ type: 'image/png', size: 100 })).toBe(null)
    expect(checkPhoto({ type: 'image/HEIC', size: 100 })).toBe(null)
  })

  it('accepts an image type it has never heard of', () => {
    // The round-11.2 allowlist rejected these outright, which is a way to
    // refuse a real photo for having an unusual label. The decoder is the gate.
    expect(checkPhoto({ type: 'image/avif', size: 100 })).toBe(null)
    expect(checkPhoto({ type: 'image/jxl', size: 100 })).toBe(null)
    expect(checkPhoto({ type: 'image/x-adobe-dng', size: 100 })).toBe(null)
    expect(looksLikeImage('image/anything')).toBe(true)
    expect(looksLikeImage('text/plain')).toBe(false)
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

