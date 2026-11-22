import { describe, expect, it } from "vitest";
import {
  PLACE_PLACEHOLDER,
  PRINT_ADDON_CENTS,
  TIER_PRICE_CENTS,
  type ListedTier,
  type ParsedTitle,
  findBlockedTerm,
  getTier,
  normalizeTitleKey,
  parseTitle,
  priceCents,
  slugFromKey,
  suggestVariants,
  toTitleDisplay,
  variantCandidates,
} from "@/lib/titles";

const BLOCKED = ["idiot", "ass", "loser", "white power", "fuck", "official"];

function ok(raw: string): ParsedTitle {
  const r = parseTitle(raw, BLOCKED);
  if (!r.ok) throw new Error(`expected ok for ${JSON.stringify(raw)}, got ${r.reason}`);
  return r.title;
}

function reason(raw: string): string | null {
  const r = parseTitle(raw, BLOCKED);
  return r.ok ? null : r.reason;
}

describe("normalizeTitleKey", () => {
  it.each(["Dad", " dad", "dad ", "DAD!", "dad", "  DaD  ", "Dad.", "¡Dad!"])(
    "maps %j to 'dad'",
    (input) => {
      expect(normalizeTitleKey(input)).toBe("dad");
    },
  );

  it("strips apostrophes", () => {
    expect(normalizeTitleKey("Mom's Cook")).toBe("moms cook");
  });

  it("folds curly apostrophes the same as straight ones", () => {
    expect(normalizeTitleKey("Mom’s Cook")).toBe(normalizeTitleKey("Mom's Cook"));
  });

  it("treats hyphens as spaces so spellings collide", () => {
    expect(normalizeTitleKey("Parallel-Parker")).toBe("parallel parker");
    expect(normalizeTitleKey("parallel parker")).toBe("parallel parker");
    expect(normalizeTitleKey("Parallel – Parker")).toBe("parallel parker");
  });

  it("collapses internal whitespace including tabs and newlines", () => {
    expect(normalizeTitleKey("Parallel \t\n  Parker")).toBe("parallel parker");
  });

  it("applies NFKC so full-width letters match ASCII", () => {
    expect(normalizeTitleKey("Ｄａｄ")).toBe("dad");
  });

  it("applies NFKC so composed and decomposed accents match", () => {
    expect(normalizeTitleKey("Abuela José")).toBe(normalizeTitleKey("Abuela José"));
  });

  it("ignores a typed World's Best prefix", () => {
    expect(normalizeTitleKey("World's Best Dad")).toBe("dad");
    expect(normalizeTitleKey("worlds best dad")).toBe("dad");
    expect(normalizeTitleKey("The World’s Best Dad")).toBe("dad");
  });

  it("keeps non-Latin letters", () => {
    expect(normalizeTitleKey("दादी")).toBe("दादी");
    expect(normalizeTitleKey("Ömer's Opa")).toBe("ömers opa");
  });
});

describe("slugFromKey", () => {
  it("replaces spaces with hyphens", () => {
    expect(slugFromKey("parallel parker")).toBe("parallel-parker");
    expect(slugFromKey("dad")).toBe("dad");
  });
});

describe("toTitleDisplay", () => {
  it("title-cases and trims", () => {
    expect(toTitleDisplay("  parallel parker ")).toBe("Parallel Parker");
  });

  it("lower-cases an all-caps input", () => {
    expect(toTitleDisplay("DAD!")).toBe("Dad");
  });

  it("keeps hyphens and capitalises each part", () => {
    expect(toTitleDisplay("mother-in-law")).toBe("Mother-In-Law");
  });

  it("does not capitalise after an apostrophe", () => {
    expect(toTitleDisplay("mom's cook")).toBe("Mom's Cook");
  });

  it("keeps short acronyms in mixed-case input", () => {
    expect(toTitleDisplay("BBQ dad")).toBe("BBQ Dad");
  });
});

describe("parseTitle: accepted input", () => {
  it("returns key, display and slug", () => {
    expect(ok("parallel parker")).toEqual({
      key: "parallel parker",
      display: "Parallel Parker",
      slug: "parallel-parker",
    });
  });

  it("gives Dad, dad, DAD! and ' dad' one key and one slug", () => {
    const parsed = ["Dad", " dad", "DAD!", "dad"].map(ok);
    expect(new Set(parsed.map((p) => p.key))).toEqual(new Set(["dad"]));
    expect(new Set(parsed.map((p) => p.slug))).toEqual(new Set(["dad"]));
  });

  it("accepts exactly 2 characters", () => {
    expect(ok("DJ").key).toBe("dj");
  });

  it("accepts exactly 40 characters", () => {
    const forty = "Abcdefghij Abcdefghij Abcdefghij Abcdefg";
    expect([...forty].length).toBe(40);
    expect(ok(forty).display).toBe(forty);
  });

  it("accepts numbers alongside letters", () => {
    expect(ok("Dad of 3").key).toBe("dad of 3");
  });

  it("accepts non-Latin titles", () => {
    expect(ok("दादी").key).toBe("दादी");
  });

  it("removes sentence punctuation rather than rejecting it", () => {
    expect(ok("Dad!!!").display).toBe("Dad");
    expect(ok("Mom & Dad").key).toBe("mom dad");
  });

  it("does not block words that merely contain a blocked term", () => {
    expect(ok("Assistant").key).toBe("assistant");
    expect(ok("Passenger").key).toBe("passenger");
  });
});

describe("parseTitle: rejected input", () => {
  it("rejects 41 characters with too_long", () => {
    const fortyOne = "Abcdefghij Abcdefghij Abcdefghij Abcdefgh";
    expect([...fortyOne].length).toBe(41);
    expect(reason(fortyOne)).toBe("too_long");
  });

  it.each(["", " ", "a", "!", "a'", "World's Best", "World's Best D"])(
    "rejects %j as too_short",
    (input) => {
      expect(reason(input)).toBe("too_short");
    },
  );

  it.each(["https://dad.example", "www.bestdad", "bestdad.com", "dad.lol/claim", "ftp://x"])(
    "rejects URL %j",
    (input) => {
      expect(reason(input)).toBe("url");
    },
  );

  it("rejects an email address", () => {
    expect(reason("dad@example.com")).toBe("email");
  });

  it.each(["call 555 123 4567", "+91 98765 43210", "(555) 123-4567", "5551234567"])(
    "rejects phone number %j",
    (input) => {
      expect(reason(input)).toBe("phone");
    },
  );

  it("rejects an @handle", () => {
    expect(reason("@bestdad")).toBe("handle");
    expect(reason("Dad @home_chef")).toBe("handle");
  });

  it("rejects symbols and emoji with invalid_chars", () => {
    expect(reason("Dad 🎉")).toBe("invalid_chars");
    expect(reason("<script>alert</script>")).toBe("invalid_chars");
    expect(reason("Dad $$$")).toBe("invalid_chars");
  });

  it("rejects digits-only titles", () => {
    expect(reason("42")).toBe("no_letters");
  });

  it("rejects blocked terms in any case and with punctuation", () => {
    expect(reason("Idiot")).toBe("blocked");
    expect(reason("Biggest IDIOT!")).toBe("blocked");
    expect(reason("Official Dad")).toBe("blocked");
  });

  it("rejects simple plurals of blocked terms", () => {
    expect(reason("Losers")).toBe("blocked");
  });

  it("rejects multi-word blocked phrases", () => {
    expect(reason("White Power Dad")).toBe("blocked");
  });

  it("rejects blocked terms spelled out in single letters", () => {
    expect(reason("f u c k")).toBe("blocked");
  });

  it("returns a human message with every rejection", () => {
    const r = parseTitle("dad@example.com", BLOCKED);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/email/i);
  });
});

describe("findBlockedTerm", () => {
  it("returns the matching term or null", () => {
    expect(findBlockedTerm("big idiot", BLOCKED)).toBe("idiot");
    expect(findBlockedTerm("big dad", BLOCKED)).toBeNull();
  });
});

describe("getTier and priceCents", () => {
  const tiers = new Map<string, ListedTier>([
    ["dad", "iconic"],
    ["sister", "popular"],
  ]);

  it("looks up listed tiers", () => {
    expect(getTier("dad", tiers)).toBe("iconic");
    expect(getTier("sister", tiers)).toBe("popular");
  });

  it("defaults to standard", () => {
    expect(getTier("parallel parker", tiers)).toBe("standard");
  });

  it("uses the fixed price list", () => {
    expect(TIER_PRICE_CENTS).toEqual({ standard: 500, popular: 1900, iconic: 9900 });
    expect(priceCents("standard", false)).toBe(500);
    expect(priceCents("popular", false)).toBe(1900);
    expect(priceCents("iconic", false)).toBe(9900);
  });

  it("adds the print add-on", () => {
    expect(PRINT_ADDON_CENTS).toBe(700);
    expect(priceCents("standard", true)).toBe(1200);
  });
});

describe("variants", () => {
  const dad = ok("Dad");
  const allFree = async (keys: string[]) => new Set(keys);

  it("builds Ever and adjective candidates that pass validation", () => {
    const { ever, adjectives } = variantCandidates(dad, BLOCKED);
    expect(ever?.display).toBe("Dad Ever");
    expect(adjectives.length).toBeGreaterThan(0);
    for (const a of adjectives) expect(a.key).toMatch(/^[a-z]+ dad$/);
  });

  it("is deterministic for the same title", () => {
    const a = variantCandidates(dad, BLOCKED).adjectives.map((t) => t.key);
    const b = variantCandidates(ok("dad"), BLOCKED).adjectives.map((t) => t.key);
    expect(a).toEqual(b);
  });

  it("returns Ever, one adjective and the place prompt when all are free", async () => {
    const v = await suggestVariants(dad, BLOCKED, allFree);
    expect(v.map((x) => x.kind)).toEqual(["ever", "adjective", "place"]);
    const place = v[2];
    expect(place.kind === "place" && place.displayPrefix).toBe("Dad in ");
    expect(place.kind === "place" && place.placeholder).toBe(PLACE_PLACEHOLDER);
  });

  it("drops taken variants and falls through to the next free adjective", async () => {
    const { ever, adjectives } = variantCandidates(dad, BLOCKED);
    const taken = new Set([ever!.key, adjectives[0].key]);
    const v = await suggestVariants(dad, BLOCKED, async (keys) => new Set(keys.filter((k) => !taken.has(k))));
    expect(v.map((x) => x.kind)).toEqual(["adjective", "place"]);
    const adj = v[0];
    expect(adj.kind === "adjective" && adj.title.key).toBe(adjectives[1].key);
  });

  it("returns only the place prompt when nothing is free", async () => {
    const v = await suggestVariants(dad, BLOCKED, async () => new Set());
    expect(v.map((x) => x.kind)).toEqual(["place"]);
  });

  it("does not append Ever twice", () => {
    expect(variantCandidates(ok("Dad Ever"), BLOCKED).ever).toBeNull();
  });

  it("omits variants that would exceed 40 characters", async () => {
    const long = ok("Abcdefghij Abcdefghij Abcdefghij Abcdefg");
    const v = await suggestVariants(long, BLOCKED, allFree);
    expect(v).toEqual([]);
  });
});
