/*
 * Everyone in the household — with an account or without — and their faces.
 *
 * This was `members.svelte.ts` until round 11.2. The rename is the point: a
 * *member* is an account, and half the people in a family do not have one. A
 * **person** is a name and a face that events can point at, and whether there
 * is a login behind it is one nullable column (see 0013).
 *
 * So `people.list` holds both, in one order, and the only places the difference
 * shows are the three where it genuinely matters:
 *
 *   - only a person with an account can be *asked to confirm* something
 *   - only you may edit your own row; anybody may edit a person with no account
 *   - only a person with no account can be removed from here
 *
 * ## Faces, in order of preference
 *
 * A photo this household uploaded → the Google picture that came with the
 * account → an emoji they chose → the first letter of their name. Four
 * fallbacks because each one can be absent and none of them is worth blocking
 * on: NIU.md §6 takes exactly this stance about item icons.
 *
 * The uploaded photo lives in a **private** bucket, so drawing it needs a
 * signed link. Those are fetched in one batch on load and cached here until
 * they expire; see `signPhotos`.
 *
 * Fail soft throughout: a failed call sets `error` and leaves the last good
 * list on screen.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { auth } from './auth.svelte'
import { DEFAULT_TAG_COLOUR, isTagColour, type TagColour } from './dish-tags'
import { household } from './household.svelte'
import { photoPath } from './photo'
import { strings } from './strings'
import { supabase } from './supabase'

export interface Person {
  id: string
  /** Null for somebody who has no account — a child, a grandparent. */
  userId: string | null
  name: string | null
  colour: TagColour
  /** One emoji, or null. */
  avatar: string | null
  /** Object path in the `avatars` bucket, or null. Beats everything else. */
  photoPath: string | null
  /** Google's own picture, when the account arrived with one. */
  photoUrl: string | null
  email: string | null
  position: number
  createdAt: string
}

/** How long a signed photo link is asked for. */
const SIGNED_FOR_SECONDS = 60 * 60

class PeopleState {
  list = $state<Person[]>([])
  loading = $state(false)
  error = $state<string | null>(null)
  /** The six characters the other phone types. Null until it is asked for. */
  joinCode = $state<string | null>(null)
  joining = $state(false)
  /** Signed links for uploaded photos, keyed by object path. */
  photoLinks = $state<Record<string, string>>({})

  /** Your own row, or null before it has loaded. */
  me = $derived(this.list.find((p) => p.userId === auth.userId) ?? null)

  /** Everyone but you. */
  others = $derived(this.list.filter((p) => p.userId !== auth.userId))

  /** The people who could be asked to confirm something — accounts only. */
  accounts = $derived(this.list.filter((p) => p.userId !== null))

  /** True when nobody else has an account yet, so there is nobody to ask. */
  alone = $derived(this.accounts.length < 2)
}

export const people = new PeopleState()

/* -------------------------------------------------------------------------- */
/* Reading one                                                                 */
/* -------------------------------------------------------------------------- */

export function personName(person: Person | null): string {
  if (!person) return strings.people.someone
  if (person.name && person.name.trim() !== '') return person.name
  const local = person.email?.split('@')[0]
  return local && local !== '' ? local : strings.people.someone
}

/** The letter on a face with no picture on it. */
export function personInitial(person: Person | null): string {
  return personName(person).trim().charAt(0).toUpperCase() || '?'
}

export function personById(id: string): Person | null {
  return people.list.find((p) => p.id === id) ?? null
}

export function personByUserId(userId: string): Person | null {
  return people.list.find((p) => p.userId === userId) ?? null
}

/**
 * The picture to draw for somebody, or null to fall back to emoji or a letter.
 *
 * The uploaded photo wins over Google's: one is a choice this household made,
 * the other is whatever was on the account.
 */
export function personPhoto(person: Person | null): string | null {
  if (!person) return null
  if (person.photoPath) return people.photoLinks[person.photoPath] ?? null
  return person.photoUrl
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

interface PersonRow {
  id: string
  user_id: string | null
  display_name: string | null
  colour: string | null
  avatar: string | null
  photo_path: string | null
  photo_url: string | null
  email: string | null
  position: number
  created_at: string
}

function toPerson(row: PersonRow): Person {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.display_name,
    colour: isTagColour(row.colour) ? row.colour : DEFAULT_TAG_COLOUR,
    avatar: row.avatar,
    photoPath: row.photo_path,
    photoUrl: row.photo_url,
    email: row.email,
    position: row.position,
    createdAt: row.created_at,
  }
}

export async function loadPeople(): Promise<void> {
  if (!supabase || !household.id) return

  people.loading = true

  const { data, error } = await supabase
    .from('household_people')
    .select(
      'id, user_id, display_name, colour, avatar, photo_path, photo_url, email, position, created_at',
    )
    .eq('household_id', household.id)
    .order('position')
    .order('created_at')

  people.loading = false

  if (error || !data) {
    people.error = strings.people.loadFailed
    return
  }

  people.error = null
  people.list = (data as unknown as PersonRow[]).map(toPerson)

  await signPhotos()
  await captureGoogleIdentity()
}

/**
 * Fetches a signed link for every uploaded photo, in one call.
 *
 * The bucket is private (0013 explains why), so an `<img src>` needs a signed
 * URL. Signing the whole list at once rather than one at a time matters: a
 * household of four otherwise means four round trips before anybody has a face.
 */
async function signPhotos(): Promise<void> {
  if (!supabase) return

  const paths = people.list.map((p) => p.photoPath).filter((p) => p !== null)
  if (paths.length === 0) {
    people.photoLinks = {}
    return
  }

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrls(paths, SIGNED_FOR_SECONDS)

  // A failure here costs faces, not function: everybody falls back to their
  // emoji or their initial, which is what the design does anyway.
  if (error || !data) return

  const links: Record<string, string> = {}
  for (const row of data) {
    if (row.path && row.signedUrl) links[row.path] = row.signedUrl
  }
  people.photoLinks = links
}

/**
 * Copies what Google knows about you onto your own row, once.
 *
 * Two things: the email, because `auth.users` is not readable across accounts
 * and without a copy the other person is a bare uuid until they choose a name;
 * and the profile picture, so a fresh account has a face before anybody has
 * done anything at all.
 *
 * The picture is stored as Google's own address rather than downloaded into our
 * bucket. Downloading it would need the image to be readable cross-origin into
 * a canvas, which is not something to depend on — and the address works
 * perfectly well as an `<img src>`. If Google ever stops serving it, the emoji
 * fallback is right there.
 *
 * Only ever fills a blank. Somebody who has set their own photo or name is not
 * overwritten on every load.
 */
async function captureGoogleIdentity(): Promise<void> {
  if (!supabase || !auth.userId) return

  const mine = people.list.find((p) => p.userId === auth.userId)
  if (!mine) return

  const changes: PersonChanges = {}
  if (mine.email === null && auth.email !== null) changes.email = auth.email
  if (mine.photoUrl === null && mine.photoPath === null) {
    const picture = await googlePicture()
    if (picture !== null) changes.photoUrl = picture
  }

  if (Object.keys(changes).length > 0) await updatePerson(mine.id, changes)
}

/**
 * The profile picture Google gave us, from the session.
 *
 * Supabase normalises the provider's claims into `user_metadata`, and which key
 * it lands under has moved around between provider versions — so both the
 * normalised name and Google's own are read. Anything that is not an https URL
 * is ignored rather than trusted into an `<img src>`.
 */
async function googlePicture(): Promise<string | null> {
  if (!supabase) return null

  const { data } = await supabase.auth.getUser()
  const meta = data.user?.user_metadata as Record<string, unknown> | undefined
  if (!meta) return null

  for (const key of ['avatar_url', 'picture']) {
    const value = meta[key]
    if (typeof value === 'string' && value.startsWith('https://')) return value
  }
  return null
}

let channel: RealtimeChannel | null = null

export function watchPeople(): () => void {
  if (!supabase || !household.id) return () => {}

  const client = supabase

  channel = client
    .channel(`people:${household.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'household_people',
        filter: `household_id=eq.${household.id}`,
      },
      () => void loadPeople(),
    )
    .subscribe()

  return () => {
    if (channel) {
      void client.removeChannel(channel)
      channel = null
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

export interface PersonChanges {
  name?: string | null
  colour?: TagColour
  avatar?: string | null
  photoPath?: string | null
  photoUrl?: string | null
  email?: string
}

function columns(changes: PersonChanges): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if ('name' in changes) {
    const trimmed = changes.name?.trim() ?? ''
    patch.display_name = trimmed === '' ? null : trimmed.slice(0, 40)
  }
  if (changes.colour !== undefined) patch.colour = changes.colour
  if ('avatar' in changes) patch.avatar = changes.avatar
  if ('photoPath' in changes) patch.photo_path = changes.photoPath
  if ('photoUrl' in changes) patch.photo_url = changes.photoUrl
  if (changes.email !== undefined) patch.email = changes.email
  return patch
}

/**
 * Changes somebody's row. The database decides whether you may: your own, or
 * anybody without an account.
 */
export async function updatePerson(id: string, changes: PersonChanges): Promise<boolean> {
  if (!supabase || !household.id) return false

  const patch = columns(changes)
  if (Object.keys(patch).length === 0) return true

  const { error } = await supabase
    .from('household_people')
    .update(patch)
    .eq('id', id)
    .eq('household_id', household.id)

  if (error) {
    people.error = strings.people.saveFailed
    return false
  }

  people.error = null
  await loadPeople()
  return true
}

/** Adds somebody who has no phone. Returns the new id, or null. */
export async function addPerson(name: string, colour: TagColour): Promise<string | null> {
  if (!supabase || !household.id) return null

  const trimmed = name.trim()
  if (trimmed === '') return null

  const { data, error } = await supabase
    .from('household_people')
    .insert({
      household_id: household.id,
      display_name: trimmed.slice(0, 40),
      colour,
      position: people.list.length,
    })
    .select('id')
    .single()

  if (error || !data) {
    people.error = strings.people.saveFailed
    return null
  }

  people.error = null
  await loadPeople()
  return (data as { id: string }).id
}

/**
 * Removes somebody who has no account.
 *
 * Their photo goes too. A row in the database is what the Storage policies
 * check against, so an object left behind after its person is gone would be
 * unreachable but still counted against the free tier.
 */
export async function removePerson(id: string): Promise<boolean> {
  if (!supabase || !household.id) return false

  const person = personById(id)
  if (person?.userId !== null && person !== null) return false

  if (person?.photoPath) {
    await supabase.storage.from('avatars').remove([person.photoPath])
  }

  const { error } = await supabase
    .from('household_people')
    .delete()
    .eq('id', id)
    .eq('household_id', household.id)

  if (error) {
    people.error = strings.people.removeFailed
    return false
  }

  people.error = null
  await loadPeople()
  return true
}

/**
 * Puts a prepared square JPEG in the bucket and points the person at it.
 *
 * `upsert` because the path is derived from the two ids and never changes:
 * replacing a photo overwrites in place rather than leaving the old one behind.
 * That is also why the row is re-saved even when `photo_path` already holds the
 * same string — the write is what tells the *other* phone to fetch a new signed
 * link for bytes that changed underneath the same address.
 */
export async function uploadPhoto(id: string, blob: Blob): Promise<boolean> {
  if (!supabase || !household.id) return false

  const path = photoPath(household.id, id)

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })

  if (uploadError) {
    people.error = strings.people.photoFailed
    return false
  }

  // Clearing the emoji is deliberate: a photo is a stronger statement, and
  // leaving both would mean the emoji reappears if the photo is ever removed,
  // which reads as the app forgetting rather than falling back.
  return updatePerson(id, { photoPath: path, avatar: null })
}

/** Takes the photo off, back to the emoji or the letter. */
export async function removePhoto(id: string): Promise<boolean> {
  if (!supabase) return false

  const person = personById(id)
  if (person?.photoPath) {
    await supabase.storage.from('avatars').remove([person.photoPath])
  }

  return updatePerson(id, { photoPath: null, photoUrl: null })
}

/* -------------------------------------------------------------------------- */
/* Getting a second account in                                                 */
/* -------------------------------------------------------------------------- */

export async function fetchJoinCode(): Promise<void> {
  if (!supabase) return

  const { data, error } = await supabase.rpc('household_join_code')

  if (error || typeof data !== 'string') {
    people.error = strings.people.codeFailed
    return
  }

  people.error = null
  people.joinCode = data
}

/**
 * Joins the household behind a code, leaving the one you are in.
 *
 * Returns a short sentence to show when it doesn't work, or null when it did.
 * The three refusals the database can raise all mean something specific and all
 * deserve their own line — "something went wrong" would leave somebody retyping
 * a code that was never the problem.
 */
export async function joinHousehold(code: string): Promise<string | null> {
  if (!supabase) return strings.people.joinFailed

  const clean = code.trim().toUpperCase()
  if (clean.length !== 6) return strings.people.codeWrongLength

  people.joining = true
  const { error } = await supabase.rpc('join_household', { code: clean })
  people.joining = false

  if (error) {
    if (error.message.includes('no such code')) return strings.people.codeNotFound
    if (error.message.includes('leave your current')) return strings.people.leaveFirst
    return strings.people.joinFailed
  }

  return null
}

export function clearPeople(): void {
  people.list = []
  people.photoLinks = {}
  people.joinCode = null
  people.error = null
  people.loading = false
  people.joining = false
}
