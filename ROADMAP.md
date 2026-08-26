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

---

## Round 2.1 — Fix: Google sign-in redirecting to the wrong place

**Branch:** `claude/vite-svelte-pwa-skeleton-g39cik`

### What went wrong

Signing in redirected to `http://localhost:3000/?code=…`, which the phone can't
connect to — Supabase's default fallback address, not Niu's.

The cause was in `authRedirectTo()`: it resolved the app's relative base path
(`'./'`) against `window.location.origin`. An origin has no path on it
(`https://marxal.github.io`, nothing after the domain), so `new URL('./',
origin)` collapsed straight to the domain root and silently dropped the `/niu/`
folder the app is actually served from. Supabase received a redirect address
that didn't match anything on its allow-list, and fell back to its own default.

### The fix

Resolve against `window.location.href` (the full current address) instead of
just the origin. Pulled the URL math into its own module, `src/lib/url.ts`, with
a unit test that pins the exact regression down — this bug only shows up once
the app is served from a sub-folder, which nothing in local development does,
so it's the kind of thing that's easy to reintroduce without a test catching it.

### One thing to check in Supabase

If sign-in still lands on `localhost:3000` after this deploys, the fix isn't
enough on its own — it also needs, under **Authentication → URL Configuration**
in the Supabase dashboard:
- **Site URL** set to `https://marxal.github.io/niu/`
- **Redirect URLs** including that same address

Supabase falls back to the Site URL whenever the address the app sends doesn't
match the allow-list, and a fresh project's Site URL defaults to
`localhost:3000` — which is exactly what was seen.

---

## Round 3 — The shopping list

**Branch:** `claude/vite-svelte-pwa-skeleton-g39cik`

### What changed

The first real feature. One list, shared by the household, live on both phones.

- **A catalogue of 361 grocery tiles**, grouped into 10 supermarket categories.
  You tap a tile and it moves to the list — you almost never type.
- **Tapping something already on the list does nothing**, per NIU.md §4.1. That
  rule is enforced by a unique index in the database, not just by the UI, so two
  phones tapping at the same moment still can't produce two rows.
- **Typing a new word adds it immediately**, with a generated first-letter tile
  as its icon, and puts it on the list in the same action.
- **Ticking off** greys the tile and drops it into "In the trolley" below, with
  a Clear button to empty it.
- **Quantity, unit, note and urgency** are an optional edit afterwards — never a
  step in adding. Press and hold a tile to reach them.
- **Urgent items float to the top** of whatever sort order is in play.
- **A NEW tag** on items the other person added, so you can see what changed
  without a notification.
- **Live sync** over Supabase realtime: add something on one phone and it
  appears on the other.
- Sort switches between shop order, most recently added, and by category.

### On the shop order

NIU.md §4.1 wants the default order *learned* from the order things get ticked
off, per shop. That can't do anything until there's tick history to learn from,
so this round ships the hand-picked category order it starts from, and records
`checked_by` and `checked_at` on every tick from day one — that's the raw
material the learned order will need. `sortItems()` already takes the mode as an
argument, so the learned order slots in beside the others rather than replacing
anything.

### How the security was checked

The Row Level Security policies were run against a real PostgreSQL 16, not just
read over. Two households were created and, as the second one, every crossing
attempt was tried: reading the other's list, inserting into it, ticking their
items off, deleting them, adding a word to the shared catalogue everyone sees,
and forging `added_by` to look like someone else. All were refused, and the
first household's list was verified intact afterwards. The "can't add twice"
rule and the quantity constraint were tested the same way, and all three
migration files were run twice to confirm they're safe to re-run.

### Deliberately not done

Multiple shops each learning their own order, the "you usually need…" suggestion
strip, and dishes appearing in the catalogue — the last of those depends on the
meal planner (§4.2), which doesn't exist yet. All three need either real usage
data or a feature that isn't built.

### Next up

Either the meal planner, or inviting your wife so the sharing is real rather
than theoretical.

---

## Round 4 — The Bring!-style redesign

**Branch:** `claude/vite-svelte-pwa-skeleton-g39cik`

### What changed

The shopping tab was rebuilt around the reference app's shape.

- **Line-art icons, one colour.** 69 hand-drawn outline icons replace the emoji.
  Everything takes the tile's colour, so a grid reads as one set. About 95% of
  the 361 items have a drawing; the rest show their **outlined initial**, drawn
  in the same weight and colour so it looks deliberate rather than missing.
- **No more "Add items" button.** The catalogue sits directly under the list, so
  adding never leaves the screen. The search field took the button's place,
  pinned above the nav where a thumb reaches.
- **Categories are collapsible and closed by default.** Ten open categories over
  360 items would bury the list itself.
- **The first tiles you see are learned.** A new `catalogue_usage` table counts
  how often each household puts each item on the list, and the top row is
  ordered by it. Before there's any history it falls back to a hand-picked order
  of ~20 things nearly everyone buys, so the row is useful on day one.
- **Press and hold a catalogue tile to remove it for good**, with a confirmation.
- **Grid animations.** Adding or ticking something scales it in or out in place
  while the neighbours glide to their new cells (FLIP), so the grid visibly
  rearranges rather than items sliding up and down a list.
- **An illustration on the empty state** — a line-drawn basket, same language as
  the icons.
- **Light / dark / match-phone selector** in Settings.

### On "remove for good"

It's a hide, not a delete, and that is deliberate. Most of the catalogue is the
shared seed that belongs to no household — one household deleting `anchovies`
must not remove it for everyone else, and the policies rightly forbid that. A
per-household `catalogue_hidden` row is the only thing that can mean "gone, for
us". It also destroys nothing, so unhiding later is possible.

### How it was checked

The four migrations were run in order against a real PostgreSQL 16, then run
again to confirm they're re-runnable. As a second household, every crossing
attempt was refused: hiding a tile in someone else's household, forging
`hidden_by`, and writing an arbitrary number into the usage counter (there is no
insert policy — the counting function is the only writer). Hiding milk for one
household was confirmed to leave it visible for the other.

The UI was driven in a real Chromium at 412×915 in both themes: category rows
closed by default, opening one, search replacing the categories, the new-word
Add button, long-press opening the remove dialog, the theme selector actually
switching `data-theme`, and the empty state. Zero console errors.

### Known rough edge

A handful of the 69 icons are more abstract than others at 28px — `croissant`,
`meat` and `shrimp` in particular lean on the label underneath. Every tile shows
its name, so nothing is unidentifiable, but they're worth another pass.

### Next up

The meal planner, or inviting a second person.
