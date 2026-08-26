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

**It is deliberately not `security definer`**, unlike `record_shop()`. It needs
no privilege the caller hasn't already got: RLS on `dishes` hides another
household's dish from it, and every insert goes through the list's own insert
policy. A function that doesn't need to escalate shouldn't.

Afterwards, check **Database → Replication**: both `dishes` and `dish_items`
should have joined the `supabase_realtime` publication, so a dish written on one
phone appears on the other — ingredients included, since a tile that claims to
add four things has to be right about the four.

### Nothing is lost if you don't run it

The Meals tab shows an empty library and says so, the Dishes category never
appears in the shopping catalogue, and nothing anywhere shows an error.
