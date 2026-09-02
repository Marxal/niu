// Vite config. The only non-obvious thing here is `base`.
//
// GitHub Pages serves a project repo from a sub-folder named after the repo
// (https://marxal.github.io/niu/), not from the domain root, so asset URLs need a
// prefix. It used to be hard-coded to '/niu-/', which broke the moment the repo was
// renamed: every script and stylesheet 404'd.
//
// './' makes every URL relative to the page instead, so the app works from any
// folder — renamed repo, custom domain, or opened straight off disk — with nothing
// to keep in sync. This is safe here only because the app is a single index.html
// using hash routes: the browser's idea of "the current folder" never changes as
// you move between screens.
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  base: './',
  plugins: [svelte()],
  server: {
    host: true, // so a phone on the same wifi can open the dev server
    port: 5173,
    // Google OAuth via Supabase can only ever validate a *hostname* redirect,
    // never a raw LAN IP (Supabase's Auth server hard-rejects any redirect_to
    // whose host parses as an IP address, unless it's loopback — see CLAUDE.md
    // rule 8). Bonjour/mDNS gives this Mac a stable "<name>.local" hostname
    // for free; Vite's own DNS-rebinding guard needs it allow-listed here too.
    allowedHosts: ['.local', 'dev.bitochess.com'],
  },
})
