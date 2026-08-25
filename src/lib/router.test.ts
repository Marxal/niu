import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTE, TABS, hrefFor, parseRoute } from './router'

describe('parseRoute', () => {
  it('defaults to shopping when there is no hash', () => {
    expect(parseRoute('')).toBe(DEFAULT_ROUTE)
    expect(parseRoute('#')).toBe(DEFAULT_ROUTE)
    expect(parseRoute('#/')).toBe(DEFAULT_ROUTE)
  })

  it('reads every known route', () => {
    expect(parseRoute('#/shopping')).toBe('shopping')
    expect(parseRoute('#/meals')).toBe('meals')
    expect(parseRoute('#/calendar')).toBe('calendar')
    expect(parseRoute('#/settings')).toBe('settings')
  })

  it('tolerates messy hashes', () => {
    expect(parseRoute('#meals')).toBe('meals')
    expect(parseRoute('#/meals/')).toBe('meals')
    expect(parseRoute('#//meals')).toBe('meals')
    expect(parseRoute('#/MEALS')).toBe('meals')
    expect(parseRoute('#/meals?day=2')).toBe('meals')
    expect(parseRoute('#/meals/tuesday')).toBe('meals')
  })

  it('falls back instead of throwing on nonsense', () => {
    expect(parseRoute('#/nope')).toBe(DEFAULT_ROUTE)
    expect(parseRoute('#/../etc')).toBe(DEFAULT_ROUTE)
  })
})

describe('hrefFor', () => {
  it('round-trips with parseRoute', () => {
    for (const tab of TABS) {
      expect(parseRoute(hrefFor(tab.id))).toBe(tab.id)
    }
    expect(parseRoute(hrefFor('settings'))).toBe('settings')
  })
})
