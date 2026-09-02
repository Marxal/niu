/*
 * General-purpose emoji that aren't tied to any grocery catalogue item.
 *
 * icons.ts and openmoji.ts are grocery-shaped by design — every entry exists
 * because a catalogue item uses it. Right for the shopping list, but it shuts
 * out anything that isn't food or a household consumable: a dish has no
 * catalogue entry to hang "party" or "sunny" off of, so icon-search.ts had
 * nothing to find for words like that even though nobody was buying them at
 * the shop.
 *
 * This is the second, independent word list icon-search.ts reads from — an
 * emoji can appear here with no catalogue item in sight. Keeping it separate
 * from catalogue-seed.ts means adding "🎉 party" here can never put confetti
 * on the shopping list.
 *
 * scripts/fetch-openmoji.mjs reads this file the same way it reads the seed —
 * the field name below is deliberately the same one the seed uses — so
 * anything added here needs a re-run of that script to get its drawing.
 *
 * Pure: no Svelte, no Supabase, no DOM.
 */

export interface ExtraEmoji {
  emoji: string
  words: string[]
}

export const EXTRA_EMOJI: readonly ExtraEmoji[] = [
  // ---- Celebration --------------------------------------------------------
  { emoji: '🎉', words: ['party', 'celebration', 'confetti'] },
  { emoji: '🎈', words: ['balloon', 'party', 'birthday'] },
  { emoji: '🎁', words: ['gift', 'present', 'birthday'] },
  { emoji: '🎂', words: ['birthday', 'cake'] },
  { emoji: '🎆', words: ['fireworks', 'celebration'] },
  // ---- Nature & weather ---------------------------------------------------
  { emoji: '☀️', words: ['sun', 'sunny', 'weather'] },
  { emoji: '🌧️', words: ['rain', 'weather'] },
  { emoji: '❄️', words: ['snow', 'winter', 'cold'] },
  { emoji: '🌈', words: ['rainbow'] },
  { emoji: '🌙', words: ['moon', 'night'] },
  { emoji: '🌸', words: ['flower', 'blossom', 'spring'] },
  { emoji: '🌳', words: ['tree', 'garden'] },
  { emoji: '🪴', words: ['plant', 'pot plant', 'garden'] },
  // ---- Symbols --------------------------------------------------------------
  { emoji: '⭐', words: ['star'] },
  { emoji: '✨', words: ['sparkle', 'shiny', 'clean'] },
  { emoji: '❤️', words: ['heart', 'love'] },
  { emoji: '✅', words: ['done', 'check', 'tick', 'complete'] },
  { emoji: '❗', words: ['important', 'exclamation'] },
  { emoji: '📌', words: ['pin', 'note'] },
  { emoji: '🔔', words: ['bell', 'reminder', 'notification'] },
  // ---- Activities -----------------------------------------------------------
  { emoji: '⚽', words: ['football', 'soccer', 'ball', 'sport'] },
  { emoji: '🏀', words: ['basketball', 'sport'] },
  { emoji: '🎾', words: ['tennis', 'sport'] },
  { emoji: '🎮', words: ['games', 'video games', 'controller'] },
  { emoji: '🎨', words: ['art', 'paint', 'craft'] },
  { emoji: '🎵', words: ['music', 'song'] },
  { emoji: '📷', words: ['camera', 'photo'] },
  { emoji: '📚', words: ['books', 'reading', 'school'] },
  // ---- Home & tools -----------------------------------------------------
  { emoji: '🔧', words: ['wrench', 'tool', 'repair', 'fix'] },
  { emoji: '🔨', words: ['hammer', 'tool', 'repair', 'diy'] },
  { emoji: '🔑', words: ['key', 'keys', 'lock'] },
  { emoji: '🔌', words: ['plug', 'charger', 'electric'] },
  { emoji: '✂️', words: ['scissors', 'cut'] },
  { emoji: '🧵', words: ['thread', 'sewing'] },
  // ---- Getting around ---------------------------------------------------
  { emoji: '🚗', words: ['car', 'drive'] },
  { emoji: '🚲', words: ['bike', 'bicycle', 'cycling'] },
  { emoji: '✈️', words: ['plane', 'flight', 'travel'] },
  { emoji: '🎫', words: ['ticket', 'tickets'] },
  // ---- Work & everyday --------------------------------------------------
  { emoji: '💻', words: ['laptop', 'computer', 'work'] },
  { emoji: '📱', words: ['phone', 'mobile'] },
  { emoji: '📅', words: ['calendar', 'date', 'plan'] },
  { emoji: '⏰', words: ['alarm', 'clock', 'time'] },
  { emoji: '📦', words: ['box', 'parcel', 'delivery', 'package'] },
  { emoji: '💰', words: ['money', 'budget', 'cash'] },
  { emoji: '🌡️', words: ['thermometer', 'temperature', 'fever'] },
  { emoji: '😷', words: ['mask', 'sick', 'ill'] },
  { emoji: '👓', words: ['glasses'] },
]
