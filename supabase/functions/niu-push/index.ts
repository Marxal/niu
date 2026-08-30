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
 * ## The service role key never leaves this file's runtime
 *
 * Supabase injects it as an environment variable. It bypasses every RLS policy,
 * which is exactly why nothing in `src/` may ever see it. Read the two rows we
 * need and nothing else.
 *
 * ## Failure is silence, never an error at the user
 *
 * pg_net queued this call and stopped caring, so an exception here reaches
 * nobody. Every path returns 200 with a short note in the body, so the function
 * log reads as a history rather than a stack trace. A notification that does
 * not arrive is a notification that does not arrive: the event is already saved
 * and the in-app badge from round 11 still shows the question.
 *
 * ## Deploying it
 *
 * Supabase dashboard -> Edge Functions -> Deploy a new function, named
 * `niu-push`. Paste this file. Turn **Verify JWT off** — the caller is
 * Postgres, which has no user session; the `x-niu-secret` header below is what
 * authenticates it instead. Then set three secrets:
 *
 *   NIU_VAPID_KEYS     the whole contents of vapid-keys.local, as one line
 *   NIU_PUSH_SECRET    the same random string as push_config.shared_secret
 *   NIU_CONTACT_EMAIL  an address a push service can complain to
 */

import * as webpush from 'jsr:@negrel/webpush@0.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

/* -------------------------------------------------------------------------- */
/* Setup, done once per cold start rather than per notification                */
/* -------------------------------------------------------------------------- */

const vapidJson = Deno.env.get('NIU_VAPID_KEYS') ?? ''
const sharedSecret = Deno.env.get('NIU_PUSH_SECRET') ?? ''
const contactEmail = Deno.env.get('NIU_CONTACT_EMAIL') ?? 'admin@example.com'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
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
}

/* -------------------------------------------------------------------------- */
/* The request                                                                 */
/* -------------------------------------------------------------------------- */

interface Payload {
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

Deno.serve(async (request) => {
  // Constant-time would be better form, but this is a header on a call only
  // Postgres makes, over TLS, a handful of times a day.
  if (sharedSecret === '' || request.headers.get('x-niu-secret') !== sharedSecret) {
    return new Response('no', { status: 401 })
  }

  let payload: Payload
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
})
