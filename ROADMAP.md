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

---

## Round 5 — Trolley, colours, and two display preferences

**Branch:** `claude/vite-svelte-pwa-skeleton-g39cik`

### What changed

- **The trolley is a marked temporary space.** Boxed in a dashed border, faded,
  with its own trolley icon and a line saying you can tap anything to put it
  back. While there's still something to buy the action is a quiet "Clear"; once
  the list is empty it becomes a full-width green **"Shopping done!"**.
- **Trolley order is most-recently-ticked first.** Whatever you just tapped is
  what you might have tapped by mistake, so the correction is always at the top.
- **Three tile colours**: red still to buy, green in the picker, grey in the
  trolley. Both reds and greens are muted well below full saturation.
- **An icon style preference** — Lines or Colour. Colour uses the phone's emoji
  where an item has one, desaturated with a CSS filter, and falls back to the
  line drawing otherwise.
- **The icon set grew from 69 to 88**, and coverage from 95% to **99%** — only
  two of the 361 items now fall back to a letter.
- **Long-press a catalogue tile** now opens a small menu: change its icon, or
  remove it for good. Picking an icon opens the whole set in a grid, with a way
  back to the default.
- **The search field floats** — no bar, no background, just the field with a
  shadow over a short fade to the page colour.
- **A view preference**: grid of 4 (default), grid of 3, or a single-column list.

### On going back to the coloured icons

Worth recording, because the premise turned out to be wrong. The old "coloured
pack" was not an icon set — it was emoji, rendered by the phone's own font. It
covered **136 of 361 items (37%)**, leaving 225 showing bare letters. The line
set covers 359 of 361 (99%). So the old set looked more varied because it was
multicolour, not because it had more in it.

Rather than choose, Colour mode layers the emoji *on top of* the line set: emoji
where one exists, line drawing everywhere else. That keeps 99% coverage and adds
the colour back. Saturation is pulled down with `filter: saturate(0.62)` so a
grid of them doesn't shout.

### How it was checked

All five migrations run in order against a real PostgreSQL 16 and re-run to
confirm they're idempotent. As a second household: setting an icon in someone
else's household and forging `set_by` were both refused, my icon choice was
invisible to them, and the shared catalogue row was untouched.

Every view mode and both icon styles were rendered in a real Chromium at
412×915, plus the all-ticked state to confirm "Shopping done!" only appears once
nothing is left to buy, and that the trolley really does order most-recent-first.

### Next up

Inviting a second Google account into the household — currently every account
gets its own, which is why syncing only works within one account.

---

## Round 6 — Sync the whole shop, and a simpler item form

**Branch:** `claude/shopping-sync-form-fixes-e164qi`

> A note on numbering, because two counts have drifted apart. This file counts
> **build rounds**; `NIU.md` §10 counts **feature rounds**, and it said the
> shopping list would take "two or three rounds". It took four: build rounds 3–6
> are all feature round 3. Round 7 below is where feature round 4 starts.

### What changed

Five fixes, all found by using the thing on a phone.

- **Clearing the trolley now reaches the other phone.** Adding and ticking off
  always synced; emptying never did. Diagnosis and fix below — it was a database
  setting, not app code.
- **A missed sync now heals itself.** The list is re-read whenever the app comes
  back to the foreground, and after any reconnection. Android suspends the
  websocket when the screen goes off, so a phone in a pocket misses everything
  that happens meanwhile and had no way to find out.
- **The item form is three controls.** How many (with − and + buttons), two
  tags, a note. **The unit field is gone.**
- **Quantity shows on the tile**, as a `×3` pill. It never did before — the old
  form bound a text field to `<input type="number">`, which Svelte coerces to a
  number, and the save path then called `.trim()` on it and threw. So typing a
  quantity looked like it worked and saved nothing.
- **A long note can't stretch the grid any more.** It is clipped to one line with
  an ellipsis; the whole note is in the sheet.
- **The Done button clears the keyboard.**
- **A third icon style, and a celebration.** Both below.

### Why "Clear" wasn't syncing

Realtime subscribes with a filter — `household_id=eq.<us>` — so each phone only
receives its own household's changes. On an insert or an update the whole new row
goes into Postgres's write-ahead log, so the filter can read `household_id` off
it. On a delete there is no new row: Postgres logs only the *replica identity* of
what was deleted, which by default is the primary key and nothing else. The event
arrived carrying `{id: …}`, the filter looked for a `household_id` that wasn't
there, and dropped it. Supabase documents exactly this limitation.

`alter table list_items replica identity full` makes Postgres log the whole
deleted row. Verified rather than assumed: a logical replication slot on a real
PostgreSQL 16 shows the delete carrying no `household_id` before the change and
carrying it after.

### "If convenient", and where things sit

Urgent floats an item to the top. **If convenient** is the other end of the same
question — get it if you pass it — and sinks to the bottom. The two are mutually
exclusive: the sheet only lets you pick one, and a check constraint means that's
true of the data too, not just of the screen.

### The third icon style: Inked

`NIU.md` §6 said OpenMoji needed checking before we committed to it. Checked, and
written up in `docs/OPENMOJI.md`: CC BY-SA 4.0, credit required (it's in
Settings), share-alike only bites on *modified* icons — so we ship them
byte-for-byte as published and desaturate with a CSS filter at display time
instead. Selling Niu later stays possible. **The €15 icon budget wasn't needed.**

Coverage: all 97 emoji the catalogue uses have an OpenMoji drawing. 257 kB of
static files, none of it in the JavaScript bundle, and only the icons on screen
are ever fetched.

So Settings now offers **Lines / Emoji / Inked**, and long-pressing a tile →
Change icon opens the same three as tabs. A picture picked for one item beats the
style preference — a preference is about the whole grid, a pick is about that one
thing.

### How it was checked

All six migrations run in order against a real PostgreSQL 16 and re-run to
confirm they're idempotent. As the second household: reading, changing and
deleting the first household's rows were all refused, the new `if_convenient`
column included, and the first household's row was intact afterwards. Setting
both flags at once was refused by the database.

Every state was rendered in a real Chromium at 412×915 in both themes and all
three icon styles: quantity pills, a 90-character note, both tags, the row
layout, the detail sheet, the icon picker's three tabs and the celebration. The
sheet was measured against a simulated 320px keyboard — the Done button's bottom
edge lands 16px clear of it. Zero console errors.

### How to test it

1. Reload the app (open it, then swipe it away and open it again).
2. **Long-press anything on the list.** Press − and + a few times, tap **Urgent**,
   then tap **If convenient** — urgent should switch itself off. Type in the note.
   **The Done button should stay visible above the keyboard.**
3. Close the sheet. The tile shows `×3`, the urgent one has floated to the top and
   the "if convenient" one has sunk to the bottom.
4. Give something a very long note and check the tiles around it don't grow.
5. **Settings → Icons → Inked.** Then long-press a catalogue tile → Change icon,
   and try all three tabs.
6. **Both phones**, with the app open on each: tick everything off on one and
   press **Shopping done!** The other phone's trolley should empty within a second
   or so, and both should show the celebration.

### Known rough edge

`interactive-widget=resizes-content` is the main keyboard fix and it's Chrome on
Android. The measured fallback covers other browsers, but if you ever open Niu in
Firefox and a sheet still hides behind the keyboard, that's why.

### Next up

Feature round 4: order and learning.

---

## Round 7 — Order and learning

**Branch:** `claude/shopping-sync-form-fixes-e164qi`

This is feature round 4 in `NIU.md` §10: the round where the app starts getting
better with use rather than staying exactly as good as the day it shipped.

### What changed

- **The list sorts itself into the order you walk the shop.** Every time you
  finish a shop, Niu records roughly where in it each thing was picked up, and
  sorts the next list by that.
- **Each shop learns its own order.** Add Willys alongside ICA in Settings; a chip
  row appears at the top of the list to say which one you're in. The order you
  walk one has nothing to do with the other.
- **"You usually need…"** — a quiet strip of things that look due, based on how
  often you actually buy them. It never adds anything: every tile is a tap, like
  the picker below it.
- **Per-item statistics:** how many times each thing has been bought, when it last
  was, the time before that, and a rolling average of the gap in days. Statistics,
  not a history — there is nowhere in the schema to put a purchase record, which
  is what §5 asked for.
- **A list-order choice** in Settings: shop order (the learned one, and the
  default), recently added, by category, or most bought.

### How the learning works

Two separate mechanisms, because they answer different questions and neither
should be derived from the other — buying milk every week says nothing about
which aisle it is in.

**Where things are.** At the end of a shop, each ticked item gets a position:
`rank / (total + 1)`, a fraction of the way through the shop rather than a place
in a queue. Raw positions can't be averaged across shops of different sizes —
third out of five and third out of forty are not the same place in a supermarket.
That fraction is averaged into whatever the shop already knew, one shop at a time.

Turning those numbers into an order for a list that also contains things nobody
has ever bought is the interesting half, and it lives in `src/lib/shop-order.ts`
with 11 tests:

1. **What we know about this item** — its own learned position, trusted more the
   more shops it is based on, completely after three. One shop is an anecdote:
   you might have doubled back for the milk.
2. **What we know about its neighbours** — a first-time item inherits the average
   position of the things in its category that *have* been learned, at half
   weight. If the tinned food is at the back of this shop, a tin nobody has
   bought before is probably at the back too.
3. **The hand-picked order**, which everything falls back to and which is exactly
   what a brand-new household still sees.

Every position is blended with the seed order rather than replacing it, so the
list drifts rather than lurching.

**How often things are needed.** An item is worth mentioning when about as long
has passed as usually passes: `elapsed / average gap ≥ 0.8`, with at least two
purchases behind it. The gap is an exponentially weighted average — 70% of what
we thought, 30% of what just happened — rather than a plain mean, because habits
drift and a plain mean over a year of shops would take months to notice.
`src/lib/suggest.ts`, 12 tests.

### Two decisions worth knowing about

**The shops are shared; which one you're standing in is not.** The list of shops
belongs to the household and syncs. The current shop is device-local, because you
two can be in different shops at once and pushing that choice across would
reorder someone else's list mid-aisle.

**The app can read the numbers but cannot assert them.** Neither statistics table
has an insert or update policy. The only writer is `record_shop()`, a security
definer function that does the learning and empties the trolley in one
transaction — because the tick order exists only until those rows are deleted,
and a delete that succeeded while the learning failed would lose it for good.

### How it was checked

Every migration run in order against a real PostgreSQL 16 on a fresh database,
then re-run to confirm they're idempotent. Two shops walked in the same order
produced exactly the positions the arithmetic predicts (0.2 / 0.4 / 0.6 / 0.8),
and two walked in opposite orders averaged to a flat 0.5, which is the honest
answer. The gap average was checked against hand arithmetic: a 10-day gap from
nothing gives 10.00, then a 2-day gap gives 7.60.

As the second household, every crossing attempt was refused: reading, renaming or
deleting the first household's shops, reading their statistics, and calling
`record_shop()` against their shop. Trying to rewrite the two statistics tables
directly changed **0 rows** from the app's own role. A second "main" shop was
refused by the index.

The new screens were rendered in a real Chromium at 412×915 in both themes: the
shop chips, the suggestion strip, the four-way list-order control, the shops card
and its inline remove confirmation. Zero console errors. 80 unit tests pass.

### How to test it

**Straight away, before it has learned anything:**

1. **Settings → Shops.** There should be one called "Main shop". Add a second one
   — name it after a shop you actually use.
2. Go back to Shopping. **A row of shop chips has appeared at the top.** Tap
   between them; nothing should change yet, because neither has learned anything.
3. **Settings → List order.** Try the four options and watch the list reorder.
   Leave it on **Shop order**.

**Then the real test, which needs a real shop:**

4. Do a normal shop: tick things off **in the order you actually pick them up**,
   then press **Shopping done!**
5. Next time you shop, put the same things on the list and look at the order.
   After **three** shops in the same shop it should be walking your route.
6. Do the same in the second shop and check the two orders stay separate.

**And in a few weeks:** once something has been bought twice and enough time has
passed, **"You usually need…"** appears above the picker. It should be things you
genuinely buy on a rhythm.

### Deliberately not done

- **Renaming a shop.** Remove and add is the workaround, and it costs that shop's
  learned order, so this is worth adding if it ever comes up.
- **Stock inference** (§5) — deliberately late, and it needs months of the data
  this round has only just started collecting.
- The **"Often bought"** picker row still counts how many times something has been
  *added to the list*, which is not quite the same as how many times it has been
  *bought*. Both numbers now exist; whether the row should switch to the new one
  is a question for after some real use.

### Next up

Feature round 5: dishes — the bridge to the meal planner.

---

## Round 7.1 — Fix: the real app icon

**Branch:** `claude/shopping-sync-form-fixes-e164qi`

Marçal's own "niu" wordmark replaces the placeholder bowl-and-egg mark on the
home screen, the install prompt, and every other size Android and iOS ask for.

### What changed

- `assets/brand/app-icon-source.png` — his 1254×1254 master, kept outside
  `public/` on purpose: nothing links to it directly, and `public/` is copied
  verbatim into the deployed site, so an 800+KB source file sitting in there
  would just be dead weight every visitor downloads for nothing.
- `scripts/generate-icons.mjs` rewritten to derive the four icon files from
  that source instead of drawing shapes by formula — the wordmark is a
  photograph-like 3D render, not something a distance function can describe.
  `sharp` joined as a devDependency for exactly this script; it never ships in
  the app itself.
- The **maskable** icon needed more than a resize. Android crops it to a
  circle, and the wordmark is wide — measured against the source, its own
  corners sit at ~85% of the icon's half-width from centre, well past the
  ~40%-radius safe zone a maskable icon gets. Left alone, the ends of the *n*
  and the *u* would be cut off on a lot of phones. The script now measures the
  artwork's own bounding box and shrinks it by whatever that specific image
  needs — checked by masking the output to a circle and confirming the full
  wordmark clears it with room to spare.

### What it looks like

The three "any"-purpose sizes (192, 512, the 180 iOS wants for "Add to Home
Screen") show the wordmark close to full size, matching the source's own
generous margins. The maskable one is visibly smaller within its square — that
is what a maskable icon is supposed to look like unmasked; the safe zone really
is a small centered region, and Android's own icons look the same way before
the launcher's shape is applied.

### Known inconsistency, not touched

Two other places still carry the old bowl-and-egg mark, and this round left
them alone deliberately — swapping the *symbol* for the *wordmark* in-app is a
different decision than fixing the install icon, and touches colour choices
this round wasn't asked to make:

- `public/favicon.svg` — the browser-tab icon, hand-drawn to match the old mark
- `src/components/NestMark.svelte` — shown at the top of the sign-in screen

Both are still the clay-orange bowl. Worth a decision, not an assumption:
should the sign-in screen and browser tab move to the wordmark too, and if so,
on its own dark-green identity or recoloured to the app's existing clay accent?

### How to test it

Reload the app once this deploys, remove the old Niu icon from your home
screen (its artwork changed, but its identity — see round 1.1 — didn't, so
Android will treat "update" and "reinstall" differently depending on how it
cached the old one; removing and reinstalling is the reliable path), and
install it again from **Settings → Install Niu**. Check it at the size it
actually shows on your home screen, not just this file.

### Next up

Feature round 5: dishes — the bridge to the meal planner.

---

## Round 8 — Dishes

**Branch:** `claude/round-5-dishes-8fh855`

This is feature round 5 in `NIU.md` §10, and the first round that touches the
Meals tab. It builds the dish itself and the shopping half of what a dish does;
the week it gets planned into is the next round.

### What changed

- **The Meals tab is now the dish library.** Write down what you cook: a name, a
  picture, which part of a meal it is, how much cooking it takes, and — if you
  want — the things it's made of.
- **Dishes appear in the shopping catalogue as their own category**, first in
  the list, drawn as exactly the same green tiles as everything else. Tapping
  one puts all of its ingredients on the list at once (§4.1).
- **Searching the shopping list finds dishes too**, in their own block above the
  grocery matches — because tapping a dish does something different from tapping
  a tomato, and the two shouldn't be mixed into one grid.
- **A short message says what happened** after tapping a dish: how many things
  went on, or that it was all there already, or that the dish has no ingredients
  yet. Without it, tapping a dish whose ingredients you already have looks
  exactly like tapping nothing.
- **The ingredient picker inside a dish** is the shopping picker in miniature:
  green rows to add, red rows already in, the same search, and "often bought"
  when you haven't typed anything.

### A dish with no ingredients is a real dish

§4.2 says so, and it is the one rule everything here had to stay true to: "If
the item list is empty, the dish is just a name you can plan a meal with."
"Eating out" and "leftovers" are dishes. So nothing requires an ingredient list,
the library shows such a dish as *just a name* rather than as an error, and
tapping one on the shopping tab says so plainly instead of silently doing
nothing.

### Two decisions worth knowing about

**Four cooking flags became one question with three answers.** §4.2 lists *needs
cooking, fast cook, slow cook, no cook* — but "needs cooking" is exactly "fast
or slow", so as four checkboxes three of the sixteen combinations are
contradictions. It is stored as one value: No cook / Quick / Slow. If a
genuinely independent flag ever turns up (oven-only, freezer) it gets its own
column rather than being squeezed into this one.

**The dish editor has a Save button, and the item sheet still doesn't.** That
looks inconsistent, and it is deliberate. A list item's fields are independent
and instantly valid, so saving as you type is strictly better. A dish is
neither: its name has to be unique, so saving as you type would try to create
"L", then "La", then "Las"; and its ingredients are rows in a second table that
would be written and deleted while someone was still deciding — each one landing
on the other phone. So the sheet holds a draft, Save writes it, and Cancel
means cancel.

### How the security was checked

Every migration run in order against a real PostgreSQL 16 on a fresh database,
then re-run to confirm 0008 is idempotent.

The arithmetic first: a dish of three ingredients, one of which was already on
the list, added **2**; tapping it again added **0**; the list held 3 rows, not 4.
A dish with no ingredients returned 0 without erroring. `' lasagne '` was refused
against `'Lasagne'` by the name index, and both check constraints rejected a
made-up slot and a made-up cooking value.

Then as the second household, every crossing attempt was refused: their dishes
and ingredient lists read as **0 rows**, renaming and deleting one changed **0
rows**, and calling `add_dish_to_list()` against it returned 0 and put nothing on
either list. Stapling an ingredient onto their dish was refused by the policy, as
was writing a dish into their household, as was forging `created_by`. Deleting a
dish took its ingredient rows with it.

The three new screens were rendered in a real Chromium at 412×915 in both
themes: the library, the editor on an existing dish and on a new one, the Dishes
category open in the picker, the dish results while searching, and the message
after a tap. No console errors, and no screen scrolls sideways.

`add_dish_to_list()` is the first function here that is **not** security
definer. It doesn't need to be — every table it touches already has a policy
that says what the caller may do, and RLS hides another household's dish from
the lookup on its own. A function that doesn't need to escalate shouldn't.

### How to test it

1. **Meals tab → New dish.** Give it a name — something you actually cook.
   Tap the square to the left of the name to pick a picture; the emoji and
   OpenMoji tabs are both there, same as the shopping tiles.
2. Set **part of the meal** and **cooking**, then add a few ingredients: search
   the catalogue, tap a green row to add it, tap a red one to take it out again.
   **Add it.**
3. Add a second dish with **no ingredients** — call it "Eating out". It should
   save happily and show as *just a name*.
4. **Shopping tab.** Scroll to the categories: **Dishes** is the first one. Open
   it and tap your dish. Everything it needs should appear on the list, with a
   line saying how many.
5. Tap the same dish again. It should say **it is all on the list already** and
   change nothing.
6. Tap "Eating out". It should tell you there are no ingredients yet.
7. Type part of a dish's name in **I need…** — it should come up under
   **Dishes**, above the grocery matches.
8. **Both phones:** write a dish on one and watch it appear in the other's
   library and in its Dishes category without a reload.

### Deliberately not done

- **No "add to the shopping list" button inside the editor.** The specified path
  is the Dishes category on the shopping tab, and mixing "act on this dish" into
  a sheet whose job is "edit this dish" muddles both. Easy to add if reaching
  for it from the library turns out to be the natural move.
- **No search in the library.** Twenty dishes are faster to look down than to
  type into. Worth adding the day that stops being true.
- **`times_planned` / `last_planned_at`** from §7 are not columns yet. Planning a
  dish and shopping for it are different events, nothing this round would write
  them, and a column nothing writes is a column that quietly lies. They arrive
  with the planner.
- **No quantities on an ingredient.** A dish says *tomatoes*, not *400g of
  tomatoes* — quantity is an edit on the list afterwards, exactly as it is for
  anything else you tap (§4.1).

### Next up

Feature round 6: the meal planner — days, slots, and a week that fills the
shopping list.

---

## Round 8.1 — Dishes, after using them

**Branch:** `claude/round-5-dishes-8fh855`

Marçal's notes after round 8 landed. Ten of them; this round does the six that
stand alone, and the four that are really one design decision — meal parts as
coloured tags, dish tags on list items, and the dish grid — go together in the
next round rather than being done three different ways here.

### The bug first

**A hand-picked icon reverted to the letter as soon as the item reached the
list.** It was right in the picker, wrong on the list, wrong in the trolley,
right again back in the picker.

The overrides were being applied in one place — the copy of the catalogue the
picker reads — and the list was resolving its rows against the raw array, the
only copy without them. So it was not that the icon was lost; it was that the
list had never been looking at it.

Fixed by moving the override on to a `withIcons` copy of the *whole* catalogue,
with a map keyed by id beside it, and having both the picker and the list read
from there. Hiding stays a separate filter on top, because a hidden item can
still be on the list and the list still has to be able to draw it.

### What else changed

- **The icon picker has a search.** Typing filters it, and while there is a
  query the three tabs give way to all three styles at once — Lines, Emoji and
  Inked, one section each. Browsing is a per-style activity; searching is not.
- **What makes a picture findable is the catalogue itself.** Every seeded item
  names an icon, so the seed is already a dictionary of words pointing at
  pictures: "cheddar" finds the cheese drawing, "bakery" finds the bread ones.
  `src/lib/icon-search.ts`, 12 tests.
- **The ingredient picker can browse.** The whole catalogue is under the search
  box now, in the same collapsible categories the shopping tab has. Before, you
  had to know the word.
- **And it can invent a word.** Type something the catalogue doesn't have and
  **Add** appears. It writes a real catalogue item — same "Our own words"
  category as typing on the shopping tab — and puts it in the dish. The word
  survives cancelling the dish, because it belongs to the household, not to the
  dish.
- **Cooking has icons**: a leaf, a bolt, an hourglass. They show in the editor
  and in the library, where the glyph appears only once someone has actually
  said — "no cook" is the default nobody chose.
- **"Add to a dish" on a long press.** The tile menu on the shopping tab has a
  third option: pick a dish and the item goes into it, or write a new dish that
  starts with it already in. This is the moment you actually notice a dish is
  missing something — standing in the shop, not sitting in the editor.
- **The catalogue went from 361 items to 569.** Weighted towards the cupboard
  rather than the trolley (pasta shapes, tinned beans, the sauces you own rather
  than buy weekly) and towards these two kitchens in particular: crispbread,
  filmjölk, falukorv, lingonberries and glögg next to calçots, fuet, butifarra,
  mató, romesco and pimentón.

### One thing recorded rather than built

`NIU.md` §4.2 now says a meal-planner slot can hold **a plain shopping item, not
only a dish** — broccoli on a Tuesday is a complete thought and shouldn't need a
dish written for it first. That is a sentence in the spec rather than code
because it decides the planner's schema, and the planner is the next round.
Retrofitting it afterwards would be a table change.

### How it was checked

Every migration run in order against a real PostgreSQL 16 on a fresh database,
and the regenerated seed run **twice**: 569 rows both times, 567 with an icon,
212 with an emoji. Nothing duplicated, because the seed updates on conflict.

The seed's own tests still hold — no duplicate name, every name inside the
length the column accepts, every category real, sort order ascending — which is
what stops 208 hand-written rows from failing on the unique index halfway
through a paste into the SQL editor.

Rendered in a real Chromium at 412×915: the icon search across all three styles
and its empty state, the editor with the cooking glyphs, the ingredient picker
with a category open and with **Add** offered for an unknown word, the "which
dish?" sheet, and the list showing a hand-picked icon that would previously have
shown a letter. No console errors, nothing scrolls sideways. 113 unit tests.

### How to test it

**The bug, first — it needs an item whose icon you have changed:**

1. **Shopping →** long-press a tile → **Change icon** → pick something obvious.
2. Tap that tile so it goes on the list. **The icon should be the one you
   picked**, on the list and in the trolley, not a letter.

**Then:**

3. Long-press any tile → **Change icon** → type **cheese** into the new search
   box. You should get the line drawing, the emoji and the OpenMoji one, all
   three at once. Try a product name that isn't an icon — **cheddar**, **naan**
   — and you should still get something sensible.
4. Long-press a tile → **Add to a dish**. Pick one, and it goes in; or **New
   dish**, and the editor opens with that item already in the list.
5. **Meals → any dish.** The cooking row has three glyphs now. Scroll to **What
   it needs**: under the search box the whole catalogue is browsable by
   category.
6. In that same search box type something Niu has never heard of — **gochujang**
   — and tap **Add**. It joins the dish *and* the shopping catalogue under "Our
   own words".
7. **Shopping →** open a couple of categories. There should be noticeably more
   in them: nine pasta shapes, tinned beans, crispbread, fuet, glögg.

> **Run `supabase/migrations/0003_catalogue_seed.sql` again** in the Supabase SQL
> editor before testing step 7 — that is where the 208 new items live. It
> updates on conflict, so nothing you already have is duplicated or reset.

### Deliberately not done

- **Items 1, 3 and 10** — dish tags on list items, meal parts as multiple
  coloured tags, and the dish grid. One design decision, next round.
- **Sorting the icon search results by how well they match.** They come out in
  set order, which for a handful of hits is fine and for a long tail is
  arbitrary. Worth revisiting if searching starts returning too much.
- **New emoji.** The added items use emoji only where an OpenMoji drawing is
  already shipped; the rest use their line icon. Fetching more is a script run,
  not a code change, and can happen any time.

---

## Round 9 — Parts of a meal, and who asked for what

**Branch:** `claude/round-5-dishes-8fh855`

The other four of Marçal's notes, done together because they are one idea rather
than four: a dish can belong to several parts of a meal, those parts have
colours the household chooses, the library shows them, and the shopping list
says which dish put each thing on it.

### What changed

- **A dish can be several parts of a meal at once.** A lasagne is protein *and*
  carbs. Round 8 made you pick one of four, and the fourth was "other", which
  was a shrug rather than an answer.
- **The parts are yours.** Three arrive to start with — Protein, Carbs,
  Vegetables — and from the first load they are your rows: rename them, recolour
  them, delete them, write your own. Where "Other" used to be there is now
  **Add**.
- **Eight colours, and they are the whole palette.** Picked from swatches, not a
  wheel.
- **The list says which dish wanted each thing.** Tap Lasagne and its tiles wear
  a small mark with the lasagne's own picture, in the colour of its first part.
  Tap Bruschetta too and the tomatoes wear both — including when the tomatoes
  were already on the list before either dish was tapped.
- **The library is a grid of three.** Each tile carries its colour, a dot per
  part, how much cooking it is, and the glyphs of what it is made of.

### Why the colour is a name and not a colour

`dish_tags.colour` holds `'clay'`, never `#a44f36`. The app turns that into
`var(--color-tag-clay)`, so the one rule this project's design has — no colour
written down outside the token file — stays true even for a colour the *user*
picked.

That is not bookkeeping. It is what makes the eight safe: each has a light value
and a dark one, and every one of the sixteen clears 4.5:1 against the fill it
sits on. Checked with arithmetic, not by eye — five of them didn't, first time
round, and were darkened until they did. A free colour wheel can produce
yellow-on-white, and on a list two people read in a supermarket that is a real
problem rather than a matter of taste.

### The bug the test found

`add_dish_to_list()` writes `list_item_dishes`, which deliberately has **no**
insert policy — the tag has to match the dish's real ingredient list, so nobody
should be able to staple one on by hand. But round 8 made that function
`security invoker` on the principle that it needed no privilege the caller
hadn't got. With RLS applying to its own writes, the one thing allowed to write
that table couldn't write it either: every tap returned "1 added" and silently
tagged nothing.

It is `security definer` now, and the household check that came free from RLS is
made by hand instead — the same shape as `record_shop()` in round 7. Verified:
as the second household, tapping the first household's dish still returns 0 and
touches neither list.

### How it was checked

Every migration run in order against a real PostgreSQL 16 on a fresh database,
then re-run to confirm 0009 is idempotent — including the backfill, which
carries each existing dish's old `slot` into the matching tag and skips
'other'.

The tagging arithmetic, in full: tomatoes put on the list by hand, then Lasagne
tapped — **1** row added (the pasta) and **both** its ingredients tagged,
including the tomatoes that were already there. Then Bruschetta — the tomatoes
carry **2** tags. Tapping Lasagne again adds nothing and changes no tag.
Finishing the shop deletes the rows and takes all four tags with them. Deleting
a part leaves every dish standing and removes only that link.

A hex value and an invented colour name were both refused by the check
constraint; a duplicate part name by the index. As the second household:
their tags, links and list tags all read as **0 rows**; recolouring and deleting
changed **0 rows**; stapling a tag onto their dish, claiming a tag for their
household, and asserting a list tag by hand were each refused by a policy.

Rendered in a real Chromium at 412×915 in both themes: the library grid, the
editor's chip row, the colour picker, and the list wearing dish marks in both
the tile and the row view. No console errors, nothing scrolls sideways. 133
unit tests, 22 of them new.

### How to test it

> **Run `supabase/migrations/0009_dish_tags.sql`** in the Supabase SQL editor
> first. Any dish you already made keeps its part of a meal — the migration
> carries it across.

1. **Meals.** The library is a grid of three now. Each tile is in the colour of
   its first part, with a dot per part and the glyphs of its ingredients along
   the bottom.
2. **Open a dish.** The "Part of the meal" row is chips: tap to add and remove,
   as many as you like. Tap **Add** to write a new one — give it a name and a
   colour.
3. **Long-press a chip** to rename or recolour it, or delete it. Deleting takes
   it off every dish that had it; the dishes stay.
4. **Shopping →** put something on the list by hand that one of your dishes also
   needs — say tomatoes.
5. Open **Dishes** and tap that dish. Every one of its ingredients now wears a
   small mark with the dish's picture, **including the tomatoes you had
   already**.
6. Tap a second dish that shares that ingredient. The tomatoes should wear
   **both** marks.
7. Switch **Settings → List view → List**. In row view the first mark shows the
   dish's name in words.
8. Finish a shop. The marks go with the rows — they last exactly as long as the
   reason for them does.

### Deliberately not done

- **Reordering the parts by hand.** They keep the order they were written in.
  A drag handle on a chip row is fiddly on a phone and this is a list of four.
- **Filtering the library by part.** The colours make it scannable; a filter is
  worth adding the day the library is long enough to need one.
- **Untagging one thing from one dish.** The rows can be deleted — the policy
  allows it — but nothing in the app does it yet. The tag disappears when the
  thing is bought, which covers the ordinary case.
- **`dishes.slot` is still a column.** Backfilled and then never read again.
  Dropping a column is the one change re-running a migration cannot undo, and
  the same call was made for `list_items.unit` in round 6.

### Next up

Feature round 6: the meal planner — days, slots, and a week that fills the
shopping list. `NIU.md` §4.2 now carries the two things this round settled that
it will need: a slot can hold a plain shopping item as well as a dish, and a
dish's parts are a set rather than one value.

## Round 10 — The meal planner

**Branch:** `claude/meal-planner-day-week-views-xn4saf`

Feature round 6 in `NIU.md` §10, and the round the Meals tab stops being a
cupboard and starts being a plan. Both directions between the plan and the
shopping list are here, which was Marçal's stated objective: *"so it can go both
ways."*

### What changed

- **The Meals tab is the planner.** Two views of one week: **Days**, a vertical
  scroll of day cards, and **Week**, all seven days on one screen. The dish
  library moved one tap behind it, to `#/meals/dishes`.
- **A meal holds anything.** A dish, a plain catalogue thing ("broccoli on
  Tuesday"), leftovers, or a night out.
- **Long-press a card and drag it** to another day or meal, in either view.
- **Shop for this week** previews everything the week needs — with the dish that
  wants each thing beside it — then writes it all in one call.
- **What can we make?** ranks your dishes by how much of each you already have,
  and the same "4 of 5" appears beside every dish while you are picking one.
- **Cook, then repeat** is drawn rather than asked for. Plan lasagne two nights
  running and the second reads as a repeat.
- **Which meals a day has** is in Settings — breakfast, lunch, dinner.

### The one decision the whole schema rests on

**A meal is a bag, not a set of slots.** `NIU.md` §4.2 asked for fixed slots
defaulting to protein / carbs / vegetables. But round 9 had already turned those
exact three words into *dish tags* — free-form, household-owned, several per
dish, precisely because a lasagne is protein *and* carbs. Building slots as well
would have been two systems for one idea, and would have forced every lasagne to
pick one home.

So a meal holds any number of entries in the order you put them there, each
carrying its colour from its dish's tags. "A protein, a carb and a vegetable" is
now something you can *see* in a row of three coloured cards rather than a shape
you are made to fill. Marçal's call, and `NIU.md` §4.2 now says so.

### Shop → plan, without waiting for months of data

§5 files "what can we make" under stock inference and defers it, warning it needs
months of history. That turned out to be true of the *inference* and not of the
question. Two things were already in the app:

- what is on the shopping list right now, and
- `item_stats.last_bought_at`, written by `record_shop()` since round 7.

So `plannable.ts` answers a smaller question honestly — *how many of this dish's
ingredients are on your list or were bought in the last few days* — and can say
something useful on day one. It never claims to know what is in the cupboard;
the sheet's own subtitle says exactly what it is counting.

Both halves are needed, and that is not obvious. On shopping day the list is the
answer. The morning after, the list is empty and the food is in the fridge —
which is exactly when someone opens the planner. Either half alone has a hole
where the feature is meant to be useful.

### The drag, and the bug a real one found

Marçal chose long-press-and-drag over the safer tap-to-lift-tap-to-drop, so it is
the real gesture. Four things make that work on a phone, all in
`src/lib/drag.svelte.ts`: a long press that cancels the moment the finger moves
(so the page never starts scrolling), a non-passive `touchmove` that keeps it
that way, a fixed-position copy that follows the finger while the original stays
put, and auto-scroll near the edges that re-tests the drop target every frame —
because during it the finger is still and the *page* is moving.

Driving it in a real Chromium found a bug that no amount of reading would have.
Pointer capture was being taken on the first move *after* the lift. A quick
flick's first move event is already a hundred pixels away, so it never lands on
the card, capture is never taken, and every later move and the pointerup go
somewhere else. The card sat still, no target lit up, and — worst — `finish()`
never ran, leaving a ghost stuck to the finger and the page unscrollable until
reload.

Capture is taken at the moment of lifting now, where the pointer is by definition
still on the card. Window-level `pointerup`/`pointercancel` listeners are the
second, independent guarantee that a drag always ends.

### How it was checked

Every migration run in order against a real PostgreSQL 16 on a fresh database,
then 0010 re-run to confirm it is idempotent.

The shape constraint first: a `dish` entry with no dish, an `item` entry pointing
at a dish, an `out` entry carrying one, a made-up meal and a made-up kind were
all refused — **0 rows**. A bare `leftovers` entry with no dish was accepted, as
it must be; a bare `item` was not. The trigger counted the cook and not the
leftovers: Lasagne `times_planned` **1** across a dish entry and a leftovers
entry of itself.

Then the arithmetic. A week of five entries — a lasagne, its leftovers, a
bruschetta, a planned broccoli and a night out — with tomatoes already on the
list by hand. `add_plan_to_list()` added **3**, not 4, and tagged: tomatoes with
*both* Bruschetta and Lasagne including the ones already there, spaghetti with
Lasagne, butter with Bruschetta, broccoli with nobody, which is right — nobody's
dish asked for it. Called again: **0** added, 4 rows, 4 tags, nothing changed. A
backwards range and a null one both returned 0. Deleting Lasagne took both its
entries off the week and left the other four standing.

As the second household, every crossing attempt failed: forging `created_by`,
planning the first household's dish, writing into their week — all refused by
policy. Their `add_plan_to_list()` returned **0** and touched neither list;
their `update` and `delete` against the first household's plan changed **0 rows**;
they read **0** of its entries.

The screens were rendered in a real Chromium at 412×915 in both themes: both
views, the picker with its "what can we make" group, the shop preview, the
makeable sheet, and the entry sheet. No console errors, and nothing scrolls
sideways in either view. A real drag was driven end to end — press, hold, carry
to another day, release — and asserted on: the target highlights, the entry
lands on the new day, the drag state is fully cleaned up, and a short tap still
opens the sheet rather than being eaten.

191 unit tests, 58 of them new.

### How to test it

> **Run `supabase/migrations/0010_meal_plan.sql`** in the Supabase SQL editor
> first. Nothing you already have changes — it adds the plan's own table and two
> columns.

1. **Meals tab.** It opens on the plan now, this week, days first. Your dishes
   are one tap away under **Dishes**, top right.
2. **Tap + under a dinner.** The sheet offers your dishes, then plain things from
   the catalogue, then **Leftovers** / **Eating out**. Pick a dish.
3. Put the **same dish on the next night too**. The second one should draw
   quieter, dashed, with a small round-again mark — that is the cook-then-repeat
   rhythm, worked out rather than asked for.
4. **Press and hold a card for about half a second.** It should lift, buzz, and
   follow your finger; every meal it passes over lights up green. Drop it on
   another day. Drag near the top or bottom of the screen and the plan scrolls
   itself.
5. **Switch to Week.** All seven days at once — this is the easier place to drag
   something from Monday to Friday.
6. **Tap a card** (a short tap, not a hold). Mark it as leftovers, add what it
   needs to the list, write a note, edit the dish, or take it off.
7. **Shop for this week**, at the bottom. It should list everything the week
   needs with the dish that wants each thing, tick the ones already on your list,
   and offer to add the rest. Tap it, then check the **Shopping** tab: the new
   things are there, each wearing the mark of the dish that asked for it.
8. **What can we make?** Put a few things on the shopping list first, or finish a
   shop. Dishes you have most of come up with "you have it all" or "2 of 3 —
   minced beef". Tap one and pick a meal to drop it into.
9. **Settings → Meals in a day.** Turn breakfast on; every day grows a third
   meal. You cannot turn the last one off.
10. **Both phones:** plan something on one and watch it appear on the other's
    week without a reload.

### Deliberately not done

- **The month view.** §4.2 wants one. On a 412px screen thirty days of meal names
  can only be coloured dots, and that answers "what did we eat a fortnight ago"
  rather than a daily question. Worth building, worth building on its own.
- **Auto-suggest a week.** With no planning history it could only rank by
  times-added — which is the picker you already have. `times_planned` starts
  recording now, so it has something to learn from by the time it is built.
- **Reordering within one meal.** A card can be dragged to another meal but not
  shuffled above its neighbour. Two or three cards in a meal read fine in any
  order; worth revisiting if a meal ever holds five.
- **Undo on a drop.** A wrong drop is fixed by dragging it back, which is one
  gesture and is already learned. An undo bar would be a second way to do the
  same thing.
- **The planner in the empty-list state.** §8 wants "tonight's dinner" on the
  empty shopping list. The data is all here now; the empty state is a separate
  screen and a separate decision.
- **`dishes.slot`** is still an unread column, as round 9 left it.

### Next up

Feature round 7: the calendar — events, the month grid, quick add, avatars, and
the one-way push to a shared Google calendar.

## Round 10.1 — The planner, after using it

**Branch:** `claude/meal-planner-day-week-views-xn4saf`

Nine notes from Marçal after a day with round 10. All nine done.

### What changed

1. **The day view starts at today.** It still thinks in weeks — the week view
   shows all seven — but planning Monday's dinner on a Wednesday is not a thing
   anyone does, and two dead days at the top were two screens of scrolling before
   the question you opened the app to answer. A week you have deliberately
   stepped back to still shows all seven; see `planningDays()` in `plan.ts`.
2. **Swipe a card sideways to take it off the plan**, either view, with a bin
   showing behind it as it goes and an **Undo** in the message afterwards.
3. **The picker is rebuilt.** Eating out / Leftovers / Cook it across the top,
   three grids of tiles in the middle, search and New dish pinned to the bottom.
4. **Two buttons pinned above the nav**: *Shop for this week* and *What's home*.
   The shop preview is now a list you **tick**, so you can leave out the things
   you know you have.
5. **A dish written from the picker lands on the day you were adding to**, with a
   small arrival flourish. It used to write the dish and drop you back on an
   empty meal, which looked exactly like the tap had failed.
6. **The dish editor**: cooking is one inline row, "What it needs" is now
   **Ingredients** with a one-word hint, the search box **sticks to the top**,
   and the results are a grid of four.
7. **A shopping item's category can be changed**, and all four tile-menu options
   have icons now.
8. **Dishes reads as a button** rather than a link with a chevron.
9. **The app icon's logo is more than twice the size it was.**

### Cook it, and what it is not

`meal_entries.to_cook` is a hand-set mark meaning *somebody has to cook this
tonight*. Three things it is deliberately not:

- **Not `dishes.cook`.** That says a lasagne is a slow one, which is true
  forever. This is about the evening.
- **Not a fifth `kind`.** It is orthogonal to what an entry *is* — a plain item
  can need cooking too, and that broccoli won't roast itself. As a `kind` it
  would have meant 'dish' and 'dish-to-cook' as separate values, then the same
  again for items.
- **Not inferred.** The planner already works out the *opposite* mark — a repeat,
  from the same dish two nights running — and it would be easy to infer this one
  as its negation. But then every card in the week would be asserting something
  about cooking, and the value of this one is that it is a note you left
  yourself. Marçal's call, and reversible: turning it automatic is a one-line
  default, and the column still holds the override.

Two ways to set it: the sticky **Cook it** toggle in the picker catches it on the
way in, and the card's own sheet catches it afterwards.

### "What's home", and the line it does not cross

`NIU.md` §5 defers stock inference — it needs months of data and a wrong answer
is worse than none. This is the honest half of it and stops well short of that
line: **it counts purchases, it does not model shelf life.** A fish and a bag of
rice bought on the same Saturday are treated identically, because nothing here
knows which is which.

What it does have is each item's own purchase rhythm, learnt since round 7. So
there are two bands rather than one cut-off:

- **Bought this week** — inside the last five days. Barely a guess.
- **Double-check** — longer ago than that, but not yet as long ago as this
  household usually leaves between buying it. Might be there.

One cut-off would have been more confident and less true. And the tap on a
double-check row — *out of it, add to the list* — is the point rather than a
convenience: §5 says the correction is the half that eventually teaches the
shelf-life guess, and this is where those corrections would come from.

### Three gestures on one card

A card now answers to a vertical scroll, a sideways swipe and a long-press drag.
They are told apart by the first thing the finger does, decided once at the first
movement past the tolerance and never revisited — which is what stops a drag
turning into a delete halfway across the screen.

The swipe test asks for movement that is clearly sideways, 1.4× more horizontal
than vertical, rather than merely more sideways than not. A diagonal flick is far
more likely to be a scroll than a delete, and deleting is the one outcome here
that loses something. That is also why the swipe is the only message in the app
with an **Undo** button: it is the one gesture that removes something, can be
started by accident, and leaves nothing behind to put back.

### The icon was a unit bug

The maskable icon's logo was at 44% of the tile. The safe zone for a maskable
icon is a circle whose **diameter** is 80% of the icon's width — so its radius is
40% of the width. `measureMark()` reports distances as a fraction of the icon's
**half** width, in which unit that safe radius is 0.40 / 0.50 = **0.80**.

Round 7 wrote `0.38` there, having read "40% radius" and taken it as a fraction of
the half-width. Out by a factor of two, and the wordmark — whose corners sit at
0.858 half-widths — was duly scaled to 0.38 / 0.858 = 44%.

It is 0.78 now, which puts the mark at **91%**, and the corner arithmetic still
clears a circular crop: 0.858 × 0.91 = 0.781. Nothing clips.

### How it was checked

Every migration run in order against a real PostgreSQL 16 on a fresh database,
then 0011 re-run to confirm it is idempotent — and `add_plan_to_list` confirmed
to exist exactly once, with three arguments, rather than as two overloads
PostgREST would have to guess between.

The subset arithmetic: a week wanting spaghetti, tomatoes, butter and broccoli,
asked for only the tomatoes and the butter, added **2** and tagged both — tomatoes
carrying *both* Bruschetta and Lasagne. An explicitly empty selection added **0**
rather than everything, which is the distinction the whole ticking UI rests on.
A null selection then added the remaining **2**.

Category overrides: writing one worked; writing into the other household's,
forging `set_by`, and a blank name were each refused. As the second household,
our categories and plan read as **0 rows**, their `add_plan_to_list` returned
**0**, and their update and delete against ours changed **0 rows**.

Rendered in a real Chromium at 412×915 in both themes: both planner views, the
rebuilt picker with the Cook it toggle on, the tickable shop list, What's home,
the entry sheet, the dish editor, the shopping tile menu and the category picker.
No console errors, nothing scrolls sideways.

The gestures were driven for real, and each of the five cases asserted:

- a clearly sideways swipe removes the card and offers Undo
- **Undo puts it back** — which is how a genuine bug was found: the flash sat
  inside a wrapper with `pointer-events: none`, so the button could not be
  tapped at all
- a short sideways nudge springs back and removes nothing
- a mostly-vertical drag scrolls the page and removes nothing
- press-and-hold still lifts and moves the card rather than deleting it

Also driven: writing a new dish from the picker, which lands on the right day
with the arrival animation actually running mid-flight; and the ingredient
search, sampled at four scroll positions, pinning flush to the sheet's top edge
from 600px down.

205 unit tests, 14 of them new.

### How to test it

> **Run `supabase/migrations/0011_planner_tweaks.sql`** in the Supabase SQL
> editor first.

1. **Meals.** The day view starts at **Today**. Step to next week and all seven
   days are back.
2. **Swipe a card left or right.** A bin appears behind it, it flies off, and the
   message offers **Undo**. Try a small nudge — it springs back. Try swiping
   diagonally down — that should scroll, not delete.
3. **Tap + on a meal.** Eating out, Leftovers and **Cook it** are across the top;
   Cook it stays lit and marks whatever you pick next. Everything is tiles now,
   three across, and the search and **New dish** are pinned at the bottom.
4. **New dish → give it a name → Add it.** It should appear **on that meal**
   straight away, with a small bounce.
5. **Tap a planned card.** There is a "Mark as one to cook" toggle in the sheet
   too.
6. **Shop for this week**, bottom left. Untick anything you already have; the
   button counts down. **All** / **None** are there for a long week.
7. **What's home**, bottom right. Two groups: bought this week, and
   double-check. Tap **Out of it** on anything you know you've run out of and it
   goes on the shopping list.
8. **Meals → Dishes → open a dish.** Cooking is one row now, ingredients are four
   across, and scrolling down keeps the search box stuck to the top.
9. **Shopping → long-press a tile you haven't got on the list.** Four options
   with icons, including **Change category**.
10. **The app icon.** Remove Niu from your home screen and add it again — the
    wordmark should be more than twice the size.

### Deliberately not done

- **Deciding between "What can we make?" and "What's home".** They overlap and
  you said to keep both for now. One reads the *plan's* ingredients, the other
  reads *purchases*; after a week of use it should be obvious which is the one
  you actually open.
- **Reordering within one meal.** A card can be dragged to another meal but not
  shuffled above its neighbour.
- **Making the cook mark automatic.** Recorded above as a one-line change if the
  manual version turns out to be tedious.
- **A "hidden" undo for the other destructive actions.** Deleting a dish and
  hiding a tile still ask first, which is the older pattern and fine; the swipe
  needed an undo precisely because it doesn't ask.

### Next up

Feature round 7: the calendar.

## Round 10.2 — Small adjustments, and the swipe that didn't work

**Branch:** `claude/meal-planner-day-week-views-xn4saf`

Six notes. No migration — all of it is the front end.

### The swipe bug, which was a `touch-action` bug

Round 10.1 shipped swipe-to-remove and it did not work on Marçal's phone: the
card moved a few pixels and sprang back. It passed every test here, and that is
the interesting part — **the tests drove it with a mouse, and a mouse never has
this problem.**

The card left `touch-action` at its default of `auto`, which promises the
compositor nothing, so the compositor kept the right to claim the gesture as a
pan. On a real device it does exactly that the moment a sideways drag starts,
and the page then fires `pointercancel` at the card — which sprang it back,
mid-swipe.

`touch-action: pan-y` is the fix, and it is a statement of intent rather than a
workaround: *vertical panning is yours, horizontal is mine.* The compositor
stops stealing sideways drags, the cancel never happens, and scrolling over a
card still works natively. As a second guarantee, `pointercancel` no longer
rewinds a swipe — it ends at the last position the finger was actually seen at,
so a cancel arriving after a long deliberate swipe still removes the card.

The lesson is recorded in `drag.svelte.ts`: **gestures have to be driven with
real touch events.** Every gesture assertion in this round uses CDP
`Input.dispatchTouchEvent` rather than the mouse.

### What else changed

- **A bin, while a card is in the air.** The two pinned buttons become a bin for
  exactly as long as something is being dragged, and it fills solid red under the
  finger. A bin that were always there would be a permanently armed delete under
  your thumb; one that appears only when something is actually being carried
  cannot be hit by accident, and lands where a thumb already is at the end of a
  downward drag.
- **You can still scroll while dragging**, which the bin threatened: it sits in
  the strip the downward auto-scroll band used to occupy. The band now sits
  *above* the bin — `edgeScroll()` takes its floor from the bin's own top edge
  rather than from the bottom of the screen.
- **The dish editor**: "Cooking" is a heading again like "Part of the meal", and
  what is inline is each option's own icon and word. The ingredients a dish
  already has are on the same grid as the ones you are choosing from.
- **The shop preview is boxes.** The whole row toggles, not the checkbox: a
  1.6rem target is below this project's tap floor, and aiming at one while
  walking is precisely what the floor is for. Ticked rows carry a tint as well as
  a mark, so the shape of what you are buying reads without checking eight boxes
  one at a time.
- **"What's home"** lost its three-line caveat to a discreet ⓘ — the caveat still
  matters, but as a paragraph above the content it was read once and scrolled
  past forever while pushing the answer below the fold.
- **Hold an item in "What's home" and drag it straight onto a day.**
- **"Or just a thing" is now "Recently bought"**, and shows what this household
  actually bought last rather than a hand-picked guess about households in
  general. Typing turns it back into ordinary catalogue search, so anything is
  still reachable.
- **The two pinned buttons are "Shop" and "At home"**, floating over the content
  with only a gradient fade behind them — the same way the shopping tab's search
  field does it. Side by side at 412px with a count badge each, there was room
  for a word and not a sentence.
- **Lists no longer carry a 40px indent.** `global.css` reset `margin` but not
  `padding`, so every `<ul>` in the app had one. It showed up as the unexplained
  left margin on both the shop preview and "What's home".

### Carrying something out of a sheet

Holding an item in "What's home" had to survive the sheet getting out of the way
— you cannot aim at a week you cannot see. The first attempt closed the sheet
and the carry died on the first move.

The reason is worth writing down: **a touch pointer is implicitly captured by the
element it started on.** Remove that element and the browser releases the capture
and fires `pointercancel`. Window-level listeners do not save you, because there
is no longer a path from the detached row up to the window for anything to bubble
along.

So the sheet is *hidden*, not unmounted — invisible and inert while the finger is
down, unmounted by `onEnd` once it lifts. That one distinction is the difference
between the gesture working and not existing.

### How it was checked

Gestures driven with real touch events, and each asserted:

- `touch-action` on a card reads `pan-y`
- a sideways touch swipe removes the card (this is the case that was broken)
- the bin is absent at rest, present while dragging, lit while the finger is over
  it, and deletes on drop
- the page still scrolls while a card is being dragged, with the finger just
  above the bin, and the bin does *not* light up there
- holding a row in "What's home" hides the sheet, carries the item, lights a slot
  under it, plants it on drop, and leaves nothing stuck to the finger

Rendered in a real Chromium at 412×915 in both themes: the day view with the
floating dock, the picker with "Recently bought", the shop preview ticked and
unticked, "What's home" with its ⓘ open and closed, and the dish editor. No
console errors, nothing scrolls sideways.

211 unit tests, 6 of them new.

### How to test it

No migration this time — just reload.

1. **Swipe a card sideways.** It should actually go now. Try it in both views.
2. **Hold a card until it lifts.** The two buttons at the bottom turn into a
   **bin**; drag onto it and it fills red; let go and the card is gone.
3. **While still holding**, move the finger to just *above* the bin — the week
   should scroll under it. The bin must not light up while you are there.
4. **Meals → Dishes → a dish.** "Cooking" is a heading, each option is a glyph
   and a word side by side, and the ingredients it already has are tiles.
5. **Shop** (bottom left). Tap anywhere on a row to include or exclude it — the
   whole box, not the little square. No odd indent on the left any more.
6. **At home** (bottom right). The explanation is behind the small **ⓘ**.
   **Hold an item** — the sheet gets out of the way and the item follows your
   finger. Drop it on any meal.
7. **Tap + on a meal.** The third group is **Recently bought** now. Type
   something and it goes back to searching the whole catalogue.

### Deliberately not done

- **A bin for the swipe.** Swiping already removes and already offers Undo; the
  bin is for the drag, which had no way to delete at all.
- **Undo on a bin drop.** It uses the same path as a swipe, so it gets the same
  Undo — nothing extra was needed.
- **Reordering within one meal**, still.

## Round 11 — The calendar

**Branch:** `claude/calendar-r7-events-confirmations-htn01h`

Feature round 7 in NIU.md §10's numbering. The third of the three things Niu is
for, plus the thing that had been quietly missing since round 2: a second person.

### What changed

**People, at last.** Round 2 built households and deferred the invite flow, and
nothing since had needed it — a shopping list shared by one person works fine.
The calendar is the first feature that cannot exist without it: "who goes" needs
faces and "send it to her to confirm" needs a her. So `household_members` grew a
name, a colour, an emoji face and an email, and a household grew a **six-character
join code** you read out across the kitchen. No email invite: sending email needs
a server, and this project has neither one nor a budget for one (§1).

**The month grid**, with the selected day's list underneath it. The grid answers
*where* and the list answers *what*, which is the only way a month works at
412px: a cell is 52px wide, which is room for a number and three coloured dots.
Today is a filled circle and the selected day is a ring — two marks, because they
are two facts and usually two different days.

**Events**, with the fields §4.3 asked for: title, day, start and end time, all
day, more than one day, who goes, where, notes, colour. The sheet shows four
things — title, time, faces, Save — and hides the rest behind **More**. Nine
evenings out of ten the other five are empty, and a form that shows ten fields to
collect two is a form people stop using.

**Reminders**, which Marçal asked for this round: "x day remember to do x thing",
faster than an event. Same table, fewer fields, and one thing an event doesn't
have — **a checkbox**. A reminder that just slid into the past never told you the
permit got renewed.

**Send it for confirmation.** The feature this round was really about. Tap *Ask
Marta to confirm* on any event and it appears on her phone with **Yes** and
**Can't** beside it, at the top of her calendar screen, above the grid, wherever
in the year the event actually is. The Calendar tab wears a count, so it is
visible from the shopping list too.

An unconfirmed event is **dashed, not hidden**. That is the one design decision
worth arguing about and it went this way on purpose: an event that only appeared
once the other person had agreed to it would be an event you cannot talk about.
It is on the calendar the moment it is written; the dashes say she hasn't seen it
yet.

**Moving the time asks again.** Edit an event people have already answered, and if
the day, the time or the place changed, the old answers are cleared and everyone
is asked afresh — with a line saying so. A "yes" to Thursday is not a yes to
Saturday. A fixed typo changes nothing.

**One-way push to Google**, as §4.3 wanted, with one deviation described below.
Everything goes: events, reminders, multi-day, the lot. A reminder crosses over
with an alarm on it, so Google's own notification is what buzzes the phone — which
is the promise §9 made when it deferred push notifications, now actually kept.

### The Google deviation, and why it is better

§4.3 imagined **one shared Google calendar that both accounts subscribe to**.
That is not what got built, and the reason is worth writing down.

Niu asks Google for exactly one permission:
`https://www.googleapis.com/auth/calendar.app.created` — *"make secondary Google
calendars, and see, create, change and delete events on them."* It is the
narrowest scope that can do the job, and with it **Niu is incapable of reading
anyone's other calendars**. §4.3's promise stops being a promise about our
intentions and becomes a fact about the token.

The price is that the scope covers only calendars this app made *for this user*,
and it cannot write sharing rules — so one account cannot be given write access to
the other's calendar. Each member therefore gets **their own calendar called
"Niu"**, and each phone pushes the household's events into its own copy. On the
phone the result is identical to what §4.3 described. NIU.md has been updated.

### Three decisions inside the sync

**The Google event id is derived, not stored.** Google lets the caller choose an
event's id as long as it is base32hex — lowercase a–v and digits. Our uuids are
hex, which fits, so the Google id is `niu` + the uuid. That is worth more than the
column it saves: a push that half-fails can simply be retried, because the retry
hits the same id and *updates* rather than making a second copy of Thursday's
dinner. It is also why deleting still works after our row is gone, and why the
tombstone table is three columns instead of a join.

**Google's all-day end date is exclusive and ours is inclusive.** A holiday from
the 1st to the 7th is stored here as ending on the 7th and has to be sent as the
8th. That conversion happens in exactly one function and it has the most
important test in the file — get it wrong and every multi-day event is a day
short, which is the kind of bug nobody notices for a month.

**An all-day reminder is pushed as a 09:00 appointment.** Not a preference — a
hard limit. Google counts a reminder in minutes *before* an event, an all-day
event starts at midnight, and the number cannot be negative. So an all-day
reminder could only ever buzz at midnight or the day before. Sending it as a
short 09:00 slot is what makes "Tuesday, renew the permit" arrive on Tuesday
morning. In Niu it stays a day's task with no time on it, which is what it is.

### Why there is a Sync button

Getting a Google token in a browser needs a popup, and a browser only opens one
for a page that asked because somebody tapped. So **the first sync after opening
the app is a tap**, and everything for the next hour goes across on its own.

Rather than hide that behind a background job that silently does nothing, the
calendar shows a **Sync 3** pill with the count on it. The alternative was a
Supabase Edge Function holding the Google client secret — which is the right
answer eventually and is what round 11.1 needs anyway for push notifications, but
which is a deploy step and a stored refresh token in exchange for a problem
Google already solves for browser apps.

The token is kept **in memory only**, never in localStorage. A bearer token in
storage outlives the tab and is exactly what an XSS would go looking for, and the
cost of not storing it is the tap that was needed anyway.

### A refactor that came along the way

The date arithmetic moved out of `plan.ts` into **`src/lib/dates.ts`**, and the
planner now imports it from there. The calendar needed every line of it, and two
copies of "which day is this" is precisely the bug this project cannot afford.
`plan.ts` re-exports the lot, so nothing else changed.

### How it was checked

104 new unit tests, 315 in total, all passing. The ones that matter:

- the inclusive→exclusive all-day conversion, in both directions
- a timed event with no end time at 23:30 rolling its *day* forward, not just its
  hour — an end before its start is a 400 from Google
- the month grid: whole weeks always, every day of the month exactly once, four
  rows for a February that starts on a Monday and six for a 31-day month starting
  on a Saturday
- one "no" outweighing a missing answer
- the sync queue: nothing pushed twice, nothing deleted that Google was never
  told about, nothing deleted twice
- `GOOGLE_SCOPE` pinned by a test, so widening it to the read-everything scope is
  a deliberate act rather than an edit

Rendered in a real Chromium at 412×915 in both themes: the month with a busy day,
the day list, the event sheet, the reminder sheet, and the "Waiting on you" card.
No console errors, nothing scrolls sideways. Two things the render caught that
reading the code had not: the unanswered dot was invisible at 6px (it is a ring
in the page colour now), and the last event of a busy day sat permanently under
the floating Add button.

### How to test it

**Run `supabase/migrations/0012_calendar.sql` in the Supabase SQL editor first**,
then reload. `docs/SUPABASE_SETUP.md` has the whole round written out, including
the Google Cloud part.

1. **Settings → You.** Give yourself a name, a colour and a face. Do the same on
   her phone after step 2.
2. **Settings → Add someone → Show the code.** Read the six characters out. On
   her phone: sign in with Google, **Settings → Join a household**, type it,
   **Join**. Her name should appear in your list without a reload.
3. **Calendar tab → + Event.** Type a title, keep 18:00, tap both faces, **Add
   it**. It lands on today with two small faces on the row and a dot on the grid.
4. **Tap the event → Ask <her name> to confirm.** The row goes dashed and says
   "Waiting on <name>". **On her phone**, the Calendar tab grows a red 1, and the
   event is at the top of the screen with **Yes** / **Can't**. Tap Yes. Your
   phone should stop being dashed without a reload.
5. **Move the time and save.** Everyone gets asked again, and the sheet says why
   before you press Save.
6. **⏰ Reminder.** Type "Renew the parking permit", leave it All day, **Add it**.
   It gets a checkbox on the left. Tap the box — it fills, the title strikes
   through and the row drops to the bottom of the day.
7. **A holiday.** + Event → title → **All day** → **More** → **More than one
   day** → pick a day a week out. The row says "1–8 Sep · 8 days" and every one
   of those days wears a dot on the grid.
8. **Step months** with ‹ ›, tap any day, and use **Today** in the day heading to
   come back.
9. **Google** (only once the Cloud setup is done). **Settings → Google Calendar →
   Connect**. Accept the warning about the unverified app. Then open Google
   Calendar on the phone: there is a new calendar called **Niu** with everything
   in it. The reminder should buzz at 09:00 on its day.
10. **Both phones:** add something on one and watch it appear on the other's
    month without a reload.

### Deliberately not done

- **Push notifications.** Marçal's call this round: confirmations land in-app and
  on the tab badge now, and a real phone notification is round 11.1 on its own.
  It needs three new things — a service worker that handles push, a VAPID key
  pair, and one small Supabase function holding the private key — and it is the
  part most likely to need two or three goes on a real Android phone. Worth
  getting right rather than bolting on. This round deliberately built the thing
  the notification will point at.
- **Typed quick-add** — "Thursday 18:30 dinner". §11's first open question,
  which said to decide in round 7. **Decided: not now.** Reliable date parsing
  across English, Catalan and Swedish is a real project, and §4.3 says the
  structured flow "must be excellent on its own" regardless. Revisit once the
  structured flow has been used for a month and it is clear what typing would
  actually save.
- **Recurrence.** §4.3 wants "repeats X times per week or month; ends after X
  times", and it is a genuine third of the calendar — the recurrence itself, the
  "this one or all of them?" question on every edit and delete, and the same
  again on the Google side, where it means RRULE. It earns its own round.
- **Event categories with names.** §4.3 wants categories that have colours *and*
  are distinguishable from people's colours. Half of that shipped: an event has
  one of the eight colours, and a person's colour shows as their avatar's ring,
  so the two never collide. Named categories can wait until there is evidence
  anyone wants to filter by one.
- **Reading a Google calendar back.** Still explicitly not a feature (§4.3), and
  now not even possible with the scope Niu asks for.
- **An old-tombstone sweep.** `event_tombstones` keeps three columns per deleted
  event forever. A household making a few hundred a year will not notice; if it
  ever matters it is one scheduled delete.

## Round 11.1 — The calendar, after using it

**Branch:** `claude/calendar-r7-events-confirmations-htn01h`

Nine notes from Marçal after a day with round 11. Eight are here; the ninth —
people without accounts, photos, and your face in the nav — is round 11.2,
because it needs Supabase Storage with its own security policies and that is a
round rather than a note.

### What changed

1. **The month grid draws events, not dots.** Small boxes with the title in
   them, and **a holiday running Friday to Tuesday is one unbroken bar** rather
   than five separate blobs. The maths is in a new `src/lib/grid-layout.ts` and
   it is the only genuinely algorithmic part of the calendar, so it is pure and
   has 19 tests of its own.
2. **A week view**, with a Month / Week switcher above it. Seven days down the
   screen, each written out in full, using the same rows the day list uses.
3. **The sheet opens straight into the title with the keyboard up.** No "What is
   it?" label, no example title — just *Add a title* on a line of its own.
   Pressing Enter saves.
4. **Start and end time, side by side, on the basics.** The end says
   "(optional)" and has an × to clear it; the multi-day toggle stayed behind
   *More*, because that is the rarer thing.
5. **Six colours in one line**, out of the eight the dish library uses. Sage sits
   too close to moss to be told apart in a 7px box, and stone is the colour of
   having no colour.
6. **Coming up says which day each thing is on.** It was three events with no
   dates, which is the one thing a calendar must never be.
7. **The top bar is gone.** Settings moved into the bottom bar as your own face.
8. **The planner's drop-to-remove bin is twice as tall.**

### The week view starts at today

The first version opened on Monday and showed three spent days before today.
That is exactly the problem round 10.1 solved for the meal planner, so it now
uses exactly the same rule — the current week starts at today, any other week
shows all seven — and the rule itself moved into `dates.ts` as `weekDaysFrom()`,
with `planningDays()` in the planner calling it. One implementation.

### Why a bar cannot live inside a day cell

A box that spans five days cannot be drawn by any one of those days: a cell
cannot paint outside itself. So a week row is now two layers — seven buttons
underneath carrying the dates, the taps and the "+2", and one CSS grid on top
where a box is literally `grid-column: 3 / span 5`.

The layer of boxes takes no taps at all. That is deliberate: a 17px-tall box is
not a touch target, and the list below is where an event is meant to be read and
opened. The grid answers *where*, the list answers *what*.

**Longer events get their lane first.** Not an optimisation — a bar that changes
lane halfway across a week reads as two different events, so the long ones take
the low lanes and the single days shuffle around them.

### The nav, and what it bought

Removing the top bar wins 57 pixels — more than a whole row of the month grid —
and the screen title it held was already being said by the tab bar underneath.

Settings is **not** a fourth equal tab: it is a place you visit monthly, and four
equal items would have shrunk the three you use daily from 137px to 103px. It is
your avatar on the right instead, in a narrower slot, divided off by a hairline.
It reads warmer than a gear and it is the same avatar the calendar draws beside
an event. Settings grew its own heading; the dish library already had a back row.

### How it was checked

335 unit tests, 19 of them new, all passing. The grid layout ones are the ones
that matter: a bar clipped at a week boundary appears in both weeks with the
correct column and span, a long event keeps one lane the whole way across, a
short event sits beside a bar it does not touch, and what does not fit is
counted per *day* rather than per week.

Rendered in a real Chromium at 412×915 in both themes: the month with a busy
week, the week view, the event sheet and the reminder sheet. No console errors,
nothing scrolls sideways. Three things the render caught that reading the code
had not:

- every box came out wordless — the "is this wide enough for a word" test was
  set at two columns, and one column is five characters, which is a word
- the time fields were 112px tall. `.time` carries a flex *basis* for the row it
  sits in elsewhere, and inside a column a basis is a height
- the week view opened on three empty days, which is what led to the rule above

### How to test it

No migration this round — just reload.

1. **The top bar is gone**, and your face is at the bottom right. Tap it for
   Settings; it turns into a way back to where you were.
2. **Calendar → a busy week.** Events are boxes with words in them now. Put a
   holiday across a weekend (**＋ Event → All day → More → More than one day**)
   and it should draw as *one* bar straight through, including across the join
   between two weeks.
3. **Week**, top left. Seven days down the screen. This week starts at today;
   step back with ‹ and you get all seven.
4. **＋ Event.** The keyboard should already be up with the cursor in the title.
   Type and press Enter — it saves without you reaching for the button.
5. **Times.** Start and end are both there now, side by side. Set an end, then
   tap the × beside it to take it off again.
6. **Colours** are six, on one line, under the faces.
7. **Empty day → Coming up.** Each row says which day it is on.
8. **Meals → hold a card.** The bin is about twice as tall as it was.

### Deliberately not done

- **People without accounts, photos, and the Google profile picture.** Round
  11.2. It needs a Storage bucket with its own policies, a table for people who
  have no account to attach to, and image resizing on the phone — which is a
  round, not a note.
- **Tapping a box in the month grid.** They are 17px tall; the day underneath
  takes the tap and the list below opens the event. Worth revisiting only if
  reading the list ever feels like a detour.
- **Swiping between months.** A horizontal swipe on the grid fights Android's
  own back gesture at the screen edges, which is the one gesture that must keep
  working.
- **A month view for the meal planner.** Still open from round 10, still a
  separate thing.

## Round 11.2 — People, not members

**Branch:** `claude/calendar-r7-events-confirmations-htn01h`

The ninth of Marçal's round-11 notes, held back from 11.1 because it needed
Supabase Storage with its own security policies and a change to the data model.

### What changed

**People without a phone.** Kids, grandparents — anyone who is part of the
family's plans without being part of its logins. They have a name, a colour and
a face, they can be put on events, and they are never asked to confirm
anything. **Settings → Who lives here → Add a person.**

**Photos.** Any person can have a real photograph instead of an emoji, taken or
picked with the phone's own picker. Your Google profile picture is captured on
first sign-in, so a new account has a face before anybody has done anything.

**One sheet for everybody.** Tapping a person in Settings opens the same editor
whether they have an account or not — name, photo, emoji, colour. The separate
"You" card is gone; you are simply the first row of the household, with a tag.

### The model change, which is the actual round

Until now a person *was* a `household_members` row, which is a row about an auth
user. A child has no auth user. The obvious move — a second table for
account-less people — would have meant every list of people being a union of two
tables and every attendee row pointing at one of two things.

So there is now one table of **people**, with a nullable `user_id`. A person with
an account and a person without are the same kind of row; the account is a
property, not a category. `household_members` keeps its old job and only that
job — it is the *access* record, the thing RLS reads — while `household_people`
is the *identity* record. Joining a household makes you a person, by trigger, so
every route in produces the same result.

`event_attendees.user_id` became `person_id`, backfilled inside the same
migration. `event_confirmations` was deliberately left keyed on auth users: only
somebody with an account can be asked anything.

The app renamed to match. `members.svelte.ts` is `people.svelte.ts`,
`MemberAvatar` is `PersonAvatar`, and "member" no longer appears in any user-
facing string. That was the point of the rename — the old word was quietly
telling us the model was wrong.

### Three decisions about the photos

**The bucket is private.** These are photographs of a family including children;
a public bucket means anybody holding the address can view them forever. Private
costs one signing call on load — batched, so a household of four is one request
rather than four — and it is the right way round for this content.

**The path is the permission.** Every object is `household_id/person_id.jpg`, and
every Storage policy reads the household out of that first folder. Not a naming
convention: the security model. The helper that does the reading returns null
rather than casting, because a policy that *throws* on a badly shaped path fails
the whole query — including for objects in other buckets, since SQL does not
promise to evaluate `bucket_id` first.

**Resizing happens on the phone.** A photo off an Android camera is four or five
megabytes; an avatar is drawn at 48 pixels. It is cropped square and shrunk to
256px before it goes anywhere, which makes the upload about 20KB. The
alternative is resizing on a server, and this project has no server (§1). The
crop arithmetic is in `src/lib/photo.ts`, pure and tested; the canvas work
around it is thin on purpose.

**Google's picture is kept as an address, not as bytes.** Downloading it into our
bucket would depend on the image being readable cross-origin into a canvas,
which is not something to build on — and the address works perfectly well as an
image source. If Google ever stops serving it, the emoji fallback is there.

### How it was checked

351 unit tests, 16 of them new: the cover-crop rectangle stays inside the image
for a spread of awkward sizes including odd overhangs and 1×1, the output size
caps without ever blowing a small photo up, the file guard lets an empty MIME
type through (some Android pickers report none for a perfectly good JPEG) and
refuses a video, and the storage path puts the household first.

Rendered in a real Chromium at 412×915 in both themes: the household card with
four people of four different face kinds, the person sheet for a child, for
yourself and for somebody else's account, and the event sheet's attendee row.
Two things the render caught:

- `.tag.quiet` on the "No phone" chip was silently inheriting a `.quiet` text
  button's 48px min-height from elsewhere in the same file, making a 18px chip
  48px tall. Renamed to `.outline`.
- the selected state inverted the circle, which works for a letter and turns an
  emoji into a muddy blob. Only the letter inverts now; a photo or an emoji says
  "chosen" on its edge instead.

### How to test it

**Two setup steps this round, and the first is not SQL** —
`docs/SUPABASE_SETUP.md` has both written out:

1. **Storage → New bucket**, named `avatars`, **not public**.
2. Run `supabase/migrations/0013_people_and_photos.sql` in the SQL Editor.

Then reload and:

1. **Settings → Who lives here.** You and anyone who has joined are listed, you
   with a **You** tag. Your Google profile picture should already be your face.
2. **Add a person** → type a child's name → **Add**. Their sheet opens straight
   away, because naming somebody and giving them a face is one thought.
3. **Choose a photo.** The phone offers the camera and the gallery. Pick
   anything — it should come back cropped to a circle in about a second, and it
   is a 20KB upload, not a 5MB one.
4. **Tap a person in the list** to edit them again. Try tapping your partner:
   their name and face are read-only, and the sheet says why.
5. **Calendar → ＋ Event → Who goes.** Everyone is there, kids included. Tap the
   child; the ring goes solid. Save, and the row on the calendar wears their
   face.
6. **Ask to confirm** still only ever names somebody with an account. A child is
   never asked.
7. **Both phones:** add a person on one and watch them appear in the other's
   list, with their photo, without a reload.

### Deliberately not done

- **Cropping by hand.** The crop is the middle square, which for a phone photo
  of a person is where the face is. A pinch-and-drag cropper is a real piece of
  work and worth building only if the automatic one turns out to be wrong often.
- **A photo for the household itself.** Nothing asks for one yet.
- **Removing somebody with an account.** Leaving a household is its own act and
  needs its own confirmation flow; the database refuses it from here for now.
- **`household_members`' old profile columns.** Left in place, unread, so a phone
  running the previous version does not show blanks. Droppable in a later round
  once both phones have certainly updated.
