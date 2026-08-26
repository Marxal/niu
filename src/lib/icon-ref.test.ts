import { describe, expect, it } from 'vitest'
import { formatIconRef, parseIconRef } from './icon-ref'

describe('parseIconRef', () => {
  it('reads a bare slug as the item default, not a choice', () => {
    expect(parseIconRef('carrot')).toEqual({ kind: 'line', value: 'carrot', explicit: false })
  })

  it('reads each prefix as a deliberate choice', () => {
    expect(parseIconRef('line:carrot')).toEqual({ kind: 'line', value: 'carrot', explicit: true })
    expect(parseIconRef('emoji:🥕')).toEqual({ kind: 'emoji', value: '🥕', explicit: true })
    expect(parseIconRef('inked:🥕')).toEqual({ kind: 'inked', value: '🥕', explicit: true })
  })

  it('has nothing to draw for empty or missing values', () => {
    expect(parseIconRef(null)).toBeNull()
    expect(parseIconRef(undefined)).toBeNull()
    expect(parseIconRef('')).toBeNull()
  })

  it('refuses a prefix it does not know rather than guessing', () => {
    expect(parseIconRef('svg:carrot')).toBeNull()
    expect(parseIconRef('emoji:')).toBeNull()
  })

  it('round-trips what the picker writes', () => {
    const stored = formatIconRef('inked', '🍎')
    expect(stored).toBe('inked:🍎')
    expect(parseIconRef(stored)).toEqual({ kind: 'inked', value: '🍎', explicit: true })
  })
})
