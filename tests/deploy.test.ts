import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterEach, describe, expect, it, vi } from "vitest";

// connection() only works inside a Next.js request; the route needs it, the unit test doesn't.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => undefined,
}));
import { GET as healthGET } from "@/app/api/health/route";
import { setDbForTests } from "@/lib/db";
import { assertKeyMatchesMode } from "@/lib/payments/dodo";
import { migrate } from "../scripts/migrate-core.mjs";
import { freshTestDb } from "./helpers/db";

const root = path.resolve(__dirname, "..");
const load = (dir: string) =>
  readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(root, dir, name), "utf8") }));

function pgliteQuery(pg: PGlite) {
  return async (sql: string, params?: unknown[]) => {
    if (params?.length) return pg.query(sql, params);
    const results = await pg.exec(sql);
    return { rows: results[results.length - 1]?.rows ?? [] };
  };
}

afterEach(() => setDbForTests(undefined));

describe("migration runner", () => {
  it("applies every migration and seed on an empty database, then does nothing the second time", async () => {
    const pg = new PGlite({ extensions: { pgcrypto } });
    const log: string[] = [];
    await migrate(pgliteQuery(pg), load("supabase/migrations"), load("supabase/seed"), (m: string) => log.push(m));
    expect(log).toContain("applied 0001_init.sql");
    expect(log).toContain("applied 0002_admin_analytics.sql");
    const tiers = await pg.query<{ c: number }>(`select count(*)::int as c from tier_titles where tier = 'iconic'`);
    expect(tiers.rows[0].c).toBe(25);

    const again: string[] = [];
    await migrate(pgliteQuery(pg), load("supabase/migrations"), load("supabase/seed"), (m: string) => again.push(m));
    expect(again).toContain("migrations: nothing to apply");
    const recorded = await pg.query<{ filename: string }>(`select filename from schema_migrations order by 1`);
    expect(recorded.rows.map((r) => r.filename)).toEqual(["0001_init.sql", "0002_admin_analytics.sql"]);
  });

  it("adopts a database whose first migration was applied by hand", async () => {
    const pg = new PGlite({ extensions: { pgcrypto } });
    await pg.exec(readFileSync(path.join(root, "supabase/migrations/0001_init.sql"), "utf8"));
    const log: string[] = [];
    await migrate(pgliteQuery(pg), load("supabase/migrations"), load("supabase/seed"), (m: string) => log.push(m));
    expect(log[0]).toMatch(/adopted existing schema: 0001_init.sql/);
    expect(log).toContain("applied 0002_admin_analytics.sql");
    const col = await pg.query(`select analytics_id from titles limit 1`);
    expect(col).toBeTruthy();
  });

  it("rolls back a failing migration and reports which one", async () => {
    const pg = new PGlite({ extensions: { pgcrypto } });
    const broken = [...load("supabase/migrations"), { name: "0003_broken.sql", sql: "create table oops (; " }];
    await expect(migrate(pgliteQuery(pg), broken, [], () => undefined)).rejects.toThrow(/0003_broken.sql failed/);
    const recorded = await pg.query<{ filename: string }>(`select filename from schema_migrations`);
    expect(recorded.rows.map((r) => r.filename)).not.toContain("0003_broken.sql");
  });
});

describe("health check", () => {
  it("is 200 with a working database and 503 without one", async () => {
    await freshTestDb();
    expect((await healthGET()).status).toBe(200);
    setDbForTests({
      query: async () => {
        throw new Error("down");
      },
      transaction: async () => {
        throw new Error("down");
      },
    });
    expect((await healthGET()).status).toBe(503);
  });
});

describe("live and test payment keys", () => {
  it("refuses a test key in live mode and a live key in test mode", () => {
    expect(() => assertKeyMatchesMode("dodo_test_abc", "live")).toThrow(/test key/);
    expect(() => assertKeyMatchesMode("dodo_live_abc", "test")).toThrow(/live key/);
    expect(() => assertKeyMatchesMode("dodo_live_abc", "live")).not.toThrow();
    expect(() => assertKeyMatchesMode("dodo_test_abc", "test")).not.toThrow();
    expect(() => assertKeyMatchesMode("other_format", "live")).not.toThrow();
  });
});
