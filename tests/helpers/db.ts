import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import path from "node:path";
import { type Db, ensureSchema, setDbForTests, wrapPGlite } from "@/lib/db";
import { clearListCaches } from "@/lib/queries";

export const ROOT = path.resolve(__dirname, "..", "..");

/** A fresh in-memory database with migration and seeds, installed as getDb(). */
export async function freshTestDb(): Promise<{ db: Db; pg: PGlite }> {
  const pg = new PGlite({ extensions: { pgcrypto } });
  await ensureSchema(pg, ROOT);
  const db = wrapPGlite(pg);
  clearListCaches();
  setDbForTests(db);
  return { db, pg };
}

let seq = 0;

export interface InsertOpts {
  key: string;
  display?: string;
  status: "reserved" | "claimed" | "in_review" | "expired" | "removed" | "rejected";
  recipient?: string;
  tier?: "standard" | "popular" | "iconic";
  reservedMinutesFromNow?: number;
  claimedAt?: string;
  slug?: string;
}

/** Insert a titles row; claimed and in_review rows get the next registry number. */
export async function insertTitle(db: Db, o: InsertOpts): Promise<{ id: string; registry_no: number | null }> {
  seq += 1;
  const display = o.display ?? o.key.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  const numbered = o.status === "claimed" || o.status === "in_review";
  const rows = await db.query<{ id: string; registry_no: number | null }>(
    `insert into titles (title_key, title_display, slug, tier, status, recipient_name, buyer_email,
       price_cents, manage_token, registry_no, reserved_until, claimed_at)
     values ($1, $2, $3, $4, $5, $6, 'buyer@example.test', 500, $7,
       case when $8 then nextval('registry_no_seq') else null end,
       case when $9::int is null then null else now() + ($9::int * interval '1 minute') end,
       case when $8 then coalesce($10::timestamptz, now()) else null end)
     returning id, registry_no::int as registry_no`,
    [
      o.key,
      display,
      o.slug ?? o.key.replace(/ /g, "-"),
      o.tier ?? "standard",
      o.status,
      o.recipient ?? "Alex Example",
      `token-${seq}`,
      numbered,
      o.reservedMinutesFromNow ?? (o.status === "reserved" ? 15 : null),
      o.claimedAt ?? null,
    ],
  );
  return rows[0];
}
