/*
 * Turning phone notifications on, and remembering that this phone said yes.
 *
 * Round 17. NIU.md §9 named the three pieces this needs; this is the one that
 * runs in the page. The other two are public/sw.js, which draws the
 * notification, and supabase/functions/niu-push, which sends it.
 *
 * ## What actually gets stored
 *
 * A Web Push subscription is not an account setting, it is an address for one
 * browser on one phone. Two phones signed into the same account are two rows,
 * and clearing site data on either one silently invalidates its row — which is
 * why the Edge Function deletes rows that come back "gone" rather than trying
 * to keep this table tidy from here.
 *
 * ## Permission has to come from a tap
 *
 * Chrome refuses a notification prompt that was not triggered by a real
 * gesture, and — worse — a person who dismisses one is much harder to ask
 * again. So nothing here runs at boot except the read-only status check. The
 * asking happens when somebody presses the switch in Settings, having just read
 * a sentence saying what they will get.
 *
 * ## Fail soft
 *
 * Every failure leaves `error` set, the switch off, and the rest of the app
 * untouched. A household that never turns this on loses nothing at all: the
 * confirmation still arrives in the app and still puts a number on the Calendar
 * tab, exactly as it has since round 11.
 */

import { auth } from './auth.svelte'
import { vapidPublicKey } from './config'
import { decodeBase64Url, encodeBase64Url } from './push-key'
import { household } from './household.svelte'
import { strings } from './strings'
import { supabase } from './supabase'

/**
 * unavailable  this build or this browser cannot do it — no key, no worker,
 *              or the dev server, where there is deliberately no worker at all
 * off          it could, and this phone has not said yes
 * asking       Chrome's own prompt is on screen, or we are mid-subscribe
 * on           this phone is subscribed and the row is in the database
 * blocked      the person said no, and only Android's settings can undo that
 */
export type PushStatus = 'unavailable' | 'off' | 'asking' | 'on' | 'blocked'

class PushState {
  status = $state<PushStatus>('unavailable')
  error = $state<string | null>(null)
}

export const push = new PushState()

/**
 * Whether this browser has all four moving parts. Checked as a group because
 * there is no useful half-state: a browser with a worker but no PushManager
 * cannot do anything with a subscription.
 *
 * The DEV check is not a browser limitation — src/lib/pwa.ts deliberately does
 * not register the worker on the dev server, so `serviceWorker.ready` would
 * wait forever. Notifications are testable on the deployed site only, which is
 * worth saying out loud rather than debugging twice.
 */
function usable(): boolean {
  if (import.meta.env.DEV) return false
  if (vapidPublicKey === '') return false
  return (
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  )
}

/** The subscription this browser already has, or null. Never throws. */
async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    return (await registration?.pushManager.getSubscription()) ?? null
  } catch {
    return null
  }
}

/**
 * Works out where this phone stands. Read-only: it never prompts, so it is safe
 * to call whenever Settings opens.
 */
export async function loadPush(): Promise<void> {
  push.error = null

  if (!usable()) {
    push.status = 'unavailable'
    return
  }

  if (Notification.permission === 'denied') {
    push.status = 'blocked'
    return
  }

  const subscription = await currentSubscription()
  push.status = subscription && Notification.permission === 'granted' ? 'on' : 'off'
}

/**
 * Writes this phone's subscription down so the Edge Function can find it.
 *
 * Upsert on the endpoint rather than insert: a browser is entitled to replace a
 * subscription whenever it likes, and the same phone arriving twice must update
 * its row. Two rows for one phone is how a household ends up being notified
 * twice about everything.
 */
async function remember(subscription: PushSubscription): Promise<boolean> {
  if (!supabase || !auth.userId || !household.id) return false

  const keys = subscription.toJSON().keys
  const p256dh = keys?.p256dh ?? encodeBase64Url(subscription.getKey('p256dh'))
  const auth_ = keys?.auth ?? encodeBase64Url(subscription.getKey('auth'))

  // A subscription missing either key cannot be encrypted to, so storing it
  // would only produce a row that fails forever.
  if (p256dh === '' || auth_ === '') return false

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: subscription.endpoint,
      user_id: auth.userId,
      household_id: household.id,
      p256dh,
      auth: auth_,
      device: navigator.userAgent.slice(0, 120),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )

  return error === null
}

/**
 * Asks for permission and subscribes. Must be called straight from a tap.
 *
 * Returns nothing: the switch reads `push.status` and `push.error` afterwards,
 * which keeps every outcome in one place rather than half in a boolean.
 */
export async function enablePush(): Promise<void> {
  push.error = null

  if (!usable()) {
    push.status = 'unavailable'
    return
  }

  push.status = 'asking'

  try {
    const permission = await Notification.requestPermission()

    if (permission === 'denied') {
      push.status = 'blocked'
      return
    }

    if (permission !== 'granted') {
      // 'default' — the prompt was dismissed rather than answered. Chrome will
      // ask again another day; nothing is broken.
      push.status = 'off'
      return
    }

    const registration = await navigator.serviceWorker.ready

    // An existing subscription is reused rather than replaced: re-subscribing
    // would hand out a new endpoint and orphan the row already in the table.
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        // Required by Chrome, and true: every push we send draws something.
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(vapidPublicKey),
      }))

    if (!(await remember(subscription))) {
      push.status = 'off'
      push.error = strings.push.saveFailed
      return
    }

    push.status = 'on'
  } catch {
    push.status = 'off'
    push.error = strings.push.failed
  }
}

/**
 * Stops this phone being notified, without touching the other one.
 *
 * The row goes first. If the order were reversed and the delete failed, the
 * phone would be unsubscribed with a row still pointing at it — an address the
 * Edge Function would keep writing to until Google said gone.
 */
export async function disablePush(): Promise<void> {
  push.error = null

  const subscription = await currentSubscription()
  if (!subscription) {
    push.status = 'off'
    return
  }

  if (supabase) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  }

  try {
    await subscription.unsubscribe()
  } catch {
    // The row is gone, so nothing will be sent here either way.
  }

  push.status = 'off'
}
