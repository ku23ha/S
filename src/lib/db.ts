/**
 * The only way server code reaches Postgres.
 *
 * Production: node-postgres against Supabase's shared transaction pooler
 * (DATABASE_URL on port 6543). Supabase's guidance for serverless clients:
 * one connection per instance, SSL required, no prepared statements (so
 * queries here never pass a `name`), no session state between transactions.
 *
 * Local development without DATABASE_URL: an embedded PGlite database in
 * .pglite/, migrated and seeded on first use. Tests inject their own Db.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export type Row = Record<string, unknown>;

export interface Db {
  query<T extends Row = Row>(text: string, params?: readonly unknown[]): Promise<T[]>;
  transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
}

/** Postgres error code for unique_violation. */
export const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === UNIQUE_VIOLATION;
}

// ---------------------------------------------------------------------------
// node-postgres
// ---------------------------------------------------------------------------

async function createPgDb(connectionString: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  const wrap = (client: Queryable): Db => ({
    async query<T extends Row>(text: string, params: readonly unknown[] = []) {
      const res = await client.query(text, [...params]);
      return res.rows as T[];
    },
    async transaction() {
      throw new Error("Nested transactions are not supported");
    },
  });

  return {
    ...wrap(pool),
    async transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R> {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(wrap(client));
        await client.query("commit");
        return result;
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// PGlite (local development and tests)
// ---------------------------------------------------------------------------

interface PGliteLike {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
  transaction<R>(fn: (tx: { query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }> }) => Promise<R>): Promise<R>;
}

export function wrapPGlite(pg: PGliteLike): Db {
  return {
    async query<T extends Row>(text: string, params: readonly unknown[] = []) {
      return (await pg.query<T>(text, [...params])).rows;
    },
    async transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R> {
      return pg.transaction(async (tx) =>
        fn({
          async query<T extends Row>(text: string, params: readonly unknown[] = []) {
            return (await tx.query<T>(text, [...params])).rows;
          },
          async transaction() {
            throw new Error("Nested transactions are not supported");
          },
        }),
      );
    },
  };
}

/** SQL files that build a fresh database: migration, then seeds. */
export function schemaSql(root = process.cwd()): string[] {
  // Local development and tests only; keep these reads out of the production trace.
  const read = (p: string) => readFileSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ root, p), "utf8");
  return [
    read("supabase/migrations/0001_init.sql"),
    read("supabase/seed/tier_titles.sql"),
    read("supabase/seed/blocked_terms.sql"),
  ];
}

/** Apply migration and seeds if the schema is missing. */
export async function ensureSchema(pg: PGliteLike, root?: string): Promise<void> {
  const { rows } = await pg.query<{ exists: boolean }>(`select to_regclass('public.titles') is not null as exists`);
  if (rows[0]?.exists) return;
  for (const sql of schemaSql(root)) await pg.exec(sql);
}

async function createLocalDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  const pg = new PGlite(path.join(/*turbopackIgnore: true*/ process.cwd(), ".pglite"), { extensions: { pgcrypto } });
  await ensureSchema(pg);
  return wrapPGlite(pg);
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

const globalForDb = globalThis as unknown as { __wbrDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__wbrDb) {
    const url = process.env.DATABASE_URL;
    if (url) {
      globalForDb.__wbrDb = createPgDb(url);
    } else if (process.env.NODE_ENV !== "production") {
      globalForDb.__wbrDb = createLocalDb();
    } else {
      return Promise.reject(new Error("DATABASE_URL is not set"));
    }
    globalForDb.__wbrDb.catch(() => {
      globalForDb.__wbrDb = undefined;
    });
  }
  return globalForDb.__wbrDb;
}

/** Tests only: replace the database. */
export function setDbForTests(db: Db | undefined): void {
  globalForDb.__wbrDb = db ? Promise.resolve(db) : undefined;
}
