/*
 * Turns the catalogue in src/lib/catalogue-seed.ts into a SQL migration.
 *
 * Why generate rather than hand-write the SQL: the seed is 361 rows with a
 * uniqueness rule the database enforces. Keeping one source of truth — the
 * TypeScript, which has tests — means the SQL can't quietly drift out of sync
 * with it, and re-ordering a category is an edit in one place.
 *
 * Run it with `npm run seed:sql` after changing the catalogue, then paste the
 * regenerated file into Supabase's SQL editor. It runs on Node's own
 * TypeScript support, so there is no extra dependency to install.
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flattenSeed } from '../src/lib/catalogue-seed.ts'

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'supabase',
  'migrations',
  '0003_catalogue_seed.sql',
)

/** Single-quote a value for SQL, or NULL. Doubling quotes is the escape. */
function sql(value: string | null): string {
  if (value === null) return 'null'
  return `'${value.replace(/'/g, "''")}'`
}

const rows = flattenSeed()

const values = rows
  .map(
    (row) =>
      `  (${sql(row.name)}, ${sql(row.category)}, ${sql(row.icon)}, ${sql(row.emoji)}, ${
        row.sortOrder
      }, ${row.suggestedRank ?? 'null'})`,
  )
  .join(',\n')

const file = `-- Round 3: the seeded catalogue — the tiles you tap instead of typing.
--
-- GENERATED FILE. Do not edit by hand: change src/lib/catalogue-seed.ts and run
-- \`npm run seed:sql\`. ${rows.length} items across ${new Set(rows.map((r) => r.category)).size} categories.
--
-- These rows have household_id null, meaning they are shared by every
-- household and belong to none. The insert policy in 0002 deliberately forbids
-- creating rows like that from the app, so this has to be run here, in the SQL
-- editor, where policies don't apply.
--
-- Safe to re-run: on conflict it updates the category, icon, order and
-- suggested rank, so re-running after changing the catalogue applies the new
-- values rather than erroring or duplicating. Re-running this is also how the
-- old emoji icons get swapped for line-drawing slugs.
--
-- Requires 0004 and 0005 to have run first (they add the suggested_rank and
-- emoji columns).

insert into public.catalogue_items (name, category, icon, emoji, sort_order, suggested_rank)
values
${values}
on conflict (lower(trim(name))) where household_id is null
do update set
  category = excluded.category,
  icon = excluded.icon,
  emoji = excluded.emoji,
  sort_order = excluded.sort_order,
  suggested_rank = excluded.suggested_rank;
`

writeFileSync(OUT, file)
console.log(`wrote ${rows.length} catalogue rows to ${OUT}`)
