# Niu — roadmap

One entry per round: what changed, what it looks like, how to test it.

---

## Round 1 — The skeleton

**Branch:** `claude/vite-svelte-pwa-skeleton-g39cik`

### What changed

The empty repo became a running, installable app with nothing in it yet.

- **Project set up:** Vite + TypeScript (`strict`) + Svelte 5 in runes-only mode, plain
  SPA, no SvelteKit. The Svelte compiler is configured to *reject* Svelte 4 patterns, so
  an old-style snippet can't sneak in unnoticed.
- **Installable:** a web app manifest, four generated PNG icons (including a maskable one
  for Android's round/squircle launchers) and a service worker. The worker caches
  **nothing** — offline support is still deferred. It exists only because Chrome won't
  offer "Install app" without one.
- **Navigation:** a bottom bar with three tabs — Compra, Menús, Calendari — plus a
  Settings icon in the top right. Each screen is an empty state describing what will live
  there. Tabs are real links, so Android's back button walks back through them.
- **Design tokens:** `src/styles/tokens.css` — colours, spacing, radius, type, motion,
  touch sizes. Light and dark. This is the first pass, up for reaction.
- **Deploy:** a GitHub Action builds and publishes to GitHub Pages on every push to
  `main`, after type checks and unit tests pass.

### What it looks like

Warm off-white paper, clay-orange accent, system rounded type. Each tab has its own quiet
tint: clay for shopping, sage for meals, blue-grey for the calendar. Dark mode is a warm
near-black, not a cold grey. Header on top, one scrolling area in the middle, nav pinned
to the bottom above the gesture bar.

### How to test it

Open `https://marxal.github.io/niu/` on the phone, install it from the Chrome menu, and
check the three tabs and the Settings icon.

### Deliberately not done

Supabase, Google sign-in, any real data, offline caching, notifications.

### Next up

Google sign-in + the households table with its RLS policy.

---

## Round 1.1 — Fix: stop hard-coding the repo name in the URL

**Branch:** `claude/vite-svelte-pwa-skeleton-g39cik`

### What went wrong

Round 1 built the site with `base: '/niu-/'`, because that was the repo name. The repo was
then renamed to `niu`, and the published page went looking for its JavaScript and CSS at
`/niu-/assets/…` — a path that no longer exists. Every asset 404'd, so the page came up
white.

### The fix

`base: './'`. Every URL in the built site is now relative to the folder it's served from,
so the app works at `/niu/`, at any other repo name, at a custom domain later, or from a
different folder entirely — with nothing to keep in sync. Verified by serving the same
build from two differently-named folders and checking that the assets, the icons, the
service worker scope and all four screens come up clean in both.

Also dropped the `id` field from the manifest, which was the other place the old repo name
was written down. With no `id`, the spec says the app's identity is its `start_url`, which
is already relative.

**One consequence:** the app's identity changed, so if Niu was already on the home screen
it's now a different app to Chrome. Remove the old icon and install it again.

---

## Round 1.2 — Fix: interface into English

**Branch:** `claude/vite-svelte-pwa-skeleton-g39cik`

### What went wrong

Round 1 was written in Catalan on a guess, without checking. It also hand-typed the
strings inline in five different components, so changing the language meant editing every
one of those files a second time.

### The fix

Pulled every piece of user-facing text into one file, `src/lib/strings.ts`, and wrote it
in English. Every component now reads its copy from there — none of them hard-code text
any more. `index.html`'s `lang` attribute and the manifest's `lang` field were updated to
match.

This also sets up whatever comes next on language: if Niu ever needs Catalan too, this
file is what becomes `en.ts` sitting next to a `ca.ts` with the same keys. Right now
there's no switching mechanism, just the one file.

### How to test it

Reload the installed app (see the note on updates in the round 1 message) — every screen,
the nav labels, and Settings should now read in English.

---

## Round 2 — Google sign-in and the household

**Branch:** `claude/vite-svelte-pwa-skeleton-g39cik`

### What changed

Niu has a backend and knows who you are.

- **Google sign-in.** The app now sits behind a sign-in screen. Signing out lives
  in Settings, next to the account you're signed in as.
- **Households, with Row Level Security.** Two tables — `households` and
  `household_members` — and the policies that mean a member can only ever read
  their own household. `supabase/migrations/0001_households.sql`.
- **You get a home on first sign-in.** A database function, `ensure_household()`,
  creates one the first time you sign in and hands back the existing one every
  time after, so two devices signing in at once can't leave you with two homes.
- **A guard against the wrong key.** The build refuses to start if the key in the
  bundle looks like a Supabase `service_role` key, which would bypass every
  policy above. Unit tested.

### Two decisions worth knowing about

**PKCE, not the default flow.** Supabase's OAuth defaults to the implicit flow,
which returns the session in the URL hash (`#access_token=…`). Niu routes on the
hash, so that would have landed on top of the router and opened the app on a
junk route. PKCE returns `?code=…` in the query string instead and cleans it up
itself, leaving the hash alone.

**The app still works with no backend.** If the Supabase settings are missing,
the app skips sign-in and behaves exactly as it did in round 1, with Settings
explaining why. `main` deploys automatically, so this round had to be able to
land before the Supabase project existed without turning the live site blank.

### Deliberately not done

Inviting a second person, and any actual shopping/meal/calendar data. The tables
have no insert or delete policies yet — no policy means no access, which is the
safe direction to be wrong in. Those arrive with the invite flow.

### Next up

The shopping list: its table, its RLS policy, and realtime so both phones stay
in sync.
