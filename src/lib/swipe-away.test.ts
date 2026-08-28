import { describe, expect, it } from 'vitest'
import { farEnough, sidewaysEnough } from './swipe-away'

describe('sidewaysEnough', () => {
  it('ignores a finger that has barely moved', () => {
    expect(sidewaysEnough(4, 0)).toBe(false)
    expect(sidewaysEnough(-9, 2)).toBe(false)
  })

  it('claims a clearly sideways drag', () => {
    expect(sidewaysEnough(40, 5)).toBe(true)
    expect(sidewaysEnough(-40, 5)).toBe(true)
  })

  it('leaves a downward drag to the scroller', () => {
    expect(sidewaysEnough(5, 40)).toBe(false)
  })

  it('leaves a diagonal to the scroller too', () => {
    // A swipe has to be clearly more horizontal than vertical, not merely more.
    expect(sidewaysEnough(30, 25)).toBe(false)
    expect(sidewaysEnough(30, 15)).toBe(true)
  })
})

describe('farEnough', () => {
  it('is not far enough for a nudge', () => {
    expect(farEnough(20)).toBe(false)
  })

  it('is far enough for a push, either way', () => {
    expect(farEnough(90)).toBe(true)
    expect(farEnough(-90)).toBe(true)
  })

  it('takes a distance when a caller wants a different one', () => {
    expect(farEnough(40, 30)).toBe(true)
    expect(farEnough(40, 50)).toBe(false)
  })
})
