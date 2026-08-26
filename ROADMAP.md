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
