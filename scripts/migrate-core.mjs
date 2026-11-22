// Migration runner core, shared by scripts/db-migrate.mjs and the tests.
// query(sql) runs SQL (several statements allowed) and resolves to { rows }.

export const MIGRATIONS_TABLE = `create table if not exists schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
alter table schema_migrations enable row level security;`;

/**
 * Apply each migration that hasn't run yet, in filename order, each in its
 * own transaction, then re-apply the (idempotent) seed files.
 * A database whose 0001 schema was created by hand is adopted: 0001 is
 * recorded as applied instead of run again.
 * @param {(sql: string, params?: unknown[]) => Promise<{ rows: any[] }>} query
 * @param {{ name: string, sql: string }[]} migrations
 * @param {{ name: string, sql: string }[]} seeds
 * @param {(msg: string) => void} log
 */
export async function migrate(query, migrations, seeds, log = console.log) {
  await query(MIGRATIONS_TABLE);
  const applied = new Set((await query(`select filename from schema_migrations`)).rows.map((r) => r.filename));
  const hasTitles = (await query(`select to_regclass('public.titles') is not null as exists`)).rows[0].exists;

  const sorted = [...migrations].sort((a, b) => a.name.localeCompare(b.name));
  if (hasTitles && sorted[0] && !applied.has(sorted[0].name) && sorted[0].name.startsWith("0001")) {
    await query(`insert into schema_migrations (filename) values ($1)`, [sorted[0].name]);
    applied.add(sorted[0].name);
    log(`adopted existing schema: ${sorted[0].name} marked as applied`);
  }

  let ran = 0;
  for (const m of sorted) {
    if (applied.has(m.name)) continue;
    await query("begin");
    try {
      await query(m.sql);
      await query(`insert into schema_migrations (filename) values ($1)`, [m.name]);
      await query("commit");
    } catch (err) {
      await query("rollback");
      throw new Error(`${m.name} failed: ${err instanceof Error ? err.message : err}`);
    }
    ran += 1;
    log(`applied ${m.name}`);
  }
  if (ran === 0) log("migrations: nothing to apply");

  for (const s of seeds) {
    await query(s.sql);
    log(`seeded ${s.name}`);
  }
}
