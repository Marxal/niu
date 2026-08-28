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
- **any number of "part of a meal" tags** — the household's own list, each with a
  colour, seeded with Protein / Carbs / Vegetables and editable from there.
  (Round 9 changed this. It began as one slot out of protein / carbs /
  vegetables / other, and both halves were wrong: a lasagne is protein *and*
  carbs, and "other" was a shrug rather than an answer.)
- how much cooking it takes: **no cook / quick / slow**. (§4.2 first listed four
  flags — needs cooking, fast, slow, no cook — but "needs cooking" is exactly
  "fast or slow", so it is one question with three answers.)
- **and optionally, a list of shopping items.**

If the item list is empty, the dish is just a name you can plan a meal with. If it has
items, it becomes a bundle in the shopping list too, and it works in **both directions**:

- **Plan → shop.** Add "Lasagne" to Thursday, and the app asks: *add the four missing
  ingredients to the list?*
- **Dish → shop.** "Lasagne" also sits in the shopping catalogue as a tappable tile that
  adds its ingredients in one go. Anything a dish put on the list wears a small tag
  saying which dish wanted it, and an ingredient two dishes share wears both.
- **What you have → plan.** Round 10, and cheaper than §5 assumed. It does *not* guess what is in
  the house — that is stock inference, still deferred below. It answers a smaller
  question with data the app already has: how many of a dish's ingredients are on the
  list right now, or were bought in the last few days (`last_bought_at`, kept since
  round 7). That shows as "4 of 5" beside every dish in the picker, and as a "What can we
  make?" sheet in the planner. Both halves are needed: on shopping day the list is the
  answer, and the morning after — when the list is empty and the food is in the fridge —
  the recent purchases are.
- **Stock → plan.** Later still, once there are months of data: favouring dishes whose
  ingredients it *infers* are in the house, with shelf-life learning behind it. Round
  10.1's "What's home" is the honest half of this and stops deliberately short of it — it
  counts purchases and never models shelf life, so a fish and a bag of rice bought the
  same day are treated identically. Its two bands (bought this week / double-check) come
  from each item's own purchase rhythm, and the "out of it" correction on a double-check
  row is exactly the signal §5 says would eventually teach the shelf-life guess.

Cooking instructions are explicitly **not** a feature. If a note is ever needed, it's a
notes field.

**Structure:** meals per day are configurable, defaulting to lunch and dinner.

**A meal is a bag, not a set of slots** (Marçal, round 10). This section used to say
slots inside a meal were configurable and defaulted to protein / carbs / vegetables —
but round 9 had already turned exactly those three words into *dish tags*, free-form and
several per dish. Keeping both would have been two systems for one idea, and would have
forced every lasagne to choose between being protein and being carbs. So a meal holds
any number of entries in the order you put them there, each carrying its own colour from
its dish's tags. "A protein, a carb and a vegetable" is now something you can *see*
rather than a shape you must fill, and a meal that is one dish is simply a meal with one
thing in it.

**Views:** vertical scrolling days by default (the Daily Meal Planner shape), with a
switcher to week. A month view is still wanted but was deferred out of round 10: on a
412px screen it can only be coloured dots, which answers "what did we eat a fortnight
ago" rather than a daily question.

The day view starts at **today** in the current week (round 10.1) — planning Monday's
dinner on Wednesday is not a thing anyone does. Other weeks show all seven days, and so
does the week view always, because its job is the shape of the whole week.

**Adding:** tap a meal, pick from the library sorted by most-planned. The picker leads
with dishes whose ingredients are already to hand — see "What you have → plan" above.

**Moving:** long-press a card and drag it (Marçal, round 10, choosing this over the
safer tap-to-lift-tap-to-drop). The week view exists partly for this: seven days on one
screen means the card only has to travel an inch. **Removing:** swipe the card sideways,
with an Undo in the message afterwards (round 10.1).

**A meal can hold a plain shopping item, not only a dish** (Marçal, after round 8; built
in round 10). "Broccoli" on a Tuesday is a complete thought and should not need a dish
written for it first. So the picker offers both: the dish library, and the catalogue
behind it.
An entry therefore points at *either* a dish or a catalogue item, and `meal_entries.kind`
in 0010 is what keeps the two straight.

**Planning horizon:** a week — but any week. The stepper goes back and forward
indefinitely and old weeks stay readable, which is where "what did we have on Tuesday"
gets answered.

**"Shop for this week"** — one button, turns the week's plan into shopping list entries.
Since round 10.1 it opens a list you **tick**: half of deciding what to buy is deciding
what you already have enough of. Beside it sits **"What's home"** — the same question from
the other end, read off purchases rather than off the plan. The two overlap with "What can
we make?" on purpose for now; which of them earns its place is a decision for after they
have been used.

**Markers:** leftovers, eating out. Both are *kinds of entry* rather than dishes you have
to write first, and neither ever puts anything on the shopping list — which is the point
of them. A leftovers entry may name the dish it is left over from.

Plus a third, different in kind: **cook it**, a hand-set mark meaning somebody has to cook
this tonight (round 10.1). Not the dish's own `cook` value, which describes the recipe
forever; not a fourth marker, because a plain item can need cooking too. Deliberately set
by hand rather than inferred — the planner already infers the *opposite* mark, the repeat,
and if both were automatic every card would be asserting something about cooking. The
value of this one is that it is a note you left yourself.

**Repeats are normal in this household** and must not be discouraged. The app should not
avoid recent dishes. It should instead learn the *cook-then-repeat* rhythm: the first
appearance of a dish is a cook, an immediately following one is a repeat. Worth surfacing
visually so the plan reads correctly at a glance.

**Auto-suggest a week:** yes, once there's enough data. The user always approves.
Deliberately not built in round 10: with no planning history it could only rank by
times-added, which is the picker you already have. It wants a few weeks of real plans
behind it first — which round 10's `times_planned` now records.

### 4.3 Calendar — built last

**Our database holds the truth.** Niu owns the events. It pushes them **one way** into
Google Calendar. It does not read work meetings or other calendars back in — family
events only.

This is a much simpler arrangement than two-way sync, and it's only possible because
Marçal said he doesn't want other calendars shown. Keep it that way unless he changes
his mind, because two-way is a different project.

**Each member gets their own calendar called "Niu"** (round 11, replacing this
section's original "a single shared calendar both accounts subscribe to"). The
reason is a hard limit that turned out to be a better design. Niu asks Google for
`calendar.app.created` — "make secondary calendars and manage events on them" — which
is the narrowest scope that can do the job and which makes Niu *incapable* of reading
anyone's other calendars. The promise in the paragraph above stops depending on our
good intentions and becomes a property of the token. The price is that the scope
covers only calendars this app made for this user and cannot write sharing rules, so
there is no single calendar for both accounts to write into. Each phone pushes the
household's events into its own copy; on the phone the result is identical.

Nice side effect: **reminders come free.** Because every event lands in a real Google
Calendar, Google's own notifications fire on both phones without us building push.

- **Default view:** month grid, with a week view beside it (round 11.1). The grid
  draws **one** event on a day as a small box with its title in it, **more than one**
  as a dot each (round 12 — three titled boxes on one day was unreadable at 412px),
  and a multi-day event as one unbroken bar across the days it covers whatever else
  is on those days, because five dots cannot say "one thing, five days". The week
  view is seven days down the screen, the same shape the meal planner uses. Seven
  columns and a clock down the side — the way a laptop draws a week — does not
  survive 412px: a column is 55px, and every event becomes a coloured smudge you
  have to tap to read. Both views step by a sideways **swipe** as well as the
  arrows — the month slides out and the next one slides in (round 13) — and both
  can show the **ISO week number**, on by default and switchable off per device.
  **Holding a day** in the month grid opens a new event on it.

- **A card says what an event is without being opened** (round 13): its whole
  date, its time, where it is, the first lines of any note, and "3/10" when it is
  one of a series. The date is on the card even under a heading that already
  names the day, because the same card also appears in Coming up, in the week
  view and pinned above the grid — one that only makes sense in its own context
  is one that cannot travel.
- **Event fields:** title, date, start/end time, all-day, multi-day (for holidays),
  who's involved, location, notes, colour/category, reminder, repeat, link.
- **Adding an event** is where Google is worst and where we earn our keep. Target flow:
  tap a day → type a title → set a time → tap avatars → done, with everything else
  behind one more tap. **A time is optional** (round 12): a new event and a new
  reminder both open with a day and no hour, and one chip adds 18:00 when you want
  one. A null start time already *is* all day (§7), so an event with no time is a
  complete thought rather than a half-filled form. Typed quick-add ("Thursday 18:30 dinner") is wanted if it can be
  made reliable; the structured flow is the fallback and must be excellent on its own.
- **Who's involved:** a row of avatars you tap. None selected is fine and means everyone.
  Since round 11.2 that row includes **people who have no account** — kids,
  grandparents — because half a family's plans are about people who do not have a
  phone. They can be on any event; they are never asked to confirm one.
- **Recurrence, simplified** (round 12, as specified). Repeats daily, weekly,
  every two weeks or monthly; ends after X times, default ten. Editing *and*
  deleting ask: this one, or all of them? Full RRULE support is still not a goal,
  and the reason it turned out to be a third of a round rather than a whole one is
  the shape chosen: **a series is ten ordinary rows sharing a `series_id`**, not
  one row carrying a rule. Everything already built then works on it untouched —
  the grid, RLS, attendees, confirmations, and a Google push that sends ten
  ordinary events with no RRULE on that side either. The price is that a series is
  finite (capped at 60), which is exactly what "ends after X times" already meant.
  "All of them" applies the *change*, not the result: a field you touched is
  copied everywhere, a day you moved shifts everything by the same number of days,
  and anything you left alone stays as it was on each occurrence.
- **Colour:** categories have colours *and* people have colours, and the two must be
  visually distinguishable — e.g. category as the event's fill, person as an avatar ring.
  Round 11 shipped exactly that shape, minus the names: an event carries one of the
  eight colours, a person's colour is their avatar's ring.
- The meal plan does **not** appear in this calendar. It has its own.

**Reminders are a second, lighter kind of thing** (Marçal, round 11). "Tuesday,
remember to renew the parking permit" — a title, a day, optionally an hour, and
nothing else. It is the same row in the same table as an event, because everything
around them is shared: the grid draws both, the push writes both, RLS protects both.
It has one thing an event does not: **a checkbox**. A reminder that merely slid into
the past never told anybody the permit got renewed.

**Send it for confirmation** (Marçal, round 11), and the reason the calendar is
really worth building. It is a **switch in the event sheet** since round 13 —
off by default, with a device preference for whether it starts on — rather than a
button pressed after saving, so a brand-new event can be sent round in the same
breath as writing it. Any event can be sent to the rest of the household, who see it
with Yes / Can't on it, pinned to the top of their calendar screen wherever in the
year it actually falls. An unconfirmed event is **dashed rather than hidden**: it is
on the calendar the moment it is written, and the mark says the other person has not
seen it yet. An event that only appeared once agreed to would be an event you cannot
talk about. Moving the day, the time or the place clears the answers and asks again —
a yes to Thursday is not a yes to Saturday.

**A second person can finally join** (round 11). Six characters read off one phone
and typed into the other. Round 2 deferred the invite flow and nothing needed it
until "who goes" and "ask her to confirm" did. Not an email invite: sending email
needs a server, and §1 says there is no budget for one.

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

Round 11 built this, with three changes worth knowing:

- `events` — id, household_id, **kind** ('event' or 'reminder'), title, **starts_on,
  ends_on, start_time, end_time**, location, notes, colour, confirm_requested,
  done_at/done_by, created_by. A day is a `date` and a time is a `time`, not two
  timestamps: "the 3rd of September" is the 3rd wherever you read it, and storing it
  as an instant makes it the 2nd for anyone an hour west. A null `start_time` *is*
  "all day" — no boolean beside it that could disagree. `ends_on` is inclusive.
- `household_people` — the family, one row each, with a **nullable** `user_id`
  (round 11.2). A child has no account, so having one is a property rather than a
  category and there is one table rather than two. `household_members` keeps only
  the *access* job that RLS reads; this holds the name, colour, emoji and photo.
- `event_attendees` — event_id, **person_id**, household_id. No rows means everyone.
- `event_confirmations` — event_id, user_id, household_id, answer, answered_at.
- `event_sync` / `event_tombstones` — what each member's phone has told Google.
  **There is no `google_event_id`**: it is derived from our uuid, which makes a push
  idempotent and a deletion possible after the row is gone.
- `household_members` also grew display_name, colour, avatar, email; `households` grew
  a join_code.
- Recurrence (round 12) is four columns on `events` and no new table: `series_id`
  (null for a one-off), `series_index`, `series_count` and `series_rule`. There is
  no expansion step anywhere, because there is nothing to expand — the rows are
  the series.
- Still to come: named `event_categories`.

---

## 8. Design direction

Marçal's answers: Bring's bold shapes, but combined with Nordic quiet and warmth. **No
cream palettes. No over-saturated colour.** Very rounded, pill-like. Generous touch
targets. One identity with a signature colour per module. Follows the system theme.
Satisfying motion — things fly into the basket, the empty list celebrates. Copy is a
little witty. Accessibility floor is contrast (keyboard focus and reduced-motion come
along for free).

Navigation: a bottom bar with three tabs plus settings, **and no top bar at all**
(round 11.1). The header used to name the screen you were on, which the tab bar
underneath was already saying, and removing it gave 57px back — more than a whole row
of the month grid. Settings is not a fourth equal tab, because it is a place you visit
monthly and four equal items shrink the three you use daily; it is your own avatar in a
narrower slot on the right. Each screen writes its own heading where it needs one.

No "today" dashboard — the app opens on the shopping list. When the list is empty, that
empty state does the work a dashboard would: tonight's dinner, today's events, and a
good line of copy.

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
- **Push notifications are back on, as round 11.1.** This said "v2" and Marçal
  reversed it in round 11: "this is turning so good that we can integrate
  notifications". The trigger is the confirmation request — a question that arrives
  only when you happen to open the app is a question nobody answers in time. Round 11
  ships the in-app half (the tab badge, live over Realtime) and Google's own alarms
  for reminders; the real phone notification is its own round because it needs three
  new things: a service worker that handles `push`, a VAPID key pair, and one small
  Supabase Edge Function holding the private key. Free tier throughout — flag it if
  that ever stops being true.
- **Last write wins.** If both phones edit the same item in the same second, one wins.
  Fine for two people; the first thing to fix if the household grows.
- **No purchase history**, only per-item stats (§5).
- **No photos** except one place: a person's own face (round 11.2), stored as a
  256px square in a private Storage bucket and resized on the phone before it is
  uploaded. Photographs of *things* — items, dishes — are still ruled out. **No
  desktop layout** in v1, still.
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
| 6 | **Meal planner** — day/week views, meals, plan-to-list *and* list-to-plan, repeat and leftover markers, dragging | A planned week that fills the shopping list (round 10). Month view and auto-suggest-a-week deferred |
| 7 | **Calendar** — events, reminders, month grid, avatars, confirmations, one-way push to Google | Shared family events on both phones (round 11). Recurrence, dots, swiping and week numbers in round 12; the sheet rebuilt Google-style, richer cards and holding a day in round 13. Quick-add still deferred |
| 7.1 | **Push notifications** — service worker, VAPID, one Supabase function | The confirmation request buzzes the other phone |
| 8+ | Stock inference, offline, export, icon upgrades | As they earn their place |

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

1. ~~**Quick-add typing**~~ — **settled in round 11: a nice-to-have, and not yet.**
   Reliable date parsing across English, Catalan and Swedish is a real project, and
   §4.3 requires the structured flow to be excellent on its own regardless — so the
   structured flow was built first and typing was not built at all. Revisit once the
   sheet has been used for a month and it is clear what typing would actually save.
2. ~~**Dragging in the meal planner**~~ — **settled in round 10.** Long-press and drag,
   chosen over tap-to-lift-tap-to-drop. Adding is still a tap on the meal; dragging is
   only for moving something already planned. See `src/lib/drag.svelte.ts` for the four
   things that make it work on a phone.
3. **Icon set** — verify OpenMoji's licence and food coverage before committing (§6).
4. **When "who added it" is shown** — Marçal said "in some situations, decide later".
5. **Catalogue language** — English at launch, with users free to type Catalan. Whether
   the seeded catalogue ships in more than one language is a round-3 decision.
