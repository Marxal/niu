/*
 * niu-push — the one piece of Niu that runs on a server.
 *
 * NIU.md §9 said push notifications need three new things: a service worker
 * that handles `push` (public/sw.js), a VAPID key pair, and one small Supabase
 * function holding the private key. This is that function, and the private key
 * is the only reason it exists — signing a Web Push request needs a secret, and
 * a secret in a static bundle is not a secret (CLAUDE.md rule 2).
 *
 * ## It is told who, never what
 *
 * The database trigger (supabase/migrations/0016_push.sql) sends four
 * identifiers: a kind, an event id, who to tell, and who did it. No title, no
 * time, no names. Everything a person actually reads is looked up here, from
 * the database, with the service role.
 *
 * That is not tidiness, it is the security model. The shared secret below is
 * what should stop a forged call, but if it ever leaked, the worst a stranger
 * could do is make a phone repeat something that is already true — not write
 * their own words onto somebody's lock screen.
 *
 * ## Answering from the notification itself, without opening the app
 *
 * An "ask" notification carries Yes / Can't buttons (round 17.1, Marçal: "so
 * there's no need to open the app to answer"). Tapping one has to write to
 * `event_confirmations` as if it were the recipient — and the recipient has no
 * login session to prove that with, because the whole point is answering
 * without opening the app.
 *
 * So the proof travels a different way. This function signs a small token —
 * event, recipient, an expiry — into the push payload itself, with a secret
 * only this function holds. The service worker doesn't understand the token
 * and doesn't need to; it just hands it back unchanged to POST /confirm below,
 * which checks the signature instead of a login. Possessing a valid token *is*
 * the proof, which is why Verify JWT is off for this whole function and this
 * route asks for no other credential.
 *
 * A leaked token only ever authorises one person's yes/no on one event, for
 * one day. It cannot read anything, and it cannot touch any other event.
 *
 * ## The service role key never leaves this file's runtime
 *
 * Supabase injects it as an environment variable. It bypasses every RLS policy,
 * which is exactly why nothing in `src/` may ever see it. Read the rows we need
 * and nothing else.
 *
 * ## Failure is silence, never an error at the user
 *
 * The trigger route (pg_net) queued its call and stopped caring, so an
 * exception there reaches nobody — every path returns 200 with a short note in
 * the body, so the function log reads as a history rather than a stack trace.
 * The confirm route is different: the service worker is actually waiting on
 * its answer, so it returns real status codes, and a failure there makes the
 * service worker fall back to opening the app instead of pretending the tap
 * worked.
 *
 * ## Deploying it
 *
 * Supabase dashboard -> Edge Functions -> Deploy a new function, named
 * `niu-push`. Paste this file. Turn **Verify JWT off** — the caller for the
 * trigger route is Postgres, which has no user session, and the caller for the
 * confirm route is a phone with no session either; both prove themselves with
 * a secret instead of a JWT. Then set four secrets:
 *
 *   NIU_VAPID_KEYS     the whole contents of vapid-keys.local, as one line
 *   NIU_PUSH_SECRET    the same random string as push_config.shared_secret
 *   NIU_ACTION_SECRET  a second, different random string — signs the Yes/Can't
 *                      tokens. Different from NIU_PUSH_SECRET on purpose: a
 *                      leak of one must not also forge the other.
 *   NIU_CONTACT_EMAIL  an address a push service can complain to
 */

import * as webpush from 'jsr:@negrel/webpush@0.5.0'
import { decodeBase64Url, encodeBase64Url } from 'jsr:@std/encoding@1.0.11/base64url'
import { createClient } from 'npm:@supabase/supabase-js@2'

/* -------------------------------------------------------------------------- */
/* Setup, done once per cold start rather than per notification                */
/* -------------------------------------------------------------------------- */

const vapidJson = Deno.env.get('NIU_VAPID_KEYS') ?? ''
const sharedSecret = Deno.env.get('NIU_PUSH_SECRET') ?? ''
const actionSecret = Deno.env.get('NIU_ACTION_SECRET') ?? ''
const contactEmail = Deno.env.get('NIU_CONTACT_EMAIL') ?? 'admin@example.com'
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''

const supabase = createClient(
  supabaseUrl,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
)

/**
 * The application server, built lazily and kept for the life of the instance.
 *
 * Importing the keys is a handful of milliseconds, but a cold start already
 * costs more than the push itself, so there is no reason to pay it twice.
 */
let appServerPromise: Promise<webpush.ApplicationServer> | null = null

function applicationServer(): Promise<webpush.ApplicationServer> {
  appServerPromise ??= (async () => {
    const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidJson), {
      extractable: false,
    })
    return await webpush.ApplicationServer.new({
      contactInformation: `mailto:${contactEmail}`,
      vapidKeys,
    })
  })()
  return appServerPromise
}

/* -------------------------------------------------------------------------- */
/* The Yes / Can't token                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A day. Long enough that a question asked in the morning is still answerable
 * from the notification shade that evening; short enough that a screenshot of
 * an old notification is not a standing invitation to answer for somebody.
 */
const ACTION_TOKEN_TTL_SECONDS = 24 * 60 * 60

let actionKeyPromise: Promise<CryptoKey> | null = null

function actionKey(): Promise<CryptoKey> {
  actionKeyPromise ??= crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(actionSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  return actionKeyPromise
}

/** `eventId.recipient.expiry.signature` — everything before the last dot is signed. */
async function signAction(eventId: string, recipient: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + ACTION_TOKEN_TTL_SECONDS
  const payload = `${eventId}.${recipient}.${expires}`
  const signature = await crypto.subtle.sign(
    'HMAC',
    await actionKey(),
    new TextEncoder().encode(payload),
  )
  return `${payload}.${encodeBase64Url(signature)}`
}

/** Null for anything wrong with the token: bad shape, bad signature, expired. */
async function verifyAction(
  token: string,
): Promise<{ eventId: string; recipient: string } | null> {
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [eventId, recipient, expiresText, signatureB64] = parts
  const expires = Number(expiresText)
  if (!eventId || !recipient || !Number.isFinite(expires)) return null
  if (expires < Math.floor(Date.now() / 1000)) return null

  const payload = `${eventId}.${recipient}.${expiresText}`
  let signature: Uint8Array
  try {
    signature = decodeBase64Url(signatureB64 ?? '')
  } catch {
    return null
  }

  const valid = await crypto.subtle.verify(
    'HMAC',
    await actionKey(),
    signature.buffer as ArrayBuffer,
    new TextEncoder().encode(payload),
  )
  return valid ? { eventId, recipient } : null
}

/* -------------------------------------------------------------------------- */
/* What the notification says                                                  */
/* -------------------------------------------------------------------------- */

interface EventRow {
  title: string
  starts_on: string
  start_time: string | null
}

/**
 * "Thu 3 Sep · 18:00", or just the day when there is no time.
 *
 * The date is deliberately formatted in UTC. `starts_on` is a plain date, not
 * an instant (see the long note in 0012_calendar.sql), so parsing it as
 * midnight UTC and printing it as UTC is what keeps the 3rd of September the
 * 3rd of September. Reading it in the server's local zone is how a date becomes
 * the day before.
 */
function whenText(event: EventRow): string {
  const day = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${event.starts_on}T00:00:00Z`))

  if (!event.start_time) return day
  return `${day} · ${event.start_time.slice(0, 5)}`
}

/** What the phone will draw. Kept to the two lines Android actually shows. */
interface Message {
  title: string
  body: string
  /**
   * Replaces an earlier notification about the same event instead of stacking
   * a second one under it. Asked twice because the time moved, you want the
   * new question, not both.
   */
  tag: string
  /**
   * Present only on an "ask". The service worker draws Yes / Can't buttons
   * when this is set, and posts straight to confirmUrl rather than opening
   * the app — see the long note at the top of this file.
   */
  action?: { confirmUrl: string; token: string }
}

/* -------------------------------------------------------------------------- */
/* The trigger route — POST /, called by Postgres                              */
/* -------------------------------------------------------------------------- */

interface TriggerPayload {
  kind: 'ask' | 'answer'
  event_id: string
  recipient: string
  actor: string
}

function ok(note: string): Response {
  return new Response(JSON.stringify({ note }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handleTrigger(request: Request): Promise<Response> {
  // Constant-time would be better form, but this is a header on a call only
  // Postgres makes, over TLS, a handful of times a day.
  if (sharedSecret === '' || request.headers.get('x-niu-secret') !== sharedSecret) {
    return new Response('no', { status: 401 })
  }

  let payload: TriggerPayload
  try {
    payload = await request.json()
  } catch {
    return ok('unreadable body')
  }

  const { kind, event_id: eventId, recipient, actor } = payload
  if (!eventId || !recipient || (kind !== 'ask' && kind !== 'answer')) {
    return ok('nothing to send')
  }

  // Everything the person reads, read from the database rather than trusted.
  const [{ data: event }, { data: actorRow }, { data: subs }] = await Promise.all([
    supabase
      .from('events')
      .select('title, starts_on, start_time')
      .eq('id', eventId)
      .maybeSingle(),
    supabase
      .from('household_members')
      .select('display_name')
      .eq('user_id', actor)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipient),
  ])

  if (!event) return ok('event is gone')
  if (!subs || subs.length === 0) return ok('nobody subscribed')

  const who = actorRow?.display_name?.trim() || 'Someone'
  const when = whenText(event as EventRow)

  let message: Message
  if (kind === 'ask') {
    message = {
      title: event.title,
      body: `${when} · ${who} is asking you to confirm`,
      tag: `ask-${eventId}`,
      action:
        actionSecret === ''
          ? undefined
          : {
              confirmUrl: `${supabaseUrl}/functions/v1/niu-push/confirm`,
              token: await signAction(eventId, recipient),
            },
    }
  } else {
    // The answer itself is read here too, so a stale or forged call cannot
    // claim a yes that was never given.
    const { data: confirmation } = await supabase
      .from('event_confirmations')
      .select('answer')
      .eq('event_id', eventId)
      .eq('user_id', actor)
      .maybeSingle()

    if (!confirmation?.answer) return ok('no answer to report')

    message = {
      title: event.title,
      body: confirmation.answer === 'yes' ? `${who} said yes` : `${who} can't`,
      tag: `answer-${eventId}`,
    }
  }

  const server = await applicationServer()
  const text = JSON.stringify(message)
  const gone: string[] = []
  let sent = 0

  await Promise.all(
    subs.map(async (row) => {
      const subscriber = server.subscribe({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      })

      try {
        // Urgency high so Android does not hold it until the phone wakes: the
        // whole point is that it arrives while the answer still matters.
        await subscriber.pushTextMessage(text, { urgency: webpush.Urgency.High })
        sent += 1
      } catch (error) {
        // 410 Gone, and 404, mean the browser threw this subscription away —
        // app uninstalled, notifications revoked, data cleared. Keeping the row
        // would mean failing forever, so it goes.
        const status = error instanceof webpush.PushMessageError ? error.response.status : 0
        if (status === 404 || status === 410) {
          gone.push(row.endpoint)
        } else {
          console.error('push failed', row.endpoint.slice(-12), String(error))
        }
      }
    }),
  )

  if (gone.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', gone)
  }

  return ok(`sent ${sent}, dropped ${gone.length}`)
}

/* -------------------------------------------------------------------------- */
/* The confirm route — POST /confirm, called by the service worker             */
/* -------------------------------------------------------------------------- */

interface ConfirmPayload {
  token: string
  answer: 'yes' | 'no'
}

/**
 * Where a phone is allowed to call /confirm from. Everywhere else this project
 * hardcodes these same two origins already — the Google Calendar setup in
 * docs/SUPABASE_SETUP.md needs them as "Authorized JavaScript origins" for
 * exactly the same reason: a browser has to be told a cross-origin call is
 * expected, or it refuses to make it.
 *
 * This is the piece the trigger route never needed. Postgres calling this
 * function is a server talking to a server — CORS is a browser rule and does
 * not apply. A phone's service worker calling /confirm *is* a browser, so
 * without this, every tap of Yes or Can't fails before the request even
 * leaves the phone, silently, which is indistinguishable from no signal at
 * all — and falls back to opening the app, exactly as if it were offline.
 */
const ALLOWED_ORIGINS = new Set(['https://marxal.github.io', 'http://localhost:5173'])

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') ?? ''
  if (!ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

/**
 * Applies a Yes/Can't tapped straight off a notification.
 *
 * The write is the same one src/lib/calendar.svelte.ts's answerConfirmation()
 * makes from inside the app — same table, same columns — so it fires the same
 * `event_confirmations_notify_answer` trigger, which is what tells the other
 * phone. This route does not need to send that notification itself; the
 * database already does.
 */
async function handleConfirm(request: Request): Promise<Response> {
  const cors = corsHeaders(request)

  if (request.method === 'OPTIONS') {
    // The browser's preflight check, sent before the real POST because the
    // request carries a JSON content type. No body, just the permission slip.
    return new Response(null, { status: 204, headers: cors })
  }

  let payload: ConfirmPayload
  try {
    payload = await request.json()
  } catch {
    return new Response('bad request', { status: 400, headers: cors })
  }

  if (payload.answer !== 'yes' && payload.answer !== 'no') {
    return new Response('bad answer', { status: 400, headers: cors })
  }

  const proof = await verifyAction(payload.token)
  if (!proof) {
    return new Response('expired or invalid', { status: 401, headers: cors })
  }

  // Belt and braces: even a validly signed token only does anything if a real
  // confirmation row is still waiting on this person for this event. Protects
  // against a token outliving an "unask", or an event that was deleted.
  const { data: row } = await supabase
    .from('event_confirmations')
    .select('event_id')
    .eq('event_id', proof.eventId)
    .eq('user_id', proof.recipient)
    .maybeSingle()

  if (!row) {
    return new Response('nothing waiting on you', { status: 410, headers: cors })
  }

  const [{ error }, { data: event }] = await Promise.all([
    supabase
      .from('event_confirmations')
      .update({ answer: payload.answer, answered_at: new Date().toISOString() })
      .eq('event_id', proof.eventId)
      .eq('user_id', proof.recipient),
    supabase
      .from('events')
      .select('title, starts_on, start_time')
      .eq('id', proof.eventId)
      .maybeSingle(),
  ])

  if (error) {
    return new Response('could not save', { status: 500, headers: cors })
  }

  // What the service worker shows as its own "you answered" notification, so
  // tapping Yes has visible proof of working without ever opening the app.
  return new Response(
    JSON.stringify({
      title: event?.title ?? 'Event',
      when: event ? whenText(event as EventRow) : '',
    }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
  )
}

/* -------------------------------------------------------------------------- */

Deno.serve((request) => {
  const path = new URL(request.url).pathname
  if (path.endsWith('/confirm')) return handleConfirm(request)
  return handleTrigger(request)
})
