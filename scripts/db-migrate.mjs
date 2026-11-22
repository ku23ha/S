// Apply migrations and seeds to the database in MIGRATION_DATABASE_URL (or
// DATABASE_URL). Supabase recommends a direct or session-pooler connection
// for migrations, not the transaction pooler used by the app.
//   $env:MIGRATION_DATABASE_URL = "<session pooler string, port 5432>"
//   npm run db:migrate
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { migrate } from "./migrate-core.mjs";

const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set MIGRATION_DATABASE_URL (or DATABASE_URL).");
  process.exit(1);
}
if (/:6543\//.test(url)) {
  console.warn("note: this is the transaction pooler (port 6543). Use the session pooler (5432) or direct connection for migrations.");
}

const root = process.cwd();
const load = (dir) =>
  readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(root, dir, name), "utf8") }));

const local = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false } });
await client.connect();
try {
  await migrate((sql, params) => client.query(sql, params), load("supabase/migrations"), load("supabase/seed"));
  console.log("Done.");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}
