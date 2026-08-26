import { describe, expect, it } from 'vitest'
import {
  type DishTag,
  DEFAULT_TAG_COLOUR,
  TAG_COLOURS,
  diffTags,
  isTagColour,
  nextPosition,
  sortTags,
  tagStyle,
  tagsOf,
} from './dish-tags'

function tag(overrides: Partial<DishTag> = {}): DishTag {
  return { id: 't1', name: 'Protein', colour: 'clay', position: 0, ...overrides }
}

describe('isTagColour', () => {
  it('accepts every colour the database allows', () => {
    for (const colour of TAG_COLOURS) expect(isTagColour(colour)).toBe(true)
  })

  it('rejects anything else, including a hex value', () => {
    expect(isTagColour('#ff0000')).toBe(false)
    expect(isTagColour('turquoise')).toBe(false)
    expect(isTagColour(null)).toBe(false)
    expect(isTagColour(undefined)).toBe(false)
  })
})

describe('tagStyle', () => {
  it('builds a token reference rather than a colour', () => {
    const style = tagStyle('moss')
    expect(style).toContain('var(--color-tag-moss)')
    expect(style).toContain('var(--color-tag-moss-soft)')
    expect(style).not.toMatch(/#[0-9a-f]{3,6}/i)
  })

  it('falls back to the default rather than rendering colourless', () => {
    expect(tagStyle('chartreuse')).toBe(tagStyle(DEFAULT_TAG_COLOUR))
    expect(tagStyle('')).toBe(tagStyle(DEFAULT_TAG_COLOUR))
  })
})

describe('sortTags', () => {
  it('keeps the household’s own order', () => {
    const sorted = sortTags([
      tag({ id: 'c', name: 'Veg', position: 2 }),
      tag({ id: 'a', name: 'Protein', position: 0 }),
      tag({ id: 'b', name: 'Carbs', position: 1 }),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('falls back to the name when two share a position', () => {
    const sorted = sortTags([
      tag({ id: 'b', name: 'Sides', position: 0 }),
      tag({ id: 'a', name: 'Mains', position: 0 }),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('leaves the array it was given alone', () => {
    const original = [tag({ id: 'b', position: 1 }), tag({ id: 'a', position: 0 })]
    sortTags(original)
    expect(original.map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('tagsOf', () => {
  const all = [
    tag({ id: 'a', name: 'Protein', position: 0 }),
    tag({ id: 'b', name: 'Carbs', position: 1 }),
    tag({ id: 'c', name: 'Veg', position: 2 }),
  ]

  it('is in tag order, not the order the links arrived in', () => {
    expect(tagsOf(['c', 'a'], all).map((t) => t.id)).toEqual(['a', 'c'])
  })

  it('drops a link to a tag that no longer exists', () => {
    expect(tagsOf(['a', 'gone'], all).map((t) => t.id)).toEqual(['a'])
  })

  it('is empty for a dish with no tags — which is allowed', () => {
    expect(tagsOf([], all)).toEqual([])
  })
})

describe('nextPosition', () => {
  it('lands after everything that exists', () => {
    expect(nextPosition([tag({ position: 0 }), tag({ position: 4 })])).toBe(5)
  })

  it('starts at zero for the first tag', () => {
    expect(nextPosition([])).toBe(0)
  })
})

describe('diffTags', () => {
  it('finds what to link and what to unlink', () => {
    expect(diffTags(['a', 'b'], ['b', 'c'])).toEqual({ toAdd: ['c'], toRemove: ['a'] })
  })

  it('asks for no writes when nothing changed', () => {
    expect(diffTags(['a', 'b'], ['b', 'a'])).toEqual({ toAdd: [], toRemove: [] })
  })
})
