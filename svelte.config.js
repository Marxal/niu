// Svelte compiler config. Runes mode is forced on so nobody can accidentally
// slip a Svelte 4 pattern (`export let`, `$:`, stores-for-local-state) into a
// component — the compiler will error instead of silently running in legacy mode.
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: true,
  },
}
