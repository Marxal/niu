import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTE, TABS, hrefFor, parseRoute, parseSubRoute } from './router'

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

describe('parseSubRoute', () => {
  it('reads the segment after the route', () => {
    expect(parseSubRoute('#/meals/dishes')).toBe('dishes')
    expect(parseSubRoute('#/meals/dishes/')).toBe('dishes')
    expect(parseSubRoute('#/MEALS/DISHES')).toBe('dishes')
    expect(parseSubRoute('#/meals/dishes?x=1')).toBe('dishes')
  })

  it('is null where there is no sub-route', () => {
    expect(parseSubRoute('#/meals')).toBe(null)
    expect(parseSubRoute('#/meals/')).toBe(null)
    expect(parseSubRoute('')).toBe(null)
    expect(parseSubRoute('#')).toBe(null)
  })

  it('leaves an unknown sub-route alone for the screen to ignore', () => {
    expect(parseSubRoute('#/meals/nonsense')).toBe('nonsense')
  })
})
