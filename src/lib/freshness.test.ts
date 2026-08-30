import { describe, expect, it } from 'vitest'
import { Generation } from './freshness'

describe('Generation', () => {
  it('calls a read fresh when nothing happened while it was waiting', () => {
    const gen = new Generation()
    const ticket = gen.mark()
    expect(gen.isStale(ticket)).toBe(false)
  })

  it('calls a read stale when local state changed under it', () => {
    const gen = new Generation()
    const ticket = gen.mark()
    gen.bump()
    expect(gen.isStale(ticket)).toBe(true)
  })

  it('keeps calling it stale afterwards — a dropped answer stays dropped', () => {
    const gen = new Generation()
    const ticket = gen.mark()
    gen.bump()
    gen.bump()
    expect(gen.isStale(ticket)).toBe(true)
  })

  it('lets a read started after the change through', () => {
    const gen = new Generation()
    gen.bump()
    const ticket = gen.mark()
    expect(gen.isStale(ticket)).toBe(false)
  })

  it('judges two overlapping reads independently', () => {
    const gen = new Generation()
    // The slow one goes out first, a delete lands, then a second read goes out.
    const slow = gen.mark()
    gen.bump()
    const fast = gen.mark()

    expect(gen.isStale(slow)).toBe(true)
    expect(gen.isStale(fast)).toBe(false)
  })
})
