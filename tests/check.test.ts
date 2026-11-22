import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as checkGET } from "@/app/api/titles/check/route";
import { GET as registryGET } from "@/app/api/registry/route";
import type { CheckResult } from "@/lib/check";
import { type Db, setDbForTests } from "@/lib/db";
import { getCertificateBySlug, listIconic, listRegistry } from "@/lib/queries";
import { freshTestDb, insertTitle } from "./helpers/db";

async function check(q: string): Promise<{ status: number; body: CheckResult & { error?: string } }> {
  const res = await checkGET(new Request(`http://test/api/titles/check?q=${encodeURIComponent(q)}`));
  return { status: res.status, body: await res.json() };
}

let db: Db;
beforeEach(async () => {
  ({ db } = await freshTestDb());
});
afterEach(() => setDbForTests(undefined));

describe("GET /api/titles/check", () => {
  it("reports a free standard title with the $5 price", async () => {
    const { status, body } = await check("parallel parker");
    expect(status).toBe(200);
    expect(body).toEqual({
      status: "available",
      title: { key: "parallel parker", display: "Parallel Parker", slug: "parallel-parker", tier: "standard", priceCents: 500 },
    });
  });

  it("prices iconic and popular titles from the seed lists", async () => {
    const dad = await check("Dad");
    expect(dad.body.status === "available" && dad.body.title).toMatchObject({ tier: "iconic", priceCents: 9900 });
    const sister = await check("sister");
    expect(sister.body.status === "available" && sister.body.title).toMatchObject({ tier: "popular", priceCents: 1900 });
  });

  it("finds the same holder for Dad, ' dad', 'DAD!' and 'dad'", async () => {
    await insertTitle(db, { key: "dad", display: "Dad", status: "claimed", recipient: "Sam", tier: "iconic" });
    for (const q of ["Dad", " dad", "DAD!", "dad"]) {
      const { body } = await check(q);
      expect(body.status, q).toBe("taken");
      if (body.status === "taken") expect(body.holder.recipientName).toBe("Sam");
    }
  });

  it("returns holder details and free variants for a taken title", async () => {
    await insertTitle(db, { key: "dad", display: "Dad", status: "claimed", recipient: "Sam", tier: "iconic" });
    await insertTitle(db, { key: "dad ever", display: "Dad Ever", status: "claimed", recipient: "Kim", tier: "popular" });
    const { body } = await check("dad");
    expect(body.status).toBe("taken");
    if (body.status !== "taken") return;
    expect(body.holder).toMatchObject({ recipientName: "Sam", registryNo: 1, slug: "dad", inReview: false });
    expect(body.holder.claimedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const kinds = body.variants.map((v) => v.kind);
    expect(kinds).toEqual(["adjective", "place"]);
    const adj = body.variants[0];
    if (adj.kind === "adjective") expect(adj.title.priceCents).toBe(500);
  });

  it("hides the recipient name while a holder is in review", async () => {
    await insertTitle(db, { key: "uncle", status: "in_review", recipient: "Pat" });
    const { body } = await check("uncle");
    expect(body.status === "taken" && body.holder).toMatchObject({ recipientName: null, inReview: true });
  });

  it("reports a live reservation as reserved", async () => {
    await insertTitle(db, { key: "chef", status: "reserved" });
    const { body } = await check("chef");
    expect(body.status).toBe("reserved");
  });

  it("expires a stale reservation and reports the title as available", async () => {
    await insertTitle(db, { key: "chef", status: "reserved", reservedMinutesFromNow: -1 });
    const { body } = await check("chef");
    expect(body.status).toBe("available");
    const rows = await db.query<{ status: string }>(`select status from titles where title_key = 'chef'`);
    expect(rows[0].status).toBe("expired");
  });

  it("treats removed and expired rows as free", async () => {
    await insertTitle(db, { key: "chef", status: "removed" });
    await insertTitle(db, { key: "chef", status: "expired" });
    expect((await check("chef")).body.status).toBe("available");
  });

  it.each([
    ["A".repeat(41), "too_long"],
    ["https://example.com", "url"],
    ["dad@example.com", "email"],
    ["idiot", "blocked"],
  ])("rejects %j with %s and a message", async (q, reason) => {
    const { status, body } = await check(q);
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "not_allowed", reason });
    if (body.status === "not_allowed") expect(body.message.length).toBeGreaterThan(10);
  });

  it("rejects an over-long query string with 400", async () => {
    const { status } = await check("x".repeat(201));
    expect(status).toBe(400);
  });

  it("never returns the buyer email or manage token", async () => {
    await insertTitle(db, { key: "dad", status: "claimed" });
    const res = await checkGET(new Request("http://test/api/titles/check?q=dad"));
    const text = await res.text();
    expect(text).not.toContain("buyer@example.test");
    expect(text).not.toContain("token-");
  });

  it("answers 503 with a friendly message when the database is down", async () => {
    setDbForTests({
      query: async () => {
        throw new Error("connection refused");
      },
      transaction: async () => {
        throw new Error("connection refused");
      },
    });
    const { status, body } = await check("dad");
    expect(status).toBe(503);
    expect(body.error).toBe("Try again in a moment.");
  });
});

describe("registry queries", () => {
  it("lists claimed titles newest first with a working cursor", async () => {
    for (let i = 0; i < 5; i++) {
      await insertTitle(db, { key: `title ${String.fromCharCode(97 + i)}x`, status: "claimed", claimedAt: `2026-11-0${i + 1}T00:00:00Z` });
    }
    await insertTitle(db, { key: "hidden", status: "reserved" });
    const first = await listRegistry(db, { tab: "recent", limit: 2 });
    expect(first.items.map((i) => i.titleKey)).toEqual(["title ex", "title dx"]);
    const second = await listRegistry(db, { tab: "recent", limit: 2, cursor: first.nextCursor });
    expect(second.items.map((i) => i.titleKey)).toEqual(["title cx", "title bx"]);
    const third = await listRegistry(db, { tab: "recent", limit: 2, cursor: second.nextCursor });
    expect(third.items.map((i) => i.titleKey)).toEqual(["title ax"]);
    expect(third.nextCursor).toBeNull();
  });

  it("lists by lowest registry number", async () => {
    await insertTitle(db, { key: "aa", status: "claimed" });
    await insertTitle(db, { key: "bb", status: "claimed" });
    const page = await listRegistry(db, { tab: "lowest", limit: 1 });
    expect(page.items[0].registryNo).toBe(1);
    const next = await listRegistry(db, { tab: "lowest", limit: 1, cursor: page.nextCursor });
    expect(next.items[0].registryNo).toBe(2);
  });

  it("searches by word prefix", async () => {
    await insertTitle(db, { key: "parallel parker", status: "claimed" });
    await insertTitle(db, { key: "chef", status: "claimed" });
    expect((await listRegistry(db, { tab: "recent", q: "park" })).items.map((i) => i.titleKey)).toEqual(["parallel parker"]);
    expect((await listRegistry(db, { tab: "recent", q: "arker" })).items).toEqual([]);
  });

  it("serves the registry API without private fields", async () => {
    await insertTitle(db, { key: "chef", status: "claimed", recipient: "Robin" });
    const res = await registryGET(new Request("http://test/api/registry?tab=recent"));
    const body = await res.json();
    expect(body.items[0]).toEqual({
      slug: "chef",
      titleDisplay: "Chef",
      recipientName: "Robin",
      registryNo: 1,
      claimedAt: expect.any(String),
      tier: "standard",
    });
  });

  it("lists all 25 iconic titles with holders where taken", async () => {
    await insertTitle(db, { key: "dad", status: "claimed", recipient: "Sam", tier: "iconic" });
    const iconic = await listIconic(db);
    expect(iconic.length).toBe(25);
    expect(iconic.find((e) => e.titleKey === "dad")?.holder?.recipientName).toBe("Sam");
    expect(iconic.find((e) => e.titleKey === "mom")?.holder).toBeNull();
  });

  it("finds certificates by slug, including non-Latin slugs, but not reservations", async () => {
    await insertTitle(db, { key: "दादी", status: "claimed", recipient: "Meera" });
    await insertTitle(db, { key: "chef", status: "reserved" });
    expect((await getCertificateBySlug(db, "दादी"))?.recipientName).toBe("Meera");
    expect(await getCertificateBySlug(db, "chef")).toBeNull();
  });
});
