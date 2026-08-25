// Vite config. The only non-obvious thing here is `base`: GitHub Pages serves this
// repo at https://marxal.github.io/niu-/ , not at a domain root, so every asset URL
// has to be prefixed with /niu-/. If the site ever moves to its own domain, this is
// the one line that changes (to '/').
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  base: '/niu-/',
  plugins: [svelte()],
  server: {
    host: true, // so a phone on the same wifi can open the dev server
    port: 5173,
  },
})
