/*
 * Finding a picture by typing a word.
 *
 * The problem this solves: the icon picker shows about sixty line drawings and
 * ninety emoji in one long scrolling grid, and the only way to find the right
 * one is to look at all of them. Fine for "pick something nice", useless for "I
 * want the cheese one".
 *
 * What makes it searchable is the catalogue itself. Every seeded item names an
 * icon and, often, an emoji — so the seed is already a dictionary of words that
 * point at pictures, and a much better one than anything invented here would be.
 * Searching "cheddar" finds the cheese drawing because cheddar is a catalogue
 * item that uses it. The slug is a keyword too, so "cheese" finds it directly.
 *
 * The catalogue only stretches to groceries, though, so icon-extra.ts is a
 * second word list for emoji that aren't tied to any catalogue item — "party",
 * "sunny", "birthday" — which the catalogue could never have taught this
 * search on its own.
 *
 * Built once at module load from the seed, which is static data compiled into
 * the bundle — no network, no store, nothing to keep in sync.
 *
 * Pure: no Svelte, no Supabase, no DOM.
 */

import { CATALOGUE_SEED } from './catalogue-seed'
import { EXTRA_EMOJI } from './icon-extra'
import { ICONS } from './icons'
import { matchesSearch } from './list-view'

/** Keywords for one picture, lowercased. */
type Keywords = Map<string, Set<string>>

function add(index: Keywords, key: string, word: string): void {
  const existing = index.get(key)
  if (existing) existing.add(word)
  else index.set(key, new Set([word]))
}

/**
 * Two dictionaries: slug → words, emoji → words.
 *
 * Every line slug is present even if no catalogue item uses it, so the picker
 * can still find `bag` by name. Emoji only exist here if something in the
 * catalogue carries them, which is the same rule the Emoji tab already follows.
 */
function build(): { line: Keywords; emoji: Keywords } {
  const line: Keywords = new Map()
  const emoji: Keywords = new Map()

  for (const slug of Object.keys(ICONS)) {
    // Slugs are camelCase in a couple of places (`flourBag`), and someone
    // typing "flour bag" should still find it.
    add(line, slug, slug.replace(/([a-z])([A-Z])/g, '$1 $2').toLocaleLowerCase())
  }

  for (const category of CATALOGUE_SEED) {
    for (const item of category.items) {
      if (item.icon) add(line, item.icon, item.name)
      if (item.emoji) add(emoji, item.emoji, item.name)
      // The category name too: "bakery" should turn up bread and croissants.
      if (item.icon) add(line, item.icon, category.name)
      if (item.emoji) add(emoji, item.emoji, category.name)
    }
  }

  for (const { emoji: glyph, words } of EXTRA_EMOJI) {
    for (const word of words) add(emoji, glyph, word)
  }

  return { line, emoji }
}

const INDEX = build()

function hits(index: Keywords, query: string): string[] {
  const found: string[] = []
  for (const [key, words] of index) {
    for (const word of words) {
      if (matchesSearch(word, query)) {
        found.push(key)
        break
      }
    }
  }
  return found
}

/**
 * What matches a query, per style. An empty query matches nothing rather than
 * everything — the picker shows its full grids in that case, and returning 150
 * results for "" would just be a slower way to draw the same thing.
 *
 * The `inked` list is the emoji list filtered to the ones we ship a drawing
 * for; the caller passes that set in rather than this module importing it, so
 * the module stays free of anything that touches `import.meta.env`.
 */
export function searchIcons(
  query: string,
  inkedAvailable: ReadonlySet<string>,
): { line: string[]; emoji: string[]; inked: string[] } {
  const trimmed = query.trim()
  if (trimmed === '') return { line: [], emoji: [], inked: [] }

  const emoji = hits(INDEX.emoji, trimmed)

  return {
    line: hits(INDEX.line, trimmed),
    emoji,
    inked: emoji.filter((glyph) => inkedAvailable.has(glyph)),
  }
}

/** Every word that would find this picture. Exposed for the tests. */
export function keywordsFor(kind: 'line' | 'emoji', key: string): string[] {
  return [...(INDEX[kind].get(key) ?? [])]
}
