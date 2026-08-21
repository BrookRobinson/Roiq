// Concatenates supabase/migrations/*.sql, in filename order, into a single
// supabase/setup.sql you can paste into the Supabase SQL editor once.
//
// The migrations stay the source of truth — this only saves running four pastes
// in the right order against a brand new project. Re-run after adding a migration:
//   npm run db:setup-sql

import { readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const MIGRATIONS = path.join(process.cwd(), "supabase", "migrations");
const OUT = path.join(process.cwd(), "supabase", "setup.sql");

const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const rule = "-- " + "=".repeat(74);
const parts = [
  rule,
  "-- BDR Report — full database setup.",
  "--",
  "-- GENERATED from supabase/migrations by scripts/build-setup-sql.mjs — do not",
  "-- edit by hand; edit the migration and re-run `npm run db:setup-sql`.",
  "--",
  "-- Paste the whole file into the Supabase SQL editor of a new project and run it.",
  "-- Every statement is idempotent, so running it twice is safe.",
  "--",
  `-- Migrations included (${files.length}):`,
  ...files.map((f) => `--   ${f}`),
  rule,
  "",
];

for (const f of files) {
  parts.push("", rule, `-- ${f}`, rule, "", readFileSync(path.join(MIGRATIONS, f), "utf8").trim(), "");
}

writeFileSync(OUT, parts.join("\n") + "\n", "utf8");
console.log(`Wrote ${path.relative(process.cwd(), OUT)} from ${files.length} migrations.`);
