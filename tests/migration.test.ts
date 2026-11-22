import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeEach, describe, expect, it } from "vitest";
import { findBlockedTerm, normalizeTitleKey } from "@/lib/titles";

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const MIGRATION = read("supabase/migrations/0001_init.sql") + "\n" + read("supabase/migrations/0002_admin_analytics.sql");
const SEED_TIERS = read("supabase/seed/tier_titles.sql");
const SEED_BLOCKED = read("supabase/seed/blocked_terms.sql");

async function freshDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(MIGRATION);
  await db.exec(SEED_TIERS);
  await db.exec(SEED_BLOCKED);
  return db;
}

let n = 0;
async function insertTitle(db: PGlite, key: string, status: string): Promise<void> {
  n += 1;
  await db.query(
    `insert into titles (title_key, title_display, slug, tier, status, recipient_name,
       buyer_email, price_cents, manage_token)
     values ($1, $2, $3, 'standard', $4, 'Alex', 'buyer@example.test', 500, $5)`,
    [key, key, key.replace(/ /g, "-"), status, `token-${n}`],
  );
}

function pgCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}

describe("0001_init migration", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshDb();
  });

  it("applies on a clean database with every table", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      "blocked_terms",
      "certificate_views",
      "rate_limits",
      "reports",
      "tier_titles",
      "titles",
      "webhook_events",
    ]);
  });

  it("enables row level security on every table with no policies", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c
       join pg_namespace ns on ns.oid = c.relnamespace
       where ns.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(rows.length).toBe(7);
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
    const policies = await db.query(`select 1 from pg_policies where schemaname = 'public'`);
    expect(policies.rows.length).toBe(0);
  });

  it.each(["reserved", "claimed", "in_review"])(
    "rejects a second active row for the same title_key while one is %s",
    async (status) => {
      await insertTitle(db, "dad", status);
      let code: string | undefined;
      try {
        await insertTitle(db, "dad", "reserved");
      } catch (err) {
        code = pgCode(err);
      }
      expect(code).toBe("23505");
    },
  );

  it.each(["expired", "removed", "rejected"])("frees the title once the holder row is %s", async (status) => {
    await insertTitle(db, "dad", status);
    await insertTitle(db, "dad", "reserved");
    const { rows } = await db.query<{ c: number }>(
      `select count(*)::int as c from titles where title_key = 'dad'`,
    );
    expect(rows[0].c).toBe(2);
  });

  it("allows many inactive rows for one key", async () => {
    await insertTitle(db, "dad", "expired");
    await insertTitle(db, "dad", "expired");
    await insertTitle(db, "dad", "removed");
    await insertTitle(db, "dad", "claimed");
  });

  it("rejects an unknown status or tier", async () => {
    await expect(insertTitle(db, "dad", "sold")).rejects.toThrow();
    await expect(
      db.query(
        `insert into titles (title_key, title_display, slug, tier, status, recipient_name,
           buyer_email, price_cents, manage_token)
         values ('mum', 'Mum', 'mum', 'gold', 'reserved', 'A', 'b@example.test', 500, 't')`,
      ),
    ).rejects.toThrow();
  });

  it("hands out increasing registry numbers that are never reused", async () => {
    const a = await db.query<{ n: string }>(`select nextval('registry_no_seq')::text as n`);
    const b = await db.query<{ n: string }>(`select nextval('registry_no_seq')::text as n`);
    expect(Number(a.rows[0].n)).toBe(1);
    expect(Number(b.rows[0].n)).toBe(2);
  });

  it("rejects a duplicate webhook event id", async () => {
    await db.query(`insert into webhook_events (event_id, type, payload) values ('evt_1', 'payment.succeeded', '{}')`);
    const r = await db.query(
      `insert into webhook_events (event_id, type, payload) values ('evt_1', 'payment.succeeded', '{}')
       on conflict (event_id) do nothing returning event_id`,
    );
    expect(r.rows.length).toBe(0);
  });
});

describe("seed files", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshDb();
  });

  it("seeds exactly 25 iconic titles", async () => {
    const { rows } = await db.query<{ c: number }>(`select count(*)::int as c from tier_titles where tier = 'iconic'`);
    expect(rows[0].c).toBe(25);
  });

  it("seeds about 300 popular titles", async () => {
    const { rows } = await db.query<{ c: number }>(`select count(*)::int as c from tier_titles where tier = 'popular'`);
    expect(rows[0].c).toBeGreaterThanOrEqual(270);
    expect(rows[0].c).toBeLessThanOrEqual(330);
  });

  it("includes the iconic titles named in the PRD", async () => {
    const { rows } = await db.query<{ title_key: string }>(`select title_key from tier_titles where tier = 'iconic'`);
    const keys = new Set(rows.map((r) => r.title_key));
    for (const k of ["dad", "mom", "boss", "friend", "teacher"]) expect(keys.has(k), k).toBe(true);
  });

  it("stores every tier key already normalised", async () => {
    const { rows } = await db.query<{ title_key: string }>(`select title_key from tier_titles`);
    for (const r of rows) expect(normalizeTitleKey(r.title_key), r.title_key).toBe(r.title_key);
  });

  it("stores every blocked term already normalised", async () => {
    const { rows } = await db.query<{ term: string }>(`select term from blocked_terms`);
    expect(rows.length).toBeGreaterThan(50);
    for (const r of rows) expect(normalizeTitleKey(r.term), r.term).toBe(r.term);
  });

  it("never blocks a title that is on a price list", async () => {
    const tiers = await db.query<{ title_key: string }>(`select title_key from tier_titles`);
    const blocked = (await db.query<{ term: string }>(`select term from blocked_terms`)).rows.map((r) => r.term);
    for (const t of tiers.rows) expect(findBlockedTerm(t.title_key, blocked), t.title_key).toBeNull();
  });

  it("can be re-applied without errors", async () => {
    await db.exec(SEED_TIERS);
    await db.exec(SEED_BLOCKED);
  });
});
