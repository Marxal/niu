import { describe, expect, it } from 'vitest'
import { looksLikeSecretKey } from './config'

/** Build a fake legacy Supabase JWT with the given role claim. */
function jwtWithRole(role: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: 'supabase', role })}.signature`
}

describe('looksLikeSecretKey', () => {
  it('catches the newer secret key prefix', () => {
    expect(looksLikeSecretKey('sb_secret_abc123')).toBe(true)
    expect(looksLikeSecretKey('SB_SECRET_ABC123')).toBe(true)
  })

  it('catches a legacy service-role JWT', () => {
    expect(looksLikeSecretKey(jwtWithRole('service_role'))).toBe(true)
  })

  it('allows the keys that are meant to be public', () => {
    expect(looksLikeSecretKey('sb_publishable_abc123')).toBe(false)
    expect(looksLikeSecretKey(jwtWithRole('anon'))).toBe(false)
    expect(looksLikeSecretKey(jwtWithRole('authenticated'))).toBe(false)
  })

  it('treats an empty or unparseable key as not-secret', () => {
    expect(looksLikeSecretKey('')).toBe(false)
    expect(looksLikeSecretKey('   ')).toBe(false)
    expect(looksLikeSecretKey('not-a-jwt')).toBe(false)
    expect(looksLikeSecretKey('a.b.c')).toBe(false)
  })

  it('ignores surrounding whitespace from a sloppy copy-paste', () => {
    expect(looksLikeSecretKey(`  ${jwtWithRole('service_role')}  `)).toBe(true)
  })
})
