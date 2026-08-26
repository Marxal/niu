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
  .map((row) => `  (${sql(row.name)}, ${sql(row.category)}, ${sql(row.icon)}, ${row.sortOrder})`)
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
-- Safe to re-run: on conflict it updates the category, icon and order, so
-- re-running after re-ordering the catalogue applies the new order rather than
-- erroring or duplicating.

insert into public.catalogue_items (name, category, icon, sort_order)
values
${values}
on conflict (lower(trim(name))) where household_id is null
do update set
  category = excluded.category,
  icon = excluded.icon,
  sort_order = excluded.sort_order;
`

writeFileSync(OUT, file)
console.log(`wrote ${rows.length} catalogue rows to ${OUT}`)
