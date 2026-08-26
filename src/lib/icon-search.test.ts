import { describe, expect, it } from 'vitest'
import { keywordsFor, searchIcons } from './icon-search'

const INKED = new Set(['🧀', '🍅', '🥕'])

describe('searchIcons', () => {
  it('finds a drawing by its own name', () => {
    expect(searchIcons('cheese', INKED).line).toContain('cheese')
  })

  it('finds a drawing by a product that uses it', () => {
    // Nothing here is called "cheese"; they all point at the cheese drawing.
    const found = searchIcons('cheddar', INKED).line
    expect(found).toContain('cheese')
  })

  it('finds an emoji by the product it belongs to', () => {
    expect(searchIcons('tomatoes', INKED).emoji).toContain('🍅')
  })

  it('finds things by their category', () => {
    expect(searchIcons('bakery', INKED).line.length).toBeGreaterThan(0)
  })

  it('ignores case and accents', () => {
    expect(searchIcons('CHEESE', INKED).line).toContain('cheese')
    expect(searchIcons('Cafe', INKED).line).toEqual(searchIcons('café', INKED).line)
  })

  it('splits a camelCase slug, so two words still find it', () => {
    expect(searchIcons('flour bag', INKED).line).toContain('flourBag')
  })

  it('offers Inked only where we ship the drawing', () => {
    const found = searchIcons('cheese', INKED)
    expect(found.emoji).toContain('🧀')
    expect(found.inked).toContain('🧀')

    // An emoji the catalogue knows but OpenMoji here does not.
    const milk = searchIcons('milk', new Set())
    expect(milk.inked).toEqual([])
  })

  it('matches nothing for an empty query — the picker shows everything anyway', () => {
    expect(searchIcons('', INKED)).toEqual({ line: [], emoji: [], inked: [] })
    expect(searchIcons('   ', INKED)).toEqual({ line: [], emoji: [], inked: [] })
  })

  it('comes back empty rather than throwing on a word nothing matches', () => {
    expect(searchIcons('zzzzz', INKED)).toEqual({ line: [], emoji: [], inked: [] })
  })

  it('never repeats a picture, however many words point at it', () => {
    const line = searchIcons('a', INKED).line
    expect(new Set(line).size).toBe(line.length)
  })
})

describe('keywordsFor', () => {
  it('collects every product name behind one drawing', () => {
    const words = keywordsFor('line', 'cheese')
    expect(words).toContain('cheese')
    expect(words.length).toBeGreaterThan(1)
  })

  it('is empty for something that isn’t a picture', () => {
    expect(keywordsFor('line', 'not-an-icon')).toEqual([])
  })
})
