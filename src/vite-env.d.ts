/// <reference types="vite/client" />

/*
 * Types for the build-time settings. Both are optional on purpose: the app has
 * to compile and run with neither of them set, so that an automatic deploy can
 * never produce a blank site just because Supabase isn't wired up yet.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
