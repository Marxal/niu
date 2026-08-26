import { describe, expect, it } from 'vitest'
import { resolveBase } from './url'

describe('resolveBase', () => {
  it('resolves against the current path, not just the origin', () => {
    // This is the regression: resolving './' against the bare origin
    // (https://marxal.github.io) collapses to the domain root and drops /niu/.
    // Resolving against the full href keeps it.
    expect(resolveBase('./', 'https://marxal.github.io/niu/')).toBe(
      'https://marxal.github.io/niu/',
    )
  })

  it('strips a hash route off the current page', () => {
    expect(resolveBase('./', 'https://marxal.github.io/niu/#/settings')).toBe(
      'https://marxal.github.io/niu/',
    )
  })

  it('strips a query string too', () => {
    expect(resolveBase('./', 'https://marxal.github.io/niu/?code=abc123')).toBe(
      'https://marxal.github.io/niu/',
    )
  })

  it('works from any depth, not just the folder root', () => {
    expect(resolveBase('./', 'https://marxal.github.io/niu/index.html')).toBe(
      'https://marxal.github.io/niu/',
    )
  })

  it('works for local dev at the domain root', () => {
    expect(resolveBase('./', 'http://localhost:5173/')).toBe('http://localhost:5173/')
  })
})
