// Local development only: fills the embedded .pglite database with sample
// claims so pages can be checked by eye. Never runs against DATABASE_URL.
// Usage: stop `npm run dev`, then `npm run db:fixtures` (add --reset to wipe).
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

if (process.env.DATABASE_URL) {
  console.error("DATABASE_URL is set. Fixtures only run against the local .pglite database.");
  process.exit(1);
}

const root = process.cwd();
const dir = path.join(root, ".pglite");
if (process.argv.includes("--reset") && existsSync(dir)) rmSync(dir, { recursive: true, force: true });

const pg = new PGlite(dir, { extensions: { pgcrypto } });
const { rows } = await pg.query(`select to_regclass('public.titles') is not null as exists`);
if (!rows[0].exists) {
  for (const f of ["supabase/migrations/0001_init.sql", "supabase/seed/tier_titles.sql", "supabase/seed/blocked_terms.sql"]) {
    await pg.exec(readFileSync(path.join(root, f), "utf8"));
  }
}

const samples = [
  ["parallel parker", "Parallel Parker", "standard", "Sample Recipient", "Sample Giver", "For every tight spot on our street."],
  ["mom", "Mom", "iconic", "Sample Mum", null, null],
  ["abcdefghij abcdefghij abcdefghij abcdefg", "Abcdefghij Abcdefghij Abcdefghij Abcdefg", "standard", "मीरा शर्मा", "Ravi", "Happy birthday 🎉 with all our love"],
  ["pancake flipper", "Pancake Flipper", "standard", "Wolfeschlegelsteinhausenbergerdorffvoralternwarengewissenhaftschaferswessenschafewarenwohlgepflegeundsorgfaltigkeitbeschutzenvorangreifendurch", null, null],
  ["chef", "Chef", "popular", "Sample Chef", null, null],
];

let n = 0;
for (const [key, display, tier, recipient, giver, dedication] of samples) {
  n += 1;
  const exists = await pg.query(`select 1 from titles where title_key = $1 and status in ('reserved','claimed','in_review')`, [key]);
  if (exists.rows.length) continue;
  await pg.query(
    `insert into titles (title_key, title_display, slug, tier, status, registry_no, recipient_name, giver_name, dedication,
       buyer_email, price_cents, manage_token, claimed_at)
     values ($1, $2, replace($1, ' ', '-'), $3, 'claimed', nextval('registry_no_seq'), $4, $5, $6,
       'fixture@example.test', 500, md5(random()::text), now() - ($7::int * interval '1 hour'))`,
    [key, display, tier, recipient, giver, dedication, n],
  );
}
await pg.query(
  `insert into titles (title_key, title_display, slug, tier, status, recipient_name, buyer_email, price_cents, manage_token, reserved_until)
   select 'uncle', 'Uncle', 'uncle', 'popular', 'reserved', 'Sample', 'fixture@example.test', 1900, md5(random()::text), now() + interval '15 minutes'
   where not exists (select 1 from titles where title_key = 'uncle' and status in ('reserved','claimed','in_review'))`,
);
const count = await pg.query(`select count(*)::int as c from titles`);
console.log(`Local fixtures ready: ${count.rows[0].c} rows in .pglite`);
await pg.close();
