# Niu

A family organiser PWA for one household: a shopping list, a meal planner and a shared
calendar. Phone-first, Android, installable.

**Live:** https://marxal.github.io/niu/

## Working on it

```bash
npm install
npm run dev      # dev server, reachable from a phone on the same wifi
npm run build    # type check + production build into dist/
npm test         # unit tests for the pure logic modules
npm run icons    # regenerate the app icons after a brand colour change
```

Deploys happen automatically: every push to `main` runs the build and publishes to GitHub
Pages.

## Backend

Niu stores everything in Supabase. Connecting it is a one-time browser task —
see [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md). Until that's done the app
still runs, but nothing is saved and Settings says "Not connected yet".

The SQL that creates the tables and their Row Level Security policies lives in
`supabase/migrations/`.

See `CLAUDE.md` for the rules this repo is built under, and `ROADMAP.md` for what changed
in each round.
