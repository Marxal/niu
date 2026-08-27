/*
 * Who is in the household, as reactive state — names, colours, avatars, and the
 * code that lets a second person in.
 *
 * Round 2 built households and then deferred the invite flow, and nothing until
 * now needed it: a shopping list shared by one person works fine. The calendar
 * is the first feature that cannot be built without it. "Who's going" needs
 * faces, and "send it to her to confirm" needs a her.
 *
 * ## Why a code and not an email invite
 *
 * An email invite needs something that sends email. This project has no server
 * and no budget (NIU.md §1), so the invite is six characters read off one phone
 * and typed into the other — which for two people in the same kitchen is also
 * simply faster.
 *
 * ## Your own row is special
 *
 * You may edit your own membership and nobody else's; the database enforces it
 * (0012, "edit your own membership"). So `updateProfile` never takes a user id
 * — there is exactly one row it could be talking about.
 *
 * Fail soft throughout: a failed call sets `error` and leaves the last good
 * list on screen.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { auth } from './auth.svelte'
import { DEFAULT_TAG_COLOUR, isTagColour, type TagColour } from './dish-tags'
import { household } from './household.svelte'
import { strings } from './strings'
import { supabase } from './supabase'

export interface Member {
  userId: string
  /** What they called themselves. Null until they choose. */
  name: string | null
  colour: TagColour
  /** One emoji, or null for the initial-letter fallback. */
  avatar: string | null
  /** Their own copy of their sign-in address; see 0012. */
  email: string | null
  role: 'owner' | 'member'
  joinedAt: string
  /** Which Google calendar their phone pushes into. Null until they connect. */
  googleCalendarId: string | null
}

class MembersState {
  list = $state<Member[]>([])
  loading = $state(false)
  error = $state<string | null>(null)
  /** The six characters the other phone types. Null until it is asked for. */
  joinCode = $state<string | null>(null)
  /** True while a join is in flight, so the button can go quiet. */
  joining = $state(false)

  /** Your own row, or null before it has loaded. */
  me = $derived(this.list.find((m) => m.userId === auth.userId) ?? null)

  /** Everyone but you — who "send for confirmation" actually asks. */
  others = $derived(this.list.filter((m) => m.userId !== auth.userId))

  /** True when there is nobody to send anything to yet. */
  alone = $derived(this.list.length < 2)
}

export const members = new MembersState()

/**
 * What to draw for someone who has not chosen a name.
 *
 * The email's first part beats a bare uuid and is usually recognisable — but
 * only until they pick a name, which the settings screen asks for on first run.
 */
export function memberName(member: Member | null): string {
  if (!member) return strings.members.someone
  if (member.name && member.name.trim() !== '') return member.name
  const local = member.email?.split('@')[0]
  return local && local !== '' ? local : strings.members.someone
}

/** The letter on an avatar with no emoji on it. */
export function memberInitial(member: Member | null): string {
  return memberName(member).trim().charAt(0).toUpperCase() || '?'
}

/** Look one up by id — what an event's attendee list holds. */
export function memberById(userId: string): Member | null {
  return members.list.find((m) => m.userId === userId) ?? null
}

interface MemberRow {
  user_id: string
  display_name: string | null
  colour: string | null
  avatar: string | null
  email: string | null
  role: string
  joined_at: string
  google_calendar_id: string | null
}

function toMember(row: MemberRow): Member {
  return {
    userId: row.user_id,
    name: row.display_name,
    colour: isTagColour(row.colour) ? row.colour : DEFAULT_TAG_COLOUR,
    avatar: row.avatar,
    email: row.email,
    role: row.role === 'owner' ? 'owner' : 'member',
    joinedAt: row.joined_at,
    googleCalendarId: row.google_calendar_id,
  }
}

export async function loadMembers(): Promise<void> {
  if (!supabase || !household.id) return

  members.loading = true

  const { data, error } = await supabase
    .from('household_members')
    .select('user_id, display_name, colour, avatar, email, role, joined_at, google_calendar_id')
    .eq('household_id', household.id)
    .order('joined_at')

  members.loading = false

  if (error || !data) {
    members.error = strings.members.loadFailed
    return
  }

  members.error = null
  members.list = (data as MemberRow[]).map(toMember)

  // Copy the sign-in address across on first sight. auth.users is not readable
  // between accounts, so without this the other person is a bare uuid until
  // they choose a name — and the first thing you want to see after inviting
  // somebody is that it was *them* who arrived.
  const me = members.list.find((m) => m.userId === auth.userId)
  if (me && me.email === null && auth.email !== null) {
    void updateProfile({ email: auth.email })
  }
}

let channel: RealtimeChannel | null = null

/** Keeps the member list in step — mostly so a join shows up without a reload. */
export function watchMembers(): () => void {
  if (!supabase || !household.id) return () => {}

  const client = supabase

  channel = client
    .channel(`members:${household.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'household_members',
        filter: `household_id=eq.${household.id}`,
      },
      () => void loadMembers(),
    )
    .subscribe()

  return () => {
    if (channel) {
      void client.removeChannel(channel)
      channel = null
    }
  }
}

export interface ProfileChanges {
  name?: string | null
  colour?: TagColour
  avatar?: string | null
  email?: string
  googleCalendarId?: string | null
}

/**
 * Changes your own row. Always your own — see the header.
 *
 * Written straight through rather than optimistically: a name is typed once and
 * a colour is tapped once, so the round trip is never in the way of anything.
 */
export async function updateProfile(changes: ProfileChanges): Promise<void> {
  if (!supabase || !household.id || !auth.userId) return

  const patch: Record<string, unknown> = {}
  if ('name' in changes) {
    const trimmed = changes.name?.trim() ?? ''
    patch.display_name = trimmed === '' ? null : trimmed.slice(0, 40)
  }
  if (changes.colour !== undefined) patch.colour = changes.colour
  if ('avatar' in changes) patch.avatar = changes.avatar
  if (changes.email !== undefined) patch.email = changes.email
  if ('googleCalendarId' in changes) patch.google_calendar_id = changes.googleCalendarId

  if (Object.keys(patch).length === 0) return

  const { error } = await supabase
    .from('household_members')
    .update(patch)
    .eq('household_id', household.id)
    .eq('user_id', auth.userId)

  if (error) {
    members.error = strings.members.saveFailed
    return
  }

  members.error = null
  await loadMembers()
}

/**
 * Fetches (or creates) the code the other phone types in.
 *
 * Lazy on the server side too: a household made before this round has no code
 * until somebody asks for one, which means no backfill and no migration that
 * has to touch every row.
 */
export async function fetchJoinCode(): Promise<void> {
  if (!supabase) return

  const { data, error } = await supabase.rpc('household_join_code')

  if (error || typeof data !== 'string') {
    members.error = strings.members.codeFailed
    return
  }

  members.error = null
  members.joinCode = data
}

/**
 * Joins the household behind a code, leaving the one you are in.
 *
 * Returns a short sentence to show when it doesn't work, or null when it did.
 * The three refusals the database can raise all mean something specific and all
 * deserve their own line — "something went wrong" here would leave someone
 * retyping a code that was never the problem.
 */
export async function joinHousehold(code: string): Promise<string | null> {
  if (!supabase) return strings.members.joinFailed

  const clean = code.trim().toUpperCase()
  if (clean.length !== 6) return strings.members.codeWrongLength

  members.joining = true
  const { error } = await supabase.rpc('join_household', { code: clean })
  members.joining = false

  if (error) {
    if (error.message.includes('no such code')) return strings.members.codeNotFound
    if (error.message.includes('leave your current')) return strings.members.leaveFirst
    return strings.members.joinFailed
  }

  return null
}

/** Clears everything on sign-out so nothing leaks into the next session. */
export function clearMembers(): void {
  members.list = []
  members.joinCode = null
  members.error = null
  members.loading = false
  members.joining = false
}
