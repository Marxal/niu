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
