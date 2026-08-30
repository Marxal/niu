# Connecting Niu to Supabase

One-time setup. Everything here happens in a browser — there's no code to write.
Until it's done, Niu runs fine but saves nothing and shows "Not connected yet" in
Settings.

Budget note: everything below is on Supabase's and Google's free tiers. Neither
asks for a card. The one thing to know is that a free Supabase project **pauses
after 7 days with no activity** — if that ever happens, open the dashboard and
press Restore. Using Niu a couple of times a week is enough to keep it awake.

---

## 1. Make the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in with GitHub.
2. **New project**. Name it `niu`. Pick the region closest to home (eu-west for
   Europe). Set a database password and save it in your password manager — you
   won't need it for Niu, but you'll want it one day.
3. Wait a couple of minutes while it builds.

## 2. Create the tables

1. In the project, open **SQL Editor** in the left sidebar.
2. Open `supabase/migrations/0001_households.sql` from this repo, copy the whole
   file, paste it in, and press **Run**.
3. It should say success. Running it twice is harmless if you're not sure.

This creates the two tables and — more importantly — the Row Level Security
policies that stop one household ever seeing another's data.

## 3. Turn on Google sign-in

**In Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):

1. Create a project called `niu`.
2. **APIs & Services → OAuth consent screen**. Choose **External**. Fill in the
   app name (`Niu`), your email as support contact, and your email as developer
   contact. Save. You do **not** need to publish or get it verified — leave it in
   Testing and add your own and your wife's Google accounts as test users.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   Application type: **Web application**.
4. Under **Authorised redirect URIs**, add the callback URL that Supabase gives
   you. Find it in Supabase under **Authentication → Sign In / Providers →
   Google** — it looks like
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
5. Create it, then copy the **Client ID** and **Client secret**.

**Back in Supabase**, under **Authentication → Sign In / Providers → Google**:

1. Toggle Google on.
2. Paste the Client ID and Client secret. Save.

## 4. Tell Supabase where to send people back to

Under **Authentication → URL Configuration**:

- **Site URL**: `https://marxal.github.io/niu/`
- **Redirect URLs**: add `https://marxal.github.io/niu/` — and
  `http://localhost:5173/` too if you ever want it working on a laptop.

Sign-in bounces back to a blank page if this doesn't match exactly, trailing
slash included.

## 5. Give the two values to Claude

In Supabase, **Project Settings → API**. Copy:

- **Project URL** (`https://….supabase.co`)
- The **anon** / **publishable** key

Paste both into the chat and they'll be committed to `.env`, which is what the
GitHub Pages build reads.

> **Only ever the anon key.** There is a second key on that page called
> `service_role` (or `secret`). It bypasses every security policy in the
> database and must never leave the dashboard. Niu refuses to start if it finds
> one in the bundle, but the simplest protection is not copying it.

---

## Why the anon key in a public repo is fine

It's compiled into the JavaScript that every visitor downloads, so it is public
whatever we do — that's what the `VITE_` prefix means. It identifies the project;
it doesn't grant access. What grants access is a signed-in user matching a Row
Level Security policy, and those live in the database where nobody can edit them
from the browser.

---

## Round 3: the shopping list tables

Two more SQL files to run, in this order, same place (**SQL Editor**):

1. `supabase/migrations/0002_shopping_list.sql` — the tables, their security
   policies, and realtime so both phones stay in sync.
2. `supabase/migrations/0003_catalogue_seed.sql` — the 361 grocery tiles.

Both are safe to run twice. The second one is generated from
`src/lib/catalogue-seed.ts`; if the catalogue ever changes, it's regenerated
with `npm run seed:sql` and re-run, which updates the existing rows rather than
duplicating them.

### Turn on realtime

The list won't sync between phones without this. In the Supabase dashboard go to
**Database → Replication** (or **Realtime**), and make sure `list_items` is
included in the `supabase_realtime` publication. The migration tries to add it
automatically, but the dashboard is where to check it actually took.

---

## Round 4: icons, hiding tiles, and the learned order

One more SQL file, then **re-run the seed**. In this order, in the **SQL Editor**:

1. `supabase/migrations/0004_icons_and_hidden.sql` — adds the suggested-order
   column, the "removed for good" table, and the per-household usage counter
   that the picker learns from.
2. `supabase/migrations/0003_catalogue_seed.sql` — **run this again.** The icon
   column used to hold an emoji and now holds the name of a line drawing, so
   the seed has to be re-applied to swap them over. It updates the existing
   rows rather than duplicating them.

Running 3 before 4 will fail, because the seed writes the column that 4 adds.

### Realtime

`0004` also puts `catalogue_items` and `catalogue_hidden` on the realtime
stream, so a word one of you invents shows up on the other phone. Same check as
before: **Database → Replication**, confirm all four tables are in the
`supabase_realtime` publication.

---

## Round 5: emoji and custom icons

One new file, then **re-run the seed again**. In the **SQL Editor**:

1. `supabase/migrations/0005_emoji_and_custom_icons.sql` — adds the emoji column
   and the per-household icon-override table.
2. `supabase/migrations/0003_catalogue_seed.sql` — **run it again.** This fills
   in the emoji column so the "Colour" icon style has something to show. It
   updates existing rows; nothing is duplicated.

As with round 4, 3 must come after 5 — the seed writes a column that 5 adds.

> **Setting a project up from scratch, later?** Run the files in this order:
> `0001`, `0002`, `0004`, `0005`, `0006`, `0007`, `0008`, and `0003` **last**. The seed
> file has grown columns that the later migrations add, so on an empty database
> it fails until they have run. Every file is safe to run twice, so if you do it
> in the order the sections above are written, simply re-running `0003` at the
> end fixes it.

---

## Round 6: make deletes sync, and the second priority flag

One file, no re-seed. In the **SQL Editor**:

1. `supabase/migrations/0006_sync_and_priority.sql`

Two things happen in it, and the first is the one that matters:

**`replica identity full` on `list_items`.** Without it, emptying the trolley on
one phone never reached the other. Realtime subscribes with a
`household_id=eq.…` filter; on a delete Postgres only writes the deleted row's
*replica identity* to its log, which by default is the primary key alone. The
event arrived with no `household_id` on it, the filter didn't match, and it was
dropped. `full` writes the whole deleted row, so the filter can see it.

**An `if_convenient` column**, with a constraint stopping an item being both
urgent and not-urgent at once.

Nothing to check in the dashboard afterwards — but if clearing still doesn't
reach the other phone, confirm in the **SQL Editor** that
`select relreplident from pg_class where relname = 'list_items'` returns `f`.

---

## Round 7: shops, and what the app learns

One file, no re-seed. In the **SQL Editor**:

1. `supabase/migrations/0007_shops_and_learning.sql`

It adds three tables — `shops`, `item_stats` and `item_shop_order` — and two
functions. `ensure_default_shop()` gives the household a shop called "Main shop"
the first time the app asks, the same way `ensure_household()` works.
`record_shop()` is the one that does the learning: at the end of a shop it works
out roughly where in that shop each thing was picked up, updates how often and
how recently each thing gets bought, and deletes the ticked rows — all in one
transaction.

**Neither statistics table has an insert or update policy, and that is
deliberate.** `record_shop()` is `security definer`, so it is the only thing that
can write them. The app can read the numbers but cannot assert them.

Afterwards, check **Database → Replication**: `shops` should have joined the
`supabase_realtime` publication, so adding a shop on one phone shows up on the
other. The two statistics tables are deliberately *not* on it — they change only
at the end of a shop, and both phones re-read the list at that moment anyway.

### Nothing is lost if you don't run it

The app degrades on its own: no shops means the list falls back to the
hand-picked catalogue order, and no statistics means the "you usually need…"
strip never appears. Nothing breaks and nothing shows an error.

---

## Round 8: dishes

One file, no re-seed. In the **SQL Editor**:

1. `supabase/migrations/0008_dishes.sql`

It adds two tables and one function. `dishes` is the library — a name, a
picture, which part of a meal it is, how much cooking it takes — and
`dish_items` says which catalogue items each one is made of. Both belong to a
household outright: unlike the catalogue there is no shared seed here, so
`household_id` is never null and either of you can write, edit and delete any of
them.

`add_dish_to_list(dish uuid)` is what a tap on a dish tile calls. It inserts one
list row per ingredient, ignores the ones already on the list, counts the dish as
used, and returns how many rows it actually added — one round trip rather than
one per ingredient, and the count is the truth rather than the app's guess.

It shipped as a plain (invoker) function, on the principle that it needed no
privilege the caller hadn't already got. **Round 9 replaces it** with a
`security definer` version — see that section below for why — so if you are
setting a project up from scratch, the one that ends up installed is 0009's.

Afterwards, check **Database → Replication**: both `dishes` and `dish_items`
should have joined the `supabase_realtime` publication, so a dish written on one
phone appears on the other — ingredients included, since a tile that claims to
add four things has to be right about the four.

### Nothing is lost if you don't run it

The Meals tab shows an empty library and says so, the Dishes category never
appears in the shopping catalogue, and nothing anywhere shows an error.

---

## Round 8.1: a bigger catalogue

No new migration. One file to **re-run** in the **SQL Editor**:

1. `supabase/migrations/0003_catalogue_seed.sql` — regenerated, now 569 rows.

It inserts the 208 new items and updates the existing ones in place: the whole
file is one statement ending in `on conflict … do update`, so running it again
is safe and nothing you have is duplicated, renamed or reset. Anything your
household typed itself is untouched — those rows carry a `household_id` and this
file only ever writes the shared, `household_id is null` ones.

Nothing else changed in the database this round.

---

## Round 9: parts of a meal, and who asked for what

One file. In the **SQL Editor**:

1. `supabase/migrations/0009_dish_tags.sql`

It adds three tables. `dish_tags` is the household's own list of "part of a
meal" labels, each with a colour; `dish_tag_links` says which of them a dish
carries — many, not one; `list_item_dishes` records which dish put a thing on
the shopping list, and can hold two rows for one thing when two dishes share it.

**The colour is a name.** `colour` is checked against eight words, and the app
turns each into a pair of CSS variables. That keeps every colour in this project
inside one token file even when the user picked it, and it is what lets the
eight be checked for contrast in both themes.

**It also carries round 8's data across.** Every existing household gets the
three starting tags, and every dish with a `slot` of protein, carbs or
vegetables gets the matching one linked. `slot` is left on the table, holding
what it held, and never read again. Anything that was 'other' gets no tag, which
is right — 'other' never meant anything.

**`add_dish_to_list()` is replaced, and becomes `security definer`.**
`list_item_dishes` has no insert policy on purpose: a tag has to match the
dish's real ingredient list, not be something anyone can staple on. With the
function running as the caller, RLS applied to its own writes and the one thing
allowed to write that table could not. Escalating means the household check that
came free from RLS is made by hand instead — the `is_household_member` line in
the function — exactly as `record_shop()` does it.

Afterwards, check **Database → Replication**: `dish_tags`, `dish_tag_links` and
`list_item_dishes` should all have joined the `supabase_realtime` publication.
The last one matters most: list rows already arrive on the other phone that way,
and a row arriving without the tag that explains it reads as "nobody asked for
this".

### Nothing is lost if you don't run it

The Meals tab shows an empty chip row and the library goes uncoloured; the
shopping list simply never says which dish wanted what. Nothing errors.

---

## Round 11: the calendar, and Google

Two halves. The first is a migration like every round before it. The second is
new: a bit of setup in Google Cloud, so that Niu can write into your Google
Calendar. **The calendar works without the second half** — it just keeps its
events to itself.

### The migration

One file. In the **SQL Editor**:

1. `supabase/migrations/0012_calendar.sql`

It does four things:

- **People get names.** `household_members` grows `display_name`, `colour`,
  `avatar` and `email`, plus a policy that lets you edit *your own* row and
  nobody else's. Until now a member was a user id and nothing more, which is
  enough to keep two households apart and not enough to draw a face beside an
  event.
- **A join code.** `households.join_code` plus two functions,
  `household_join_code()` and `join_household()`. That is the invite flow round 2
  deferred: six characters read off one phone and typed into the other. There is
  no email invite because sending email needs a server, and this project has
  neither one nor a budget for one.
- **Events.** One `events` table covering both an event and a reminder, with
  `event_attendees` (who goes) and `event_confirmations` (who has said yes)
  beside it. All three carry `household_id` and all three have the full set of
  policies.
- **Sync bookkeeping.** `event_sync` records what your phone has already told
  Google, and `event_tombstones` remembers a deleted event's id long enough for
  the *other* phone to remove its copy too.

Afterwards, check **Database → Replication**: `events`, `event_attendees`,
`event_confirmations`, `event_tombstones` and `household_members` should all
have joined the `supabase_realtime` publication. Without the first three, an
event added on one phone doesn't appear on the other until a reload — and a
confirmation is exactly the thing that has to arrive by itself.

### Getting your wife into the household

Once the migration has run:

1. On your phone: **Settings → Add someone → Show the code.**
2. On hers: sign in with Google, then **Settings → Join a household**, type the
   six characters, tap **Join**.

Both of you then set a name, a colour and a face in **Settings → You**. The
colour is what tells you apart on the calendar, so pick two that aren't
neighbours.

### The Google Calendar half

This is a one-time setup in the Google Cloud console — the same project the
Google sign-in already uses.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and pick
   the project you made in step 3 near the top of this file.
2. **APIs & Services → Enabled APIs & services → + Enable APIs and services.**
   Search for **Google Calendar API** and enable it.
3. **APIs & Services → OAuth consent screen → Data access** (older consoles call
   it "Scopes"). **Add or remove scopes**, then paste this into the filter box
   and tick it:

   ```
   https://www.googleapis.com/auth/calendar.app.created
   ```

   That scope means "make secondary calendars and manage events on them". It is
   the *only* calendar permission Niu asks for, and it is why Niu cannot read
   your work meetings — not "does not", cannot.
4. **APIs & Services → Credentials.** Open the **OAuth 2.0 Client ID** of type
   *Web application* that Supabase's Google sign-in uses. Under **Authorised
   JavaScript origins**, add both of these:

   ```
   https://marxal.github.io
   http://localhost:5173
   ```

   This is the step that is easy to miss. The redirect URI you set up for
   Supabase is a different setting; a token requested from the page itself needs
   the *origin* to be listed too, and without it Google refuses with an error
   that doesn't say why.
5. Still on that page, copy the **Client ID** — it looks like
   `1234567890-abc123.apps.googleusercontent.com`. Paste it into `.env` in the
   repo, after `VITE_GOOGLE_CLIENT_ID=`, and let it deploy.

Then on the phone: **Settings → Google Calendar → Connect Google Calendar.**
Google will ask once. The first time it will also warn that the app isn't
verified — that is expected for an app used by two people (see NIU.md §9);
tap **Advanced** and continue.

Niu makes a calendar called **Niu** in your Google account and writes into it.
Each of you gets your own copy: the scope above cannot share a calendar with
anyone else, which is exactly the same property that stops it reading yours.

### Why there is a Sync button rather than silent syncing

Google only hands a token to a page that asked for one because somebody tapped,
and a token lasts an hour. So the first sync after opening the app is a tap, and
everything for the next hour goes across on its own. That is why the calendar
screen shows a **Sync 3** pill instead of pretending it is automatic.

Nothing is lost while it is unsynced. Niu's own database is the truth; Google is
a copy.

### Nothing is lost if you don't run it

Skip the migration and the Calendar tab shows an error line and stays empty;
everything else works exactly as before. Skip only the Google half and the
calendar works fully on both phones — it just never reaches Google, and the
Settings card says so.

---

## Round 11.2: people without accounts, and photos

Two steps, and **the first one is not SQL** — it has to be done by hand before
the migration will make sense.

### 1. Make the photo bucket

In the Supabase dashboard: **Storage → New bucket.**

- Name it exactly `avatars` — the app and the policies both use that word.
- Leave **Public bucket** switched **off**.

Private rather than public, deliberately. These are photographs of a family
including children, and a public bucket means anybody holding the address can
view them forever, with no way to take it back. Private means the app asks for a
link that expires after an hour. That costs one extra call when the app loads
and it is the right way round for this content.

### 2. Run the migration

In the **SQL Editor**:

1. `supabase/migrations/0013_people_and_photos.sql`

It does four things:

- **A `household_people` table**, where `user_id` is *nullable*. That one nullable
  column is the whole round: a person with an account and a person without are
  the same kind of row, and having an account is a property rather than a
  category. `household_members` keeps its old job and only that job — it is the
  *access* record that Row Level Security reads; `household_people` is the
  *identity* record, the name and the face.
- **Your existing profiles are carried across.** The name, colour, avatar and
  email that round 11 put on `household_members` are copied over. The old
  columns are left in place rather than dropped, so a phone still running the
  previous version does not suddenly show blanks.
- **Attendees now point at people**, not at accounts. `event_attendees.user_id`
  becomes `person_id`, backfilled in the same file so there is never a moment
  with two sources of truth. Confirmations are deliberately left alone: only
  somebody with an account can be asked to confirm anything.
- **Storage policies for the bucket** you just made.

Afterwards, check **Database → Replication**: `household_people` should have
joined the `supabase_realtime` publication, so a face added on one phone appears
on the other without a reload.

### The path is the permission

Every photo is stored as `household_id/person_id.jpg`, and every Storage policy
reads the household out of that first folder. That is not a naming convention —
it is the security model. If the path shape ever changes in the app without
changing it in the migration, the policies stop matching and the bucket stops
being protected the way it looks like it is.

### What you can and cannot edit

The database enforces three things, so the app does not have to be trusted with
them:

- Anyone in the household can rename, dress or remove a person **without** an
  account. They belong to the household.
- Only *you* can edit your own row. Your partner cannot rename you.
- Nobody can delete a person **with** an account from here. Leaving a household
  is its own act, not something a housemate does to you.

### Nothing is lost if you don't run it

The Calendar tab's "who goes" row and the whole Settings people card stop
loading and show a short line instead. Everything else — the list, the planner,
the events themselves — carries on. Skip only the bucket and everything works
except choosing a photo, which reports that it couldn't be saved.

## Round 12: repeating events

One file to run in the **SQL Editor**, and nothing else — no bucket, no
settings page:

1. `supabase/migrations/0014_recurrence.sql`

### What it adds

Four columns on `events`, and no new table:

- `series_id` — null for an ordinary one-off. Every occurrence of *"every
  Sunday, ten times"* carries the same value.
- `series_index` and `series_count` — which one this is, out of how many. What
  "number 3 of 10" in the sheet reads off.
- `series_rule` — `daily`, `weekly`, `fortnightly` or `monthly`.

Plus two check constraints and one partial index on `(household_id, series_id)`.

### Why there are ten rows and not one rule

The usual way to store a repeating event is one row with a rule on it, expanded
whenever something needs to draw a calendar. It is how Google does it, and it is
why Google's API has `recurringEventId`, instance ids and a vocabulary for
"this occurrence is an exception".

Niu writes the ten rows instead. Each one is an ordinary event that happens to
share a `series_id`, which means everything built before this round keeps working
untouched — the grid draws them, Row Level Security protects them, attendees and
confirmations attach to them, and the Google push sends ten ordinary events. An
occurrence you edited on its own is not an "exception" here; it is just a row
with different values in it.

The price is that a series is **finite**: the app caps one at 60 occurrences.
"Every Monday forever" cannot be written down. NIU.md §4.3 asked for the finite
version — "repeats X times per week or month; ends after X times" — so that is
the shape of the feature rather than a corner cut around it.

### No new policies, and that is not an oversight

`CLAUDE.md`'s first rule is that a new table means a new RLS policy in the same
commit. There is no new table here — these are columns on `events`, which has
had its four policies since round 11 and applies them to every row whatever is
written in these columns. A series is not a new kind of thing to protect; it is
ten of the thing that was already protected.

### Nothing is lost if you don't run it

The calendar carries on exactly as it did in round 11: the app reads the four
columns and treats a missing one as "this is a one-off". What breaks is *making*
a repeating event — the insert is rejected because the columns are not there, and
the sheet reports that it couldn't save. Everything else in this round (the dots
in the month grid, the swipe, the week numbers, the optional start time) is front
end only and works with or without the migration.

## Round 17: notifications on the phone

This is the longest setup in the project, because it is the only round with a
piece that runs on a server. Four steps, all in the Supabase dashboard, and
none of them costs anything: Edge Functions are on the free plan with 500,000
calls a month included, and this household will use a few hundred a year.

Do them in this order. Nothing breaks if you stop halfway — the app carries on
exactly as it does today, in-app badge and all, until the last step is done.

### 1. Run the migration

`supabase/migrations/0016_push.sql`, in the SQL editor, same as every round. It
adds two tables and a trigger, and turns on `pg_net` — the extension that lets
Postgres make an HTTP call.

Nothing happens yet: the trigger checks for a configuration row that does not
exist and returns quietly.

### 2. Deploy the function

**Edge Functions → Deploy a new function.** Name it exactly **`niu-push`** —
the URL is built from that name. Paste the contents of
`supabase/functions/niu-push/index.ts`.

Then, in that function's settings, **turn Verify JWT off**. This is the one
setting that is easy to get wrong and the symptom is silence. The caller here is
Postgres, which has no user session and therefore no JWT to send; the function
authenticates the call with a shared secret header instead, which step 4 sets up.

### 3. Give the function its keys

**Edge Functions → Secrets**, three of them:

| Name | Value |
|---|---|
| `NIU_VAPID_KEYS` | the entire contents of `vapid-keys.local` in the repo folder, pasted as one blob |
| `NIU_PUSH_SECRET` | a long random string you invent. It only has to match step 4 |
| `NIU_CONTACT_EMAIL` | your email address |

`vapid-keys.local` holds the key pair that signs every notification. It is
**not** in git and must never be — the `.local` ending is in `.gitignore` for
exactly this reason. Its public half is already in `.env` as
`VITE_VAPID_PUBLIC_KEY`, which is public by design; the private half exists in
that one file and, after this step, in Supabase.

If you ever lose the file, generate a new pair and update both places. Every
phone then has to turn notifications on again, because their subscriptions were
signed with the old key.

### 4. Tell the database where the function is

One row, in the SQL editor. Replace both values:

```sql
insert into public.push_config (id, function_url, shared_secret)
values (
  true,
  'https://YOUR-PROJECT-REF.supabase.co/functions/v1/niu-push',
  'THE-SAME-RANDOM-STRING-AS-NIU_PUSH_SECRET'
)
on conflict (id) do update
  set function_url = excluded.function_url,
      shared_secret = excluded.shared_secret;
```

The project ref is the same one in `.env` under `VITE_SUPABASE_URL`.

That table has Row Level Security on and **no policies at all**, which means
nothing reachable through the API can read it — not the app, not you signed in,
not `anon`. The only thing that sees the secret is the trigger function, which
runs as its creator. That is the whole reason it is a table rather than a value
pasted into the migration: this repo is public.

### 5. On the phone

Notifications only work in the **installed** app on the real site. Not the dev
server — `src/lib/pwa.ts` deliberately does not register a service worker there,
and there is no worker to receive a push. If Niu is open in a browser tab rather
than from the home screen, install it first.

**Settings → Notifications → Turn on notifications.** Android asks once. Say
yes on both phones.

### What actually buzzes

Two things, and deliberately only two (Marçal, round 17):

- somebody asks you to confirm an event
- somebody answers a request you sent

Not every event the other person adds, and nothing from the shopping list. A
notification you learn to ignore is worse than no notification, and the second
one to arrive is the one that teaches you to ignore the first.

Moving an event's day, time or place clears the answers and asks again, so that
buzzes too — which is the point, since a yes to Thursday is not a yes to
Saturday.

### Nothing is lost if you don't run it

Every step degrades to silence rather than to an error:

- **No migration**: the Notifications card offers the switch, saving the
  subscription fails, and the card says it couldn't write it down.
- **No function**: the trigger calls a URL that isn't there. `pg_net` queues the
  call, nobody answers, and the event saves normally.
- **No config row**: the trigger returns without calling anything.
- **Nobody subscribed**: the function finds no rows and returns.

Throughout, the confirmation still arrives in the app and still puts a red
number on the Calendar tab, exactly as it has since round 11. The notification
is a faster route to the same question, not a replacement for it.

## Round 17.1: Yes / Can't from the notification itself

An addition to round 17, not a new round of setup from scratch. The
notification for "somebody is asking you to confirm" now carries two buttons —
answering taps one, and never opens the app.

The tricky part is not the buttons; Android draws those for free. It is that
tapping one has to write your answer to the database, and normally *that*
needs you logged in — which the whole point here is to skip. So the function
signs a small proof into the notification itself when it sends it: this
event, this person, valid for a day. The button's tap is just handing that
proof back; possessing it is what stands in for a login.

### What to do

**1. Redeploy the function.** Same place as before — **Edge Functions →
niu-push → Code** (or delete and redeploy) — paste the current contents of
`supabase/functions/niu-push/index.ts` over what's there. It grew a second
route in the same file; nothing about how it's deployed changes.

**2. Add a fourth secret.** **Edge Functions → Secrets**:

| Name | Value |
|---|---|
| `NIU_ACTION_SECRET` | a second long random string, different from `NIU_PUSH_SECRET` |

Different on purpose: one secret proves "this call came from Postgres", the
other proves "this button tap came with a genuine invitation to answer". A
leak of one must not also forge the other.

**3. Nothing else.** No migration, no change to `push_config` — the confirm
route writes to `event_confirmations` exactly the way the app's own Yes/Can't
buttons already do, which is what makes the other phone's notification still
arrive: the same database trigger fires either way.

### Nothing is lost if you skip this

Without `NIU_ACTION_SECRET` set, the function simply sends notifications
without the action buttons — tapping one opens the app to the pinned question,
same as round 17 shipped. Nothing breaks; the phone just falls back to the
one-more-tap version automatically, because the notification never claims to
have buttons it can't back up.

### Fix: the buttons opened the app instead of answering

Found the same day, testing on a real phone. Yes/Can't were reaching the
notification but tapping either one just opened the app — because the phone
was making a cross-origin call to the Edge Function, and browsers refuse that
by default unless the server explicitly says it's expected (CORS). Postgres
calling the trigger route never hit this — a server calling a server isn't
subject to it — so it was invisible until a phone called `/confirm` directly.

**Redeploy the function once more** with the current
`supabase/functions/niu-push/index.ts` — same paste-over-the-code step as
above. No new secret this time, and the notification badge shipped in the
same update: the app icons are solid, fully-opaque images built for the home
screen, and Android draws a badge from an image's *transparency*, so they came
out as a plain white blob. `npm run icons` now also writes
`public/icons/badge-96.png`, a proper mostly-transparent silhouette, already
wired into `public/sw.js` — pushing this branch to `main` is what puts it live.
