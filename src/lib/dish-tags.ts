/*
 * The "part of a meal" tags, and the eight colours one can be painted.
 *
 * Round 8 stored a single `slot` per dish, out of a fixed four. Both halves of
 * that were wrong: a lasagne is protein *and* carbs, and the fourth value,
 * "other", was a shrug rather than an answer. So a dish now carries any number
 * of tags, the household writes its own, and the button where "other" used to
 * be is the one that writes them.
 *
 * The colour is a name, never a value. `dish_tags.colour` holds 'clay', and
 * everything visual resolves that through `--color-tag-clay` in the token file
 * — which is what keeps the one rule the design has (no colour written down
 * outside tokens.css) true even for a colour the user picked. It also means the
 * eight are known to work in both themes, which a colour wheel could not
 * promise.
 *
 * Pure: no Svelte, no Supabase, no DOM.
 */

export const TAG_COLOURS = [
  'clay',
  'rose',
  'amber',
  'moss',
  'sage',
  'sky',
  'plum',
  'stone',
] as const

export type TagColour = (typeof TAG_COLOURS)[number]

/** The colour a tag gets when nobody has said otherwise. */
export const DEFAULT_TAG_COLOUR: TagColour = 'stone'

export interface DishTag {
  id: string
  name: string
  colour: TagColour
  position: number
}

export function isTagColour(value: unknown): value is TagColour {
  return TAG_COLOURS.includes(value as TagColour)
}

/**
 * The two CSS custom properties a chip needs, as an inline style.
 *
 * This is the one place a component is allowed to reach a colour by name, and
 * it still doesn't name a *value* — it builds the token reference and hands it
 * over. An unknown colour (a newer app version wrote it, or the row was edited
 * by hand) falls back to stone rather than rendering with no colour at all.
 */
export function tagStyle(colour: string): string {
  const safe = isTagColour(colour) ? colour : DEFAULT_TAG_COLOUR
  return `--tag-ink: var(--color-tag-${safe}); --tag-fill: var(--color-tag-${safe}-soft)`
}

/** Tags in the order they should be shown: their own, then by name. */
export function sortTags(tags: readonly DishTag[]): DishTag[] {
  return [...tags].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
}

/**
 * The tags on one dish, in tag order rather than link order.
 *
 * The links come back from the database unordered, and a dish whose chips
 * reshuffle between loads looks broken even though nothing changed.
 */
export function tagsOf(tagIds: readonly string[], all: readonly DishTag[]): DishTag[] {
  const wanted = new Set(tagIds)
  return sortTags(all.filter((tag) => wanted.has(tag.id)))
}

/**
 * The next free position, so a new tag lands after the existing ones instead of
 * fighting whichever already holds 0.
 */
export function nextPosition(tags: readonly DishTag[]): number {
  return tags.reduce((highest, tag) => Math.max(highest, tag.position), -1) + 1
}

/** What has to change to turn one set of tags into another. Same shape as the
 * ingredient diff in dishes.ts, and for the same reason: an unchanged set of
 * tags should cost no writes at all. */
export function diffTags(
  before: readonly string[],
  after: readonly string[],
): { toAdd: string[]; toRemove: string[] } {
  const had = new Set(before)
  const wants = new Set(after)

  return {
    toAdd: [...wants].filter((id) => !had.has(id)),
    toRemove: [...had].filter((id) => !wants.has(id)),
  }
}
