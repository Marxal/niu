# Niu — guide for Claude Code

Read this before touching anything. Before starting any round, read NIU.md in full. It's the complete product spec — every feature decision, the data model, the design direction, the roadmap. This file (CLAUDE.md) is only the technical contract: stack, hard rules, how we work together. If a question comes up about what the app should do, the answer is almost always already in NIU.md. Check there before asking.

## What Niu is

A family organiser PWA for one household: a shopping list, a meal planner and a shared
calendar. Phone-first, Android, installable. Zero budget. Built for Marçal and his wife;
built so it could become a product one day.

Full product context lives in `NIU.md` in the Claude Project. This file is the working
contract for the repo.

## Who you're working with

Marçal is a designer and WordPress developer. **He does not write code and does not want
to.** He understands concepts, not syntax. He directs, you build and explain, he tests on
his phone.

- Lead with the answer, then brief reasoning. No preamble.
- Explain trade-offs briefly as you go — teach, don't lecture.
- **End every round with an explicit "how to test this on your phone" step.**
- Flag uncertainty. **Never invent a library API.** If you're not sure, look it up or say so.
- Push back on scope creep. He asked for that.
- **Never add a paid service, or anything that could become paid, without asking first.**

## Stack — do not change without asking

| | |
|---|---|
| Build | Vite + TypeScript, `strict: true` |
| Framework | **Svelte 5**, plain SPA. No SvelteKit |
| Styling | Scoped CSS in each component + one token file. **No CSS framework** |
| Backend | Supabase — Postgres, Auth, Realtime, Row Level Security |
| Auth | Google sign-in only |
| Hosting | GitHub Pages, deployed from `main` by a GitHub Action |
| State | Server-first. Supabase is the source of truth. No offline layer yet |

### Svelte 5 specifically

Write **runes only**: `$state`, `$derived`, `$effect`, `$props`.

Do **not** write Svelte 4 patterns — no `export let` for props, no `$:` reactive
statements, no `writable()` stores for component state. If a snippet you're recalling
uses those, it's the old API; convert it.

## Hard rules

1. **Row Level Security on every table, always.** The database enforces that a member can
   only read and write rows belonging to their own household. The app is never the thing
   keeping data separate. New table means new RLS policy, in the same commit.
2. **No secrets in the bundle.** Anything prefixed `VITE_` is compiled into public
   JavaScript and is public by definition. The Supabase anon key and the Google OAuth
   client ID belong there — they're designed to be public. Nothing else does. There is no
   service role key in this project.
3. **Storage keys are permanent.** Everything device-local is prefixed `niu.`. The name
   may change one day; these keys never do. Renaming them orphans real data.
4. **Design tokens only.** No raw hex, no magic pixel values in a component. Everything
   resolves to a variable in the token file, including the spacing scale.
5. **Fail soft.** A failed network call returns null and degrades the UI. It never throws
   at the user and it never shows a stack trace.
6. **Small, focused files.** When a file grows past its job, split it. This keeps token
   cost down for every future round.
7. **Every screen is designed for a thumb.** 412×915 is the reference viewport. Touch
   targets are generous. Test at that size.
8. **Testing Google sign-in on a phone over LAN needs a hostname, never a raw
   IP — Supabase's Auth server hard-rejects IP-address redirects, full stop.**
   Confirmed straight from `supabase/auth` source
   (`internal/utilities/request.go`, `IsRedirectURLValid`): if the redirect
   URL's host parses as an IP address, it returns `ip.IsLoopback()` —
   `127.0.0.1` only — *before* the dashboard's Redirect URLs allow-list is
   even consulted. No allow-list entry, wildcarded or exact, can make
   `http://192.168.x.x:5173/…` valid. Don't re-litigate this with more IP
   wildcards; it cannot work. `localhost` works only because it's a hostname
   string, not something `net.ParseIP` recognizes.

   The fix is to give the phone a *hostname*. This Mac already has one for
   free over Bonjour/mDNS — check it with `scutil --get LocalHostName` (it
   was `iMac-de-Marcal` → `iMac-de-Marcal.local`) — which iOS and most
   Android phones resolve on the same wifi with no setup. Two one-time
   changes:
   1. **Vite** blocks unrecognized `Host:` headers by default (a separate,
      unrelated DNS-rebinding guard) — `vite.config.ts`'s
      `server.allowedHosts: ['.local']` (already set here) fixes that; the
      leading dot matches any `*.local` name, so it survives this app moving
      to a different Mac.
   2. **Supabase dashboard → this project ("Niuapp", ref
      `qrokiaztsbmevrdqaeih`) → Authentication → URL Configuration → Redirect
      URLs** — add `http://iMac-de-Marcal.local:*/**` (delete the old
      `192.168.*` entries; they're dead weight, never valid). This one entry
      covers **both** apps sharing this project — pensar included — every
      future dev session, on any port. Open the app on the phone as
      `http://iMac-de-Marcal.local:5173/…`, not the IP. Google itself needs no
      change: the redirect URI it sees is always this project's fixed HTTPS
      callback, never the phone's address.
   **The separate "Connect Google Calendar" feature (`google.svelte.ts`) is
   NOT covered by this fix and can't be** — it talks to Google Identity
   Services directly with its own OAuth client, and Google Cloud Console's
   "Authorized JavaScript origins" flatly rejects any origin that isn't
   `https` or `http://localhost` — no wildcards, no LAN IPs, no exceptions.
   Test that one feature from a desktop browser at `localhost`, or don't test
   it on a phone at all short of an HTTPS tunnel.
9. **Schema changes are migration files via the Supabase CLI — never the SQL editor.**
   A new file in `supabase/migrations/`, then `supabase db push` from a real terminal
   (this has to be Marçal — Claude Code's sandboxed shell can't reach the CLI's login
   session, and the DB password shouldn't pass through it anyway). This project shares
   its Supabase project with `pensar` (Marçal's personal task app, its tables prefixed
   `pensar_`) via the same project ref. The migration-history table lives once in that
   shared database, so **every migration file, from either app, must exist in both
   repos' `supabase/migrations/` folders** — otherwise `db push` / `migration list`
   error about remote versions missing locally. Claude mirrors the file into the other
   repo automatically; just say which app the change is for.

## Conventions

- **A "why" comment at the top of every module** explaining what it's for and what's
  tricky about it. These are the real documentation. Update them when behaviour changes.
- **Split pure logic from the DOM.** Anything that's a calculation — the suggestion
  ranking, the shop-order learning, the stock inference, any date parsing — goes in its
  own module with no Svelte and no Supabase in it, and gets a matching `*.test.ts`.
  Everything else is tested by Marçal, on his phone.
- **One round, one branch, one entry in `ROADMAP.md`.** Record what changed, what it
  looks like, and how to test it, before you finish.
- **Confirm scope before starting.** If a request has grown mid-round, say so and ask.
- Commit and push to the round's branch. `main` deploys automatically.

## Things that are deliberately NOT here

Don't add them without being asked:

- Offline support / service worker caching (deferred, see `NIU.md` §9)
- More push notifications. **Push itself shipped in round 17** — a `push` handler
  in `public/sw.js`, a VAPID pair, and one Edge Function. It buzzes for exactly
  two things: a confirmation request, and the answer to one. Adding a third
  trigger is now easy and is therefore the thing to ask about first; the fastest
  way to get notifications switched off is to send one nobody needed.
- Photos, a desktop layout, cooking instructions, prices, barcode scanning
- Any analytics
- Any CSS framework, component library or icon npm package
- Reading other Google calendars — Niu pushes to one shared calendar, one way

## How a round ends

1. It builds clean (`npm run build`, no type errors).
2. `ROADMAP.md` has an entry.
3. Your final message says, in plain language: what changed, anything you were unsure
   about, and **exactly what Marçal should tap on his phone to check it works**.
