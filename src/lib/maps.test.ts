import { describe, expect, it } from 'vitest'
import { mapsUrl } from './maps'

describe('mapsUrl', () => {
  it('has nothing to offer for an empty location', () => {
    expect(mapsUrl(null)).toBeNull()
    expect(mapsUrl('')).toBeNull()
    expect(mapsUrl('   ')).toBeNull()
  })

  it('searches Google Maps for a place name', () => {
    expect(mapsUrl('Escola Sant Jordi')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Escola%20Sant%20Jordi',
    )
  })

  it('keeps an address whole through the encoding', () => {
    // & # + and the accent all have to come out the other side as themselves.
    expect(mapsUrl('Carrer Gran 14 #3, Sant Cugat & Co')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Carrer%20Gran%2014%20%233%2C%20Sant%20Cugat%20%26%20Co',
    )
    expect(mapsUrl('Plaça Catalunya')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Pla%C3%A7a%20Catalunya',
    )
  })

  it('searches for coordinates like any other text', () => {
    expect(mapsUrl('41.3874, 2.1686')).toBe(
      'https://www.google.com/maps/search/?api=1&query=41.3874%2C%202.1686',
    )
  })

  it('opens a pasted link as itself rather than searching for it', () => {
    expect(mapsUrl('https://meet.google.com/abc-defg-hij')).toBe(
      'https://meet.google.com/abc-defg-hij',
    )
    expect(mapsUrl('  http://example.com/where  ')).toBe('http://example.com/where')
    expect(mapsUrl('HTTPS://Example.com/Where')).toBe('HTTPS://Example.com/Where')
  })

  it('treats anything that is not http(s) as text', () => {
    expect(mapsUrl('javascript:alert(1)')).toBe(
      'https://www.google.com/maps/search/?api=1&query=javascript%3Aalert(1)',
    )
    expect(mapsUrl('https://')).toBe(
      'https://www.google.com/maps/search/?api=1&query=https%3A%2F%2F',
    )
  })
})
