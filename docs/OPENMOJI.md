# OpenMoji in Niu — what we checked before shipping it

NIU.md §6 said the OpenMoji option needed verifying before we committed to it:
licence terms, food coverage, and what the attribution requirement means if Niu
is ever sold. This is that check, done in round 6.

## Licence

OpenMoji's graphics are **CC BY-SA 4.0**. (The repository's `LICENSE.txt` is the
full Creative Commons Attribution-ShareAlike 4.0 text; the code in that repo is
LGPL-3.0, but we ship none of it.)

Three things follow, and they're the reason for how the files are handled here:

1. **Attribution is required.** OpenMoji's own suggested wording is:

   > All emojis designed by [OpenMoji](https://openmoji.org/) — the open-source
   > emoji and icon project. License:
   > [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

   Niu carries that line in Settings, under the icon style chooser, and a copy
   sits next to the files in `public/openmoji/NOTICE.txt` so it travels with
   them.

2. **ShareAlike only bites on adapted material.** Redistributing the SVGs as
   published is a straight "share with credit". Modifying them — recolouring,
   optimising, merging into a sprite — makes an adaptation, and adaptations have
   to be released under CC BY-SA 4.0 too. So `scripts/fetch-openmoji.mjs` writes
   every file **byte-for-byte as published** and nothing in the build touches
   them. The desaturation the app applies is a CSS `filter` at display time,
   which changes nothing on disk and distributes no altered file.

3. **Selling Niu later stays possible.** CC BY-SA is not a non-commercial
   licence and it does not reach the app's own code — only the icon files and
   any adaptation of them. A paid Niu could ship these icons as long as the
   credit stays visible and we haven't quietly modified them. That is exactly
   the arrangement above.

## Coverage

The seed catalogue names **97 distinct emoji** across its 361 items. OpenMoji
has a drawing for **all 97** — nothing fell back.

That is not the same as 97 of 361 items being covered: the seed only carries an
emoji for about a third of items in the first place, and several items share one
(every cheese is 🧀). The Inked style therefore behaves exactly like the Emoji
style did — an OpenMoji drawing where the item has an emoji, the line drawing
everywhere else — which keeps coverage at the line set's 99%.

Round "more icons" added a second source, `src/lib/icon-extra.ts`: 47
general-purpose emoji (celebration, weather, activities, tools, work) that
aren't tied to any catalogue item, so the icon picker's search can find
"party" or "sunny" for a dish even though nothing in the shopping list is
called that. OpenMoji covers all 47 too, so the shipped set is **144
drawings** in total.

**The €15 icon budget is not needed.** Nothing was bought.

## How the files got here

`node scripts/fetch-openmoji.mjs` — reads the emoji out of
`src/lib/catalogue-seed.ts` and `src/lib/icon-extra.ts`, downloads each one
from OpenMoji's repository at the pinned release **17.0.0**, writes them to
`public/openmoji/`, and regenerates `src/lib/openmoji.ts` (the emoji →
filename map).

144 files, 377 kB on disk, served as ordinary static files and cached by the
browser. None of it is in the JavaScript bundle, and only the icons actually on
screen are ever requested.

Re-run the script after adding an emoji to either file. It needs network; the
build does not.
