import { describe, expect, it } from 'vitest'
import { direction, isEdgeStart } from './swipe'

/*
 * The two decisions in swipe.ts that can be made without a DOM. The listeners
 * themselves are tested on the phone — and round 10.2's lesson stands: a
 * gesture driven with a mouse proves nothing about a finger.
 */

describe('which way a gesture went', () => {
  it('turns a clear leftward drag into "next"', () => {
    // The content follows the finger, so dragging left brings the next month in
    // from the right — the direction every paged thing on a phone uses.
    expect(direction(-120, 0)).toBe('next')
    expect(direction(120, 0)).toBe('previous')
  })

  it('ignores a nudge', () => {
    expect(direction(-20, 0)).toBe(null)
    expect(direction(40, 0)).toBe(null)
  })

  it('ignores anything that is really a scroll', () => {
    // A diagonal flick is much more likely to be a scroll than a page turn, and
    // turning the page when somebody meant to scroll loses their place.
    expect(direction(-100, 100)).toBe(null)
    expect(direction(-100, 80)).toBe(null)
    // Clearly sideways: 1.4× more horizontal than vertical.
    expect(direction(-140, 40)).toBe('next')
  })

  it('ignores a purely vertical drag however long', () => {
    expect(direction(0, -400)).toBe(null)
  })
})

describe('the strip that belongs to Android', () => {
  it('leaves the back gesture alone at both edges', () => {
    // The reason round 11 deferred this feature: a swipe starting at the edge
    // is the system's, and it must keep working.
    expect(isEdgeStart(0, 412)).toBe(true)
    expect(isEdgeStart(12, 412)).toBe(true)
    expect(isEdgeStart(411, 412)).toBe(true)
    expect(isEdgeStart(400, 412)).toBe(true)
  })

  it('takes everything in between', () => {
    expect(isEdgeStart(25, 412)).toBe(false)
    expect(isEdgeStart(206, 412)).toBe(false)
    expect(isEdgeStart(387, 412)).toBe(false)
  })
})
