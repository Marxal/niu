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
