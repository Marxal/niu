/*
 * Which household you're in.
 *
 * On first sign-in there is no household yet, so this calls ensure_household()
 * in the database — one round trip that either creates your home or hands back
 * the one you already have. Doing it in SQL rather than as two inserts from
 * here means it can't half-succeed, and two devices signing in at once can't
 * leave you with two homes.
 *
 * Fail soft: every failure here leaves `name` null and sets `error`. Settings
 * shows a short line instead of a household name; nothing else in the app
 * depends on it yet.
 */

import { strings } from './strings'
import { supabase } from './supabase'

class HouseholdState {
  id = $state<string | null>(null)
  name = $state<string | null>(null)
  loading = $state(false)
  error = $state<string | null>(null)
}

export const household = new HouseholdState()

/** Finds or creates the signed-in user's household. Safe to call more than once. */
export async function loadHousehold(): Promise<void> {
  if (!supabase) return

  household.loading = true
  household.error = null

  const { data: id, error: ensureError } = await supabase.rpc('ensure_household')

  if (ensureError || typeof id !== 'string') {
    household.loading = false
    household.error = strings.household.loadFailed
    return
  }

  // RLS means this only returns a row if the membership really exists, so a
  // successful read here is also a check that the policies are doing their job.
  const { data, error } = await supabase
    .from('households')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()

  household.loading = false

  if (error || !data) {
    household.error = strings.household.loadFailed
    return
  }

  household.id = data.id
  household.name = data.name
}

/** Clears household state on sign-out so nothing leaks into the next session. */
export function clearHousehold(): void {
  household.id = null
  household.name = null
  household.error = null
  household.loading = false
}
