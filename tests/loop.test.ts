import { afterEach, beforeEach, describe, expect, it } from "vitest";
import OgImage from "@/app/c/[slug]/opengraph-image";
import { GET as printGET } from "@/app/api/cert/[slug]/print/route";
import { GET as storyGET } from "@/app/api/cert/[slug]/story/route";
import { POST as manageRoutePOST } from "@/app/api/manage/[token]/route";
import { IMAGE_SIZES, isRenderable, renderCertificatePng } from "@/lib/cert-image";
import { type Db, setDbForTests } from "@/lib/db";
import { claimHref, shareText } from "@/lib/format";
import { applyManageEdit } from "@/lib/manage";
import { getSessionRef, recordSessionStart, refSlugFromPath } from "@/lib/session-ref";
import { freshTestDb, insertTitle } from "./helpers/db";

function pngSize(buf: ArrayBuffer): { width: number; height: number; isPng: boolean } {
  const b = new Uint8Array(buf);
  const view = new DataView(buf);
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  return { isPng, width: view.getUint32(16), height: view.getUint32(20) };
}

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe("loop attribution helpers", () => {
  it("reads a certificate slug from a path", () => {
    expect(refSlugFromPath("/c/parallel-parker")).toBe("parallel-parker");
    expect(refSlugFromPath(`/c/${encodeURIComponent("दादी")}`)).toBe("दादी");
    expect(refSlugFromPath("/registry")).toBeNull();
    expect(refSlugFromPath("/c/a/opengraph-image")).toBeNull();
  });

  it("remembers the certificate only when the session starts on one", () => {
    const s = new MemoryStorage();
    recordSessionStart("/c/chef", s);
    recordSessionStart("/c/other", s);
    expect(getSessionRef(s)).toBe("chef");

    const t = new MemoryStorage();
    recordSessionStart("/", t);
    recordSessionStart("/c/chef", t);
    expect(getSessionRef(t)).toBeNull();
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => recordSessionStart("/c/chef", broken)).not.toThrow();
    expect(getSessionRef(broken)).toBeNull();
  });

  it("builds claim links that carry the referring certificate", () => {
    expect(claimHref("Sunny Mom", "chef")).toBe("/claim?title=Sunny+Mom&ref=chef");
    expect(claimHref("Sunny Mom")).toBe("/claim?title=Sunny+Mom");
  });

  it("writes share text without restricted words", () => {
    const text = shareText({ recipientName: "Priya", titleDisplay: "Sunny Mom", registryNo: 6 });
    expect(text).toBe("Priya is the only World's Best Sunny Mom. No. 000006 in The World's Best Registry.");
    expect(text).not.toMatch(/\b(official|legal|certified|accredited)\b/i);
  });
});

describe("certificate images", () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await freshTestDb());
    process.env.NEXT_PUBLIC_SITE_URL = "https://registry.example.test";
  });
  afterEach(() => setDbForTests(undefined));

  it("knows which scripts the bundled fonts cover", () => {
    expect(isRenderable("Priya")).toBe(true);
    expect(isRenderable("मीरा")).toBe(true);
    expect(isRenderable("মালা")).toBe(true);
    // Conjuncts and pre-base vowel signs need shaping the renderer can't do.
    expect(isRenderable("मीरा शर्मा")).toBe(false);
    expect(isRenderable("किरण")).toBe(false);
    expect(isRenderable("সৌমিত্র")).toBe(false);
    expect(isRenderable("Love you 💛")).toBe(true);
    expect(isRenderable("Ömer Çelik")).toBe(true);
    expect(isRenderable("Олег")).toBe(true);
    expect(isRenderable("山田太郎")).toBe(false);
  });

  it.each(Object.entries(IMAGE_SIZES))("renders the %s image at its exact size", async (kind, size) => {
    const png = await renderCertificatePng(
      {
        titleDisplay: "Abcdefghij Abcdefghij Abcdefghij Abcdefg",
        recipientName: "मीरा शर्मा",
        registryNo: 3,
        claimedAt: "2026-11-22T00:00:00Z",
        giverName: "Ravi",
        dedication: "Happy birthday with all our love",
        siteHost: "registry.example.test",
      },
      kind as keyof typeof IMAGE_SIZES,
    );
    expect(pngSize(png)).toEqual({ isPng: true, ...size });
  });

  it("serves the 1200x630 share image for a claimed certificate", async () => {
    await insertTitle(db, { key: "chef", status: "claimed", recipient: "Robin" });
    const res = await OgImage({ params: Promise.resolve({ slug: "chef" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(pngSize(await res.arrayBuffer())).toMatchObject({ width: 1200, height: 630 });
  });

  it("serves a fallback image with 404 for an unknown certificate", async () => {
    const res = await OgImage({ params: Promise.resolve({ slug: "nope" }) });
    expect(res.status).toBe(404);
    expect(pngSize(await res.arrayBuffer())).toMatchObject({ isPng: true, width: 1200, height: 630 });
  });

  it("serves the 1080x1920 story image, as a download when asked", async () => {
    await insertTitle(db, { key: "chef", status: "claimed" });
    const res = await storyGET(new Request("http://test/api/cert/chef/story?download=1"), {
      params: Promise.resolve({ slug: "chef" }),
    });
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
    expect(pngSize(await res.arrayBuffer())).toMatchObject({ width: 1080, height: 1920 });
  });
});

describe("print file", () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await freshTestDb());
  });
  afterEach(() => setDbForTests(undefined));

  async function withToken(addonPrint: boolean, status: "claimed" | "in_review" = "claimed") {
    await insertTitle(db, { key: "chef", status });
    const token = "A".repeat(43);
    await db.query(`update titles set manage_token = $1, addon_print = $2 where title_key = 'chef'`, [token, addonPrint]);
    return token;
  }

  const print = (slug: string, query: string) =>
    printGET(new Request(`http://test/api/cert/${slug}/print?${query}`), { params: Promise.resolve({ slug }) });

  it.each([
    ["a4", 2480, 3508],
    ["letter", 2550, 3300],
  ])("serves %s at 300 dpi to add-on buyers", async (size, width, height) => {
    const token = await withToken(true);
    const res = await print("chef", `token=${token}&size=${size}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(pngSize(await res.arrayBuffer())).toMatchObject({ width, height });
  });

  it("refuses buyers without the add-on, wrong tokens, other slugs and entries in review", async () => {
    const token = await withToken(false);
    expect((await print("chef", `token=${token}`)).status).toBe(404);
    await db.query(`update titles set addon_print = true`);
    expect((await print("chef", `token=${"B".repeat(43)}`)).status).toBe(404);
    expect((await print("dad", `token=${token}`)).status).toBe(404);
    expect((await print("chef", "")).status).toBe(404);
    await db.query(`update titles set status = 'in_review'`);
    expect((await print("chef", `token=${token}`)).status).toBe(404);
  });
});

describe("manage link edits", () => {
  let db: Db;
  const token = "C".repeat(43);
  beforeEach(async () => {
    ({ db } = await freshTestDb());
    await insertTitle(db, { key: "chef", status: "claimed", recipient: "Robbin" });
    await db.query(`update titles set manage_token = $1`, [token]);
  });
  afterEach(() => setDbForTests(undefined));

  const edit = (over: Record<string, string> = {}) =>
    manageRoutePOST(
      new Request(`http://test/api/manage/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientName: "Robin", giverName: "", dedication: "", ...over }),
      }),
      { params: Promise.resolve({ token }) },
    );

  it("fixes the name within 24 hours", async () => {
    const res = await edit();
    expect(res.status).toBe(200);
    const r = await db.query<{ recipient_name: string; status: string }>(`select recipient_name, status from titles`);
    expect(r[0]).toEqual({ recipient_name: "Robin", status: "claimed" });
  });

  it("closes after 24 hours", async () => {
    await db.query(`update titles set claimed_at = now() - interval '25 hours'`);
    expect((await edit()).status).toBe(403);
  });

  it("rejects an unknown token", async () => {
    const r = await applyManageEdit(db, "D".repeat(43), { recipientName: "X", giverName: "", dedication: "" });
    expect(r).toMatchObject({ ok: false, status: 404 });
  });

  it("re-runs moderation and sends a flagged edit to review", async () => {
    const res = await edit({ dedication: "you idiot" });
    expect(await res.json()).toEqual({ status: "in_review" });
  });

  it("keeps the 120-character dedication limit without the print add-on", async () => {
    expect((await edit({ dedication: "a".repeat(200) })).status).toBe(400);
  });

  it("rejects contact details", async () => {
    expect((await edit({ recipientName: "Robin bestchef.com" })).status).toBe(400);
  });
});
