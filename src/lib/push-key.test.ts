import { describe, expect, it } from 'vitest'
import { decodeBase64Url, encodeBase64Url } from './push-key'

/** The real application server key generated for this project, as a shape test. */
const VAPID = 'BD0PF7lqIlevEdJ3BNtPPQO5F-1ISscstgxy58Iq4xKXRlgaUKL54Pm4cAy5gVPIeEbGsa5mE1Q0xWLBUMNKq9o'

function buffer(...bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer
}

describe('decodeBase64Url', () => {
  it('decodes a VAPID key to the 65 bytes of a P-256 point', () => {
    const bytes = decodeBase64Url(VAPID)
    expect(bytes.length).toBe(65)
    // 0x04 is the uncompressed-point tag. Getting the alphabet wrong is the
    // one bug that still produces plausible-looking bytes, and this catches it.
    expect(bytes[0]).toBe(4)
  })

  it('translates the url alphabet rather than choking on it', () => {
    // '-' and '_' stand in for '+' and '/'. 'a-_A' is four characters, so it
    // needs no padding either.
    expect(Array.from(decodeBase64Url('a-_A'))).toEqual([107, 239, 192])
  })

  it('restores padding for every remainder', () => {
    expect(decodeBase64Url('QQ').length).toBe(1)
    expect(decodeBase64Url('QUJD').length).toBe(3)
    expect(decodeBase64Url('QUJDRA').length).toBe(4)
    expect(decodeBase64Url('QUJDREU').length).toBe(5)
  })

  it('ignores surrounding whitespace, which a pasted key always has', () => {
    expect(Array.from(decodeBase64Url('  QUJD \n'))).toEqual([65, 66, 67])
  })
})

describe('encodeBase64Url', () => {
  it('encodes bytes without padding', () => {
    expect(encodeBase64Url(buffer(65, 66, 67))).toBe('QUJD')
    expect(encodeBase64Url(buffer(65))).toBe('QQ')
  })

  it('uses - and _ rather than + and /', () => {
    // These three bytes are the ones that land on indexes 62 and 63, which are
    // the two characters plain base64 and base64url disagree about.
    const encoded = encodeBase64Url(buffer(107, 239, 192))
    expect(encoded).toBe('a-_A')
    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
  })

  it('gives an empty string for the null getKey() is allowed to return', () => {
    expect(encodeBase64Url(null)).toBe('')
  })

  it('round-trips the real VAPID key unchanged', () => {
    expect(encodeBase64Url(decodeBase64Url(VAPID).buffer)).toBe(VAPID)
  })
})
