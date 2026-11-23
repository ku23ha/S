import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEDICATION_MAX } from "@/lib/claim";
import { HELPER_ANSWERS, RECIPIENTS, TONES, dedicationTemplates } from "@/lib/helper";
import { findContactDetail, parseTitle } from "@/lib/titles";
import { isPrivatePath } from "@/components/Marketing";

const BANNED = /\b(official|legal|certified|accredited)\b/i;
const DISCLAIMER = "A novelty registry for fun and affection. Titles have no legal or official status.";

describe("gift helper", () => {
  it("suggests only titles that pass validation and the blocklist", () => {
    const seed = readFileSync(path.resolve(__dirname, "..", "supabase", "seed", "blocked_terms.sql"), "utf8");
    const blocked = [...seed.matchAll(/\('([^']+)'/g)].map((m) => m[1]);
    expect(blocked.length).toBeGreaterThan(10);
    for (const r of RECIPIENTS) {
      for (const t of r.titles) expect(parseTitle(t, blocked).ok, t).toBe(true);
    }
  });

  it("fills templates with the first name and stays within the dedication limit", () => {
    for (const { id } of TONES) {
      for (const line of dedicationTemplates(id, "Ananya Sharma-Iyer Krishnamurthy")) {
        expect(line).toContain("Ananya");
        expect(line).not.toContain("{name}");
        expect([...line].length).toBeLessThanOrEqual(DEDICATION_MAX);
        expect(findContactDetail(line)).toBeNull();
        expect(line).not.toMatch(BANNED);
      }
    }
  });

  it("uses banned words only inside the exact disclaimer", () => {
    for (const a of HELPER_ANSWERS) expect((a.q + a.a).split(DISCLAIMER).join("")).not.toMatch(BANNED);
  });
});

describe("ad tags", () => {
  it("treat manage links, admin and api routes as private", () => {
    for (const p of ["/manage/abc", "/admin", "/api/checkout", "/dev/checkout"]) expect(isPrivatePath(p)).toBe(true);
    for (const p of ["/", "/claim", "/c/kite-flyer", "/success", "/gifts", "/management"]) expect(isPrivatePath(p)).toBe(false);
  });
});
