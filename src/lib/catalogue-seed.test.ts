import { describe, expect, it } from 'vitest'
import { CATALOGUE_SEED, flattenSeed } from './catalogue-seed'

describe('catalogue seed', () => {
  const rows = flattenSeed()

  it('has the 300+ items the design calls for', () => {
    expect(rows.length).toBeGreaterThanOrEqual(300)
  })

  it('has no duplicate names', () => {
    // The database has a unique index on lower(trim(name)) for seeded rows, so
    // a duplicate here doesn't just look untidy — it makes seeding fail.
    const keys = rows.map((row) => row.name.trim().toLowerCase())
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps every name within the length the database accepts', () => {
    for (const row of rows) {
      const trimmed = row.name.trim()
      expect(trimmed.length).toBeGreaterThan(0)
      expect(trimmed.length).toBeLessThanOrEqual(60)
    }
  })

  it('gives every item a category that exists', () => {
    const categories = new Set(CATALOGUE_SEED.map((c) => c.name))
    for (const row of rows) {
      expect(categories.has(row.category)).toBe(true)
    }
  })

  it('orders items by category, then by position within it', () => {
    // The grid renders in sortOrder, so this ordering is what stops the
    // catalogue reshuffling into a sequence nobody walks a shop in.
    const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
    expect(sorted.map((r) => r.name)).toEqual(rows.map((r) => r.name))

    const firstOfEachCategory = CATALOGUE_SEED.map(
      (category) => rows.find((row) => row.category === category.name)?.sortOrder ?? -1,
    )
    const ascending = [...firstOfEachCategory].sort((a, b) => a - b)
    expect(firstOfEachCategory).toEqual(ascending)
  })

  it('leaves icon null rather than undefined when there is no emoji', () => {
    // Null is what goes into the database column; undefined would be dropped
    // from the JSON payload entirely and read back as missing, not empty.
    for (const row of rows) {
      expect(row.icon === null || typeof row.icon === 'string').toBe(true)
    }
  })
})
