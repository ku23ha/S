import { describe, expect, it } from "vitest";
import { ClaimInput } from "@/lib/claim";

const base = {
  title: "Parallel Parker",
  recipientName: "Alex",
  email: "buyer@example.test",
};

function issues(input: Record<string, unknown>): string[] {
  const r = ClaimInput.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

describe("ClaimInput", () => {
  it("accepts the minimum fields and fills defaults", () => {
    const r = ClaimInput.parse(base);
    expect(r).toMatchObject({ giverName: "", dedication: "", addonPrint: false });
  });

  it("has no price field and strips one sent by the client", () => {
    const r = ClaimInput.parse({ ...base, priceCents: 1 });
    expect("priceCents" in r).toBe(false);
  });

  it("accepts non-Latin names and emoji in the dedication", () => {
    const r = ClaimInput.parse({ ...base, recipientName: "मीरा शर्मा", dedication: "Love you 💛" });
    expect(r.recipientName).toBe("मीरा शर्मा");
  });

  it("requires a recipient name", () => {
    expect(issues({ ...base, recipientName: "   " })).toEqual(["recipientName: Enter who this title is for."]);
  });

  it("rejects contact details in any free-text field", () => {
    expect(issues({ ...base, recipientName: "visit bestdad.com" })[0]).toMatch(/Web addresses/);
    expect(issues({ ...base, giverName: "@me" })[0]).toMatch(/@handles/);
    expect(issues({ ...base, dedication: "call 555 123 4567" })[0]).toMatch(/Phone numbers/);
  });

  it("rejects angle brackets and control characters", () => {
    expect(issues({ ...base, recipientName: "<b>Alex</b>" })[0]).toMatch(/characters/);
  });

  it("limits the dedication to 120 characters, or 280 with print", () => {
    const long = "a".repeat(200);
    expect(issues({ ...base, dedication: long })[0]).toMatch(/120/);
    expect(issues({ ...base, dedication: long, addonPrint: true })).toEqual([]);
    expect(issues({ ...base, dedication: "a".repeat(281), addonPrint: true })[0]).toMatch(/280/);
  });

  it("validates the email", () => {
    expect(issues({ ...base, email: "nope" })[0]).toMatch(/valid email/);
  });
});
