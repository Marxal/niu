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

See the end of the round-1 message. In short: open
`https://marxal.github.io/niu-/` on the phone, install it from the Chrome menu, and check
the three tabs and the Settings icon.

### Deliberately not done

Supabase, Google sign-in, any real data, offline caching, notifications.

### Next up

Google sign-in + the households table with its RLS policy.
