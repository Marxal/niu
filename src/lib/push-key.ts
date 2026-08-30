/*
 * Turning Web Push's keys between the two shapes the browser insists on.
 *
 * There are exactly two conversions in the whole feature and both of them are
 * fiddly enough to get quietly wrong:
 *
 *   1. `pushManager.subscribe()` wants the VAPID public key as **bytes**, but
 *      it is written down — in .env, in Google's docs, everywhere — as a
 *      base64url string. A wrong conversion does not throw: it produces a
 *      subscription that looks fine and that no notification ever arrives at.
 *   2. `PushSubscription.getKey()` hands back **raw ArrayBuffers**, and the
 *      database column is text. Encoding those with the wrong alphabet gives a
 *      row that the Edge Function accepts and that Google then rejects.
 *
 * Both are pure string/byte work with no DOM and no Supabase in them, which is
 * why they are here with a test beside them rather than inline in the store.
 *
 * ## base64url is not base64
 *
 * It swaps `+/` for `-_` and drops the `=` padding, because the values travel
 * in URLs. atob/btoa only speak the padded, plus-and-slash version, so every
 * conversion has to translate the alphabet as well as the bytes.
 */

/**
 * Decodes a base64url VAPID public key into the bytes `subscribe()` wants.
 *
 * A P-256 public key is 65 bytes: an 0x04 tag and two 32-byte coordinates.
 * That is not checked here — an unexpected length is the caller's problem to
 * notice, and refusing to convert would only hide it later.
 *
 * The return type says `Uint8Array<ArrayBuffer>` rather than plain `Uint8Array`
 * because TypeScript 5.7 made the buffer generic: a bare Uint8Array might sit
 * on a SharedArrayBuffer, and `pushManager.subscribe()` will not take one.
 */
export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const trimmed = value.trim()
  // '===' then slice is the shortest correct way to restore padding: base64
  // is 4 characters per 3 bytes, so a string is padded up to the next multiple
  // of four and never needs more than three '='.
  const padded = (trimmed + '===').slice(0, trimmed.length + ((4 - (trimmed.length % 4)) % 4))
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Encodes the raw bytes of a subscription key as base64url, for the database.
 *
 * Null in, empty out: `getKey()` is allowed to return null, and a subscription
 * missing a key is one the caller should refuse rather than one this should
 * throw over.
 */
export function encodeBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''

  const bytes = new Uint8Array(buffer)
  let binary = ''
  // Built a character at a time rather than with String.fromCharCode(...bytes):
  // spreading a large array into a call blows the argument limit, and while
  // these keys are only 65 bytes, the version of this that breaks is the one
  // somebody reuses for something bigger.
  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
