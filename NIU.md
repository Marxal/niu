# Niu — project context and build plan

> Standing context for the Claude Project. Everything decided so far, why it was decided,
> and the order we're building it in. Written 25 Aug 2026, from Marçal's answers to the
> project brief.
>
> **This is a living document.** When a decision changes, change it here. When Claude Code
> finishes a round, the detail goes in `ROADMAP.md` in the repo — this file stays the
> big picture.

---

## 1. What Niu is

A family organiser, built as an installable PWA and optimised for an Android phone. Three
features that share one household:

1. **A shopping list** — Bring-style tile grid, with an app that learns what you buy and
   in what order you walk the shop.
2. **A meal planner** — a week of meals built from a library of dishes, connected to the
   shopping list in both directions.
3. **A shared calendar** — family events, pushed to one shared Google Calendar so they
   appear on everyone's phone.

Personal use first: Marçal and his wife, both on Android, in Gothenburg. Built so that
turning it into a real product later stays possible, but not designed for that today.

**Zero budget.** Nothing in this project costs money. Any proposal that would must be
flagged before it's built.

### The name

**Niu** — Catalan for *nest*. Two syllables, no awkward sounds in English or Swedish.

This is the **working codename**, and it may or may not become the public name. It is
therefore baked in permanently and deliberately: the repo is `niu`, every storage key is
prefixed `niu.`, the database schema uses it. If we rename the product later, we rename
the wordmark and the title — **never the storage keys**. Bito Chess learned this the
hard way; its repo is still called `obertura`.

---

## 2. How Marçal and Claude work together

Marçal is a freelance WordPress developer and graphic designer. He is fluent in design
and comfortable around web tech, but **he does not write code and does not want to**.
He understands concepts, not syntax. He directs; Claude builds and explains; he tests on
his phone and says how it should behave.

- **Lead with the answer**, then brief reasoning. No long preambles.
- **Explain decisions and trade-offs as we go** — teach, but keep it short.
- **One layer at a time.** Every round ends with something he can open on his phone,
  and instructions for exactly how to test it.
- **Flag uncertainty honestly.** Never invent a library API. If unsure, say so or look
  it up.
- **Push back on scope creep.** He asked for this explicitly.
- **Never reach for a paid service without flagging it first.**
- Default language English; he may write content in Catalan, Swedish or Spanish.

### Working environment

- **Claude Code on the web** (claude.ai/code), against a GitHub repo. No local install.
- **GitHub Pages** serves the built app at a public URL; he opens it on Android and
  "Add to Home screen".
- Claude Code, chat and Design share one Pro usage pool. **One task per chat** to keep
  context and token cost low.

---

## 3. Locked technical decisions

| Layer | Decision | Why |
|---|---|---|
| Shape | Installable PWA, static build | Free, instant phone testing, no app store |
| Build | **Vite + TypeScript** | Same as Bito Chess, proven in this workflow |
| Framework | **Svelte 5** (runes), plain SPA — no SvelteKit | See below |
| Styling | **Scoped CSS per component + a small token file.** No CSS framework | Design-led app; Marçal must be able to read a component |
| Database & auth | **Supabase** (Postgres, Auth, Realtime, Row Level Security) | Free tier covers this easily; realtime does the two-phones-one-list job with no extra machinery |
| Sign-in | **Google only** | Needed anyway for Calendar; one less thing to build |
| Sync | **Server-first**, with Supabase Realtime subscriptions | Marçal's call. Simpler. Costs offline — see §9 |
| Conflicts | **Last write wins** | Marçal's call. Acceptable for two people |
| Hosting | **GitHub Pages**, public repo | Free. Pages on private repos needs a paid plan |
| Domain | None. `marxal.github.io/niu` | Revisit only if this ever goes public |
| Icons | Open-source set + emoji + first-letter fallback | See §6 |
| Offline | Not in v1 | Follows from server-first |
| Push notifications | **v2** | v1 leans on Google Calendar's own reminders |
| Tests | Self-tests for pure logic only | The ranking, the shop-order learning, the stock inference, the quick-add date parser |

### Why Svelte and not vanilla TypeScript

Bito Chess is vanilla TS with hand-built DOM, and that was right for a chess board. Niu
is different: three screens of lists that change constantly and must redraw themselves
whenever a sync message arrives. Written by hand, that's a lot of code whose only job is
keeping the screen in step with the data — and it's where the stale-list bugs live.

Svelte does that job for free, in about half the code, and a Svelte component reads like
HTML with real CSS underneath it, which matters because Marçal needs to be able to open
a file and understand what it does.

**The one risk, stated honestly:** Svelte 5's syntax (runes: `$state`, `$derived`,
`$effect`) is newer than React's, so there's more chance of an AI writing the older
Svelte 4 patterns by mistake. `CLAUDE.md` pins this explicitly. If it turns out to cause
friction in the first two rounds, switching to Preact or React is cheap at that stage
and expensive later — so we decide by round 3, not round 10.

---

## 4. The three features

### 4.1 Shopping list — the first thing we build

**One list**, shared by the household, always.

**The catalogue is the point.** 300+ pre-seeded grocery items, grouped in supermarket
categories. You almost never type — you tap a tile and it moves to the list. Because of
that, an item can't be added twice; tapping it again does nothing. Quantity is an
optional edit afterwards, not a step in adding.

- **Item fields:** name (required). Optional: quantity, unit, free note, urgency flag,
  who added it.
- **New words:** typing something the catalogue doesn't know adds it immediately, with a
  generated first-letter tile as its icon. Choosing a proper icon is something the user
  can do later, never a blocking step.
- **Default view:** grid of tiles. Easy to switch to a list.
- **Ticking off:** the tile greys out and drops into an "in the trolley" section below.
- **Default sort while shopping:** the order you walk the shop, learned from the order
  you tick things off. Easy to switch to: most recently added, most frequent, by category.
- **No separate "shopping mode."** One list, always the same.
- **Multiple shops.** One main shop, others can be added. Each learns its own order.
- **When someone else adds something:** it appears with a **NEW** tag. No notification.
- **Suggestions, never auto-add.** A quiet "you usually need…" strip. The user always taps.
- **Dishes appear in the catalogue as their own category.** Tapping a dish adds all its
  items to the list at once. This is the bridge to the meal planner — see §4.2.

### 4.2 Meal planner

**There is only one concept: a dish.** (The brief used the words "dish" and "bundle" —
drop "bundle", it was confusing and it wasn't a real distinction.)

A **dish** is:

- a name,
- an icon or emoji,
- a slot type (protein / carbs / vegetables / other),
- flags: needs cooking, fast cook, slow cook, no cook,
- **and optionally, a list of shopping items.**

If the item list is empty, the dish is just a name you can plan a meal with. If it has
items, it becomes a bundle in the shopping list too, and it works in **both directions**:

- **Plan → shop.** Add "Lasagne" to Thursday, and the app asks: *add the four missing
  ingredients to the list?*
- **Shop → plan.** "Lasagne" also sits in the shopping catalogue as a tappable tile that
  adds its ingredients in one go.
- **Stock → plan.** Later, once the app has purchase data, it can favour dishes whose
  ingredients it thinks are already in the house.

Cooking instructions are explicitly **not** a feature. If a note is ever needed, it's a
notes field.

**Structure:** meals per day are configurable, defaulting to lunch and dinner. Slots
inside a meal are configurable, defaulting to protein / carbs / vegetables. A meal can
also be a single dish rather than three slots.

**Views:** vertical scrolling days by default (the Daily Meal Planner shape), with a
switcher to week and month.

**Adding:** tap a slot, pick from the library sorted by most-used. Dragging to move and
rearrange dishes across days is wanted, at least for editing an existing plan.

**A slot can hold a plain shopping item, not only a dish** (Marçal, after round 8).
"Broccoli" on a Tuesday is a complete thought and should not need a dish written for it
first. So the picker on a slot offers both: the dish library, and the catalogue behind it.
A slot therefore points at *either* a dish or a catalogue item — worth knowing before the
planner's schema is written, because retrofitting it is a table change.

**Planning horizon:** a week.

**"Shop for this week"** — one button, turns the week's plan into shopping list entries.

**Markers:** leftovers, eating out.

**Repeats are normal in this household** and must not be discouraged. The app should not
avoid recent dishes. It should instead learn the *cook-then-repeat* rhythm: the first
appearance of a dish is a cook, an immediately following one is a repeat. Worth surfacing
visually so the plan reads correctly at a glance.

**Auto-suggest a week:** yes, once there's enough data. The user always approves.

### 4.3 Calendar — built last

**Our database holds the truth.** Niu owns the events. It pushes them **one way** to a
single shared Google Calendar called "Niu" that both accounts subscribe to. It does not
read work meetings or other calendars back in — family events only.

This is a much simpler arrangement than two-way sync, and it's only possible because
Marçal said he doesn't want other calendars shown. Keep it that way unless he changes
his mind, because two-way is a different project.

Nice side effect: **reminders come free.** Because every event lands in a real Google
Calendar, Google's own notifications fire on both phones without us building push.

- **Default view:** month grid.
- **Event fields:** title, date, start/end time, all-day, multi-day (for holidays),
  who's involved, location, notes, colour/category, reminder, repeat, link.
- **Adding an event** is where Google is worst and where we earn our keep. Target flow:
  tap a day → type a title → set a time → tap avatars → done, with everything else
  behind one more tap. Typed quick-add ("Thursday 18:30 dinner") is wanted if it can be
  made reliable; the structured flow is the fallback and must be excellent on its own.
- **Who's involved:** a row of avatars you tap. None selected is fine and means everyone.
- **Recurrence, simplified:** repeats X times per week or month; ends after X times.
  Deleting asks: this one, or all of them? Full RRULE support is not a v1 goal.
- **Colour:** categories have colours *and* people have colours, and the two must be
  visually distinguishable — e.g. category as the event's fill, person as an avatar ring.
- The meal plan does **not** appear in this calendar. It has its own.

---

## 5. What the app learns

Two separate mechanisms. Keeping them separate matters.

**1. Suggestion ranking** — which items float to the top when adding.
Fed by: how often an item is added, how recently, and the typical gap between purchases
(so it can say "probably due"). Weekly shopping means patterns emerge fast.

**2. Shop order** — how the list is sorted while shopping.
Fed by the order items are ticked off. Each shop keeps its own order. A running average
of each item's tick position, per shop.

Both are ordinary arithmetic, not AI, and both run on the device against synced data.

### Stats, not a log

Marçal said no purchase history. That conflicts with wanting "due" predictions and
inferred stock, which both need past purchases — so here is the resolution:

**We keep per-item statistics, not a browsable history.** On each catalogue item:
times bought, last bought at, previous bought at, a rolling average gap in days, and a
rolling average tick position per shop. That's a handful of numbers per item. There is
no "your shopping history" screen and no per-purchase records to scroll through.

If a real history screen is ever wanted, it's a new decision and it needs real records.

### Stock inference (later, not v1)

The hybrid model: the app infers what's probably in the house from what was bought and
how long that kind of thing lasts, and offers a one-tap **"actually, we're out"**. The
correction is the important half — it's what teaches the shelf-life guess.

This needs months of data before it says anything useful. It is deliberately late in the
roadmap and it must never block anything earlier.

---

## 6. Icons

Marçal chose an open-source set, with emoji filling the gaps and a budget of up to €15
for a paid set if needed.

**Honest position: there is no good open-source icon set built for groceries.** General
sets (Lucide, Phosphor, Tabler) have an apple and a carrot and then nothing. Paid sets in
the €15 range usually forbid redistributing the SVGs inside an app, which is exactly what
we'd be doing.

**The candidate is [OpenMoji](https://openmoji.org)** — a genuinely open (CC BY-SA 4.0)
set of several thousand icons, including deep food coverage, available in both colour
and **black line** versions. The line versions, white on a coloured tile, land very close
to Bring's look. Bundling them also fixes emoji's real weakness: consistent rendering on
every device rather than whatever the phone happens to draw.

**This needs verifying before we commit** — licence terms, exact food coverage, and how
the attribution requirement plays out if Niu is ever sold. That verification is a task in
the icon round, not an assumption to build on. The €15 probably isn't needed.

Fallbacks, in order: a mapped icon → an emoji the user picked → a generated first-letter
tile in the item's category colour.

---

## 7. Data model — first sketch

Not final. Enough to build round 3 against.

**Household and people**

- `households` — id, name
- `members` — id (= Supabase auth user), household_id, display_name, colour, avatar_url
- Everything below carries `household_id`, and Row Level Security enforces that you can
  only ever read rows from your own household. The database does this, not the app.

**Shopping**

- `categories` — id, household_id, name, colour, position
- `items` — the catalogue. id, household_id, name, icon_ref, category_id, plus the stats
  from §5 (times_bought, last_bought_at, prev_bought_at, avg_gap_days)
- `shops` — id, household_id, name, is_default
- `item_shop_order` — shop_id, item_id, avg_position (the learned aisle order)
- `list_entries` — what's on the list right now. id, household_id, item_id, qty, unit,
  note, urgent, added_by, added_at, checked_at, checked_by

**Meals**

- `dishes` — id, household_id, name, icon_ref, slot, cook_flags, times_planned,
  last_planned_at
- `dish_items` — dish_id, item_id
- `meal_slots` — id, household_id, date, meal, slot, dish_id, is_leftover, is_eating_out,
  note

**Calendar**

- `events` — id, household_id, title, starts_at, ends_at, all_day, location, notes,
  category_id, created_by, google_event_id, repeat_rule
- `event_members` — event_id, member_id
- `event_categories` — id, household_id, name, colour

---

## 8. Design direction

Marçal's answers: Bring's bold shapes, but combined with Nordic quiet and warmth. **No
cream palettes. No over-saturated colour.** Very rounded, pill-like. Generous touch
targets. One identity with a signature colour per module. Follows the system theme.
Satisfying motion — things fly into the basket, the empty list celebrates. Copy is a
little witty. Accessibility floor is contrast (keyboard focus and reduced-motion come
along for free).

Navigation: a bottom bar with three tabs plus settings. No "today" dashboard — the app
opens on the shopping list. When the list is empty, that empty state does the work a
dashboard would: tonight's dinner, today's events, and a good line of copy.

**Working method: design in code.** Claude builds, Marçal reacts on his phone, we
iterate. He'll make the app icon and wordmark himself; a placeholder ships first.

Claude proposes the first palette and type pairing and expects to be redirected. Whatever
lands, it lives in **one token file** — no raw hex anywhere in a component.

---

## 9. Known limits and things we've deliberately deferred

- **No offline.** Server-first means no signal, no list. Marçal said fine; he also said
  he wasn't sure offline was even possible in a web app — it is, via a service worker and
  a local copy, and it's a real option later. But it's the change that costs the most to
  retrofit, so if the app ever feels broken in a supermarket, this is the first thing to
  revisit. **Flag it the first time it bites.**
- **No push notifications in v1.** Calendar reminders come from Google Calendar itself.
- **Last write wins.** If both phones edit the same item in the same second, one wins.
  Fine for two people; the first thing to fix if the household grows.
- **No purchase history**, only per-item stats (§5).
- **No photos, no desktop layout** in v1 — explicitly ruled out.
- **Supabase free projects pause after 7 days with no database activity.** Daily use
  keeps it awake. Two weeks on holiday and the first launch back takes ~30 seconds to
  wake up. Not a problem, just a thing to recognise rather than debug.
- **The Google OAuth consent screen must be published to "Production"** (unverified) for
  tokens to behave normally — in "Testing" mode Google expires them every 7 days. This
  shows a "Google hasn't verified this app" warning the first time each person connects,
  and caps the app at 100 users. Fine for two. To sell Niu one day, we'd need Google's
  verification review.
- **Svelte 5 syntax risk** — see §3. Decide by round 3.

---

## 10. Roadmap

Every round ends with something installable on the phone. Detail lives in `ROADMAP.md`
in the repo; this is the shape.

| # | Round | Ends with |
|---|---|---|
| 0 | **Setup** — accounts and empty repo | Marçal has a GitHub repo, a Supabase project and a Google Cloud OAuth client |
| 1 | **Skeleton** — Vite + Svelte + PWA + Pages deploy | A Niu icon on his home screen. Three empty tabs. Proves the whole pipeline |
| 2 | **Sign in + household** — Google auth, household, invite by email, avatars. Plus a throwaway spike that writes one test event to Google Calendar, purely to de-risk §4.3 early | Both of them sign in and see each other |
| 3 | **The shopping list** — catalogue, categories, tile grid, tap-to-add, trolley, realtime sync. Likely two or three rounds; it's the biggest single piece | A shopping list they actually use |
| 4 | **Order and learning** — shop order, per-item stats, the suggestions strip, multiple shops | The list starts sorting itself sensibly |
| 5 | **Dishes** — dish objects, the dishes category in the catalogue, tap-a-dish-adds-its-items | Bundles working from the shopping side |
| 6 | **Meal planner** — day/week views, slots, plan-to-list, repeat and leftover markers, auto-suggest | A planned week that fills the shopping list |
| 7 | **Calendar** — events, month grid, quick add, avatars, one-way push to the shared Google calendar | Shared family events on both phones |
| 8+ | Stock inference, offline, push, export, icon upgrades | As they earn their place |

Marçal said the smallest version he'd genuinely use daily is "v0.6" — effectively the
whole thing. That's the destination, not the first useful moment: **the app becomes
genuinely useful at round 3** and everything after that improves an app already in daily
use. Worth remembering when round 4 feels slow.

### Model guidance for Claude Code

- **Sonnet 5** — the default for building rounds. Fast, cheap against the shared Pro pool.
- **Opus 5** — for architecture rounds: the database schema and RLS (round 2/3), the
  learning algorithms (round 4), the Google Calendar integration (round 7), and any time
  something's gone wrong twice and needs actual thinking.
- **Haiku 4.5** — small mechanical edits, renames, copy changes.

---

## 11. Questions still open

1. **Quick-add typing** — "Thursday 18:30 dinner" is wanted but reliable natural-language
   date parsing in four languages is a real project. Decide in round 7 whether it's a
   nice-to-have on top of an excellent structured flow, or a requirement.
2. **Dragging in the meal planner** — wanted for rearranging, unclear whether it's needed
   for the initial add. Decide when round 6 has something to drag.
3. **Icon set** — verify OpenMoji's licence and food coverage before committing (§6).
4. **When "who added it" is shown** — Marçal said "in some situations, decide later".
5. **Catalogue language** — English at launch, with users free to type Catalan. Whether
   the seeded catalogue ships in more than one language is a round-3 decision.
