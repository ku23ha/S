import { describe, expect, it } from "vitest";
import { GIFT_SHELVES, STORES, type StoreId, storeSearchUrl } from "@/lib/stores";

const BANNED = /\b(official|legal|certified|accredited)\b/i;
const HOSTS: Record<StoreId, string> = {
  amazon_in: "www.amazon.in",
  amazon_com: "www.amazon.com",
  flipkart: "www.flipkart.com",
  myntra: "www.myntra.com",
};

describe("gift shop links", () => {
  it("only ever point at the four stores, over https, with the query encoded", () => {
    for (const store of Object.keys(STORES) as StoreId[]) {
      const u = new URL(storeSearchUrl(store, "gift for sister & brother"));
      expect(u.protocol).toBe("https:");
      expect(u.host).toBe(HOSTS[store]);
      expect(u.search).not.toContain(" ");
    }
    expect(new URL(storeSearchUrl("amazon_in", "a4 frame")).searchParams.get("k")).toBe("a4 frame");
    expect(new URL(storeSearchUrl("flipkart", "a4 frame")).searchParams.get("q")).toBe("a4 frame");
    expect(new URL(storeSearchUrl("myntra", "Women Pendant")).pathname).toBe("/women-pendant");
  });

  it("has unique idea ids, at least one store each, and no banned words", () => {
    const ids = GIFT_SHELVES.flatMap((s) => s.ideas.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const shelf of GIFT_SHELVES) {
      expect(shelf.name + shelf.blurb).not.toMatch(BANNED);
      for (const idea of shelf.ideas) {
        expect(Object.keys(idea.queries).length).toBeGreaterThan(0);
        expect(idea.name + idea.why).not.toMatch(BANNED);
      }
    }
  });
});
