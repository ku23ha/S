/**
 * Title library: normalise, validate, tier lookup, prices and variants.
 * Pure functions only. Database access lives in src/lib/db.ts; callers pass
 * in the blocked terms, tier map and an availability check.
 *
 * Rules: docs/DATA_MODEL.md "Title rules".
 */

export const TITLE_PREFIX = "World's Best";
export const TITLE_MIN_LENGTH = 2;
export const TITLE_MAX_LENGTH = 40;

export type Tier = "standard" | "popular" | "iconic";
export type ListedTier = Exclude<Tier, "standard">;

/** Fixed public price list (docs/PRD.md). The only source of prices. */
export const TIER_PRICE_CENTS: Readonly<Record<Tier, number>> = {
  standard: 500,
  popular: 1900,
  iconic: 9900,
};
export const PRINT_ADDON_CENTS = 700;
export const CURRENCY = "USD";

export type TitleRejectReason =
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "no_letters"
  | "url"
  | "email"
  | "phone"
  | "handle"
  | "blocked";

export interface ParsedTitle {
  /** Normalised remainder used for uniqueness, e.g. "parallel parker". */
  key: string;
  /** The user's text in Title Case, e.g. "Parallel Parker". */
  display: string;
  /** key with spaces replaced by hyphens, e.g. "parallel-parker". */
  slug: string;
}

export type TitleParseResult =
  | { ok: true; title: ParsedTitle }
  | { ok: false; reason: TitleRejectReason; message: string };

const REJECT_MESSAGES: Readonly<Record<TitleRejectReason, string>> = {
  too_short: `Titles need at least ${TITLE_MIN_LENGTH} characters after "World's Best".`,
  too_long: `Titles can be at most ${TITLE_MAX_LENGTH} characters after "World's Best".`,
  invalid_chars: "Use letters, numbers, spaces, apostrophes and hyphens only.",
  no_letters: "A title needs at least one letter.",
  url: "Titles can't contain web addresses.",
  email: "Titles can't contain email addresses.",
  phone: "Titles can't contain phone numbers.",
  handle: "Titles can't contain @handles.",
  blocked: "That title isn't allowed here. Try something kinder.",
};

// ---------------------------------------------------------------------------
// Character classes
// ---------------------------------------------------------------------------

/** Apostrophe look-alikes folded to a plain apostrophe. */
const APOSTROPHE_RE = /[‘’‛ʼʹ`´′]/gu;
/** Hyphen and dash look-alikes folded to a plain hyphen. */
const DASH_RE = /[‐-―−﹘﹣]/gu;
/** Punctuation other than apostrophe and hyphen. Removed, not rejected. */
const OTHER_PUNCT_RE = /[^\P{P}'-]/gu;
/** What may remain once punctuation is removed. */
const ALLOWED_RE = /^[\p{L}\p{M}\p{N}' -]+$/u;
const HAS_LETTER_RE = /\p{L}/u;
/** Leading "World's Best" (or "Worlds Best", "The World's Best"). */
const PREFIX_RE = /^(?:the\s+)?world'?s\s+best(?:\s+|$)/iu;

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/u;
const HANDLE_RE = /@[\p{L}\p{N}_.]/u;
const URL_RE =
  /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\.|[\p{L}\p{N}-]\.(?:com|net|org|io|co|in|uk|us|ca|au|de|fr|app|dev|xyz|me|ly|gg|tv|lol|best|info|biz|ai|site|online|shop|store|link|club|live|page)\b)/iu;
/** Seven or more digits, allowing common phone separators between them. */
const PHONE_RE = /\+?\d(?:[\s().-]*\d){6,}/u;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function cleanInput(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(APOSTROPHE_RE, "'")
    .replace(DASH_RE, "-")
    .replace(/\s+/gu, " ")
    .trim();
}

function stripPrefix(s: string): string {
  return s.replace(PREFIX_RE, "").trim();
}

/** Remove punctuation (except ' and -), collapse spaces, trim stray hyphens. */
function stripPunctuation(s: string): string {
  return s
    .replace(OTHER_PUNCT_RE, " ")
    .replace(/-{2,}/gu, "-")
    .replace(/\s+/gu, " ")
    .replace(/^[\s-]+|[\s-]+$/gu, "")
    .trim();
}

/** Turn an already-cleaned remainder into its key. */
function keyFromRemainder(remainder: string): string {
  return remainder
    .toLowerCase()
    .replace(/'/gu, "")
    .replace(/-/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * title_key for any input: NFKC, lower case, strip apostrophes and
 * punctuation (hyphens become spaces), collapse whitespace, trim.
 * Does not validate; use parseTitle for that.
 */
export function normalizeTitleKey(raw: string): string {
  return keyFromRemainder(stripPunctuation(stripPrefix(cleanInput(raw))));
}

/** slug: title_key with spaces replaced by hyphens. */
export function slugFromKey(key: string): string {
  return key.replace(/ /gu, "-");
}

function codePointLength(s: string): number {
  return [...s].length;
}

function upperFirst(word: string): string {
  const chars = [...word];
  if (chars.length === 0) return word;
  return chars[0].toUpperCase() + chars.slice(1).join("").toLowerCase();
}

/**
 * title_display: Title Case, trimmed. Short all-caps words (acronyms such as
 * "BBQ" or "DJ") are kept as typed unless the whole input is in capitals.
 */
export function toTitleDisplay(remainder: string): string {
  const cleaned = stripPunctuation(stripPrefix(cleanInput(remainder)));
  const letters = cleaned.replace(/[^\p{L}]/gu, "");
  const allCaps = letters.length > 0 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  return cleaned
    .split(/(\s+|-)/u)
    .map((part) => {
      if (part === "" || /^(\s+|-)$/u.test(part)) return part;
      const partLetters = part.replace(/[^\p{L}]/gu, "");
      const isAcronym =
        !allCaps &&
        partLetters.length >= 2 &&
        partLetters.length <= 5 &&
        partLetters === partLetters.toUpperCase() &&
        partLetters !== partLetters.toLowerCase();
      return isAcronym ? part : upperFirst(part);
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Blocked terms
// ---------------------------------------------------------------------------

/**
 * Whole-word match against the key, so "ass" blocks "Ass" but not
 * "Assistant". Multi-word terms match whole phrases. Runs of single letters
 * ("f u c k") are joined before matching, and simple plurals of terms with
 * four or more letters are caught ("idiots").
 */
export function findBlockedTerm(key: string, blockedTerms: Iterable<string>): string | null {
  const tokens = key.split(" ").filter(Boolean);
  const joined: string[] = [];
  let run = "";
  for (const t of tokens) {
    if (codePointLength(t) === 1) {
      run += t;
    } else {
      if (run) joined.push(run);
      run = "";
    }
  }
  if (run) joined.push(run);
  const tokenSet = new Set([...tokens, ...joined.filter((j) => codePointLength(j) > 1)]);
  const padded = ` ${key} `;
  const compact = key.replace(/ /gu, "");

  for (const rawTerm of blockedTerms) {
    const term = normalizeTitleKey(rawTerm);
    if (!term) continue;
    if (term.includes(" ")) {
      if (padded.includes(` ${term} `) || compact === term.replace(/ /gu, "")) return rawTerm;
      continue;
    }
    if (tokenSet.has(term)) return rawTerm;
    if (codePointLength(term) >= 4 && (tokenSet.has(`${term}s`) || tokenSet.has(`${term}es`))) {
      return rawTerm;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function reject(reason: TitleRejectReason): TitleParseResult {
  return { ok: false, reason, message: REJECT_MESSAGES[reason] };
}

export type ContactDetail = "url" | "email" | "phone" | "handle";

/** Detect a URL, email, phone number or @handle in any free-text field. */
export function findContactDetail(text: string): ContactDetail | null {
  const cleaned = cleanInput(text);
  if (EMAIL_RE.test(cleaned)) return "email";
  if (URL_RE.test(cleaned)) return "url";
  if (HANDLE_RE.test(cleaned)) return "handle";
  if (PHONE_RE.test(cleaned)) return "phone";
  return null;
}

export const CONTACT_DETAIL_MESSAGES: Readonly<Record<ContactDetail, string>> = {
  url: "Web addresses aren't allowed here.",
  email: "Email addresses aren't allowed here.",
  phone: "Phone numbers aren't allowed here.",
  handle: "@handles aren't allowed here.",
};

/**
 * Validate a user's title remainder (the part after "World's Best") and
 * derive its key, display and slug. A leading "World's Best" typed by the
 * user is ignored.
 */
export function parseTitle(raw: string, blockedTerms: Iterable<string>): TitleParseResult {
  const cleaned = stripPrefix(cleanInput(raw));

  // Contact details first, on the text before punctuation is removed.
  const contact = findContactDetail(cleaned);
  if (contact) return reject(contact);

  const remainder = stripPunctuation(cleaned);
  if (codePointLength(remainder) > TITLE_MAX_LENGTH) return reject("too_long");
  if (remainder !== "" && !ALLOWED_RE.test(remainder)) return reject("invalid_chars");

  const key = keyFromRemainder(remainder);
  if (codePointLength(remainder) < TITLE_MIN_LENGTH || codePointLength(key.replace(/ /gu, "")) < TITLE_MIN_LENGTH) {
    return reject("too_short");
  }
  if (!HAS_LETTER_RE.test(remainder)) return reject("no_letters");
  if (findBlockedTerm(key, blockedTerms) !== null) return reject("blocked");

  return {
    ok: true,
    title: { key, display: toTitleDisplay(remainder), slug: slugFromKey(key) },
  };
}

// ---------------------------------------------------------------------------
// Tier and price
// ---------------------------------------------------------------------------

/** Tier: look up title_key in tier_titles; default is standard. */
export function getTier(key: string, tierTitles: ReadonlyMap<string, ListedTier>): Tier {
  return tierTitles.get(key) ?? "standard";
}

/** Server-side price in cents. Never accept an amount from the client. */
export function priceCents(tier: Tier, addonPrint: boolean): number {
  return TIER_PRICE_CENTS[tier] + (addonPrint ? PRINT_ADDON_CENTS : 0);
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export const VARIANT_ADJECTIVES = [
  "Cool",
  "Kind",
  "Funny",
  "Brave",
  "Patient",
  "Loyal",
  "Gentle",
  "Clever",
  "Cheerful",
  "Happy",
  "Super",
  "Sunny",
] as const;

/** Shown in the "in ___" variant; the user replaces it with a place. */
export const PLACE_PLACEHOLDER = "___";

export type TitleVariant =
  | { kind: "ever" | "adjective"; title: ParsedTitle }
  | { kind: "place"; displayPrefix: string; placeholder: string };

function stableIndex(key: string, modulo: number): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return h % modulo;
}

/**
 * Candidate variants for a taken title, before availability is known:
 * append "Ever", and each adjective prepended (rotated per title so
 * different titles lead with different adjectives).
 */
export function variantCandidates(
  title: ParsedTitle,
  blockedTerms: Iterable<string>,
): { ever: ParsedTitle | null; adjectives: ParsedTitle[] } {
  const terms = [...blockedTerms];
  const tryParse = (text: string): ParsedTitle | null => {
    const r = parseTitle(text, terms);
    return r.ok && r.title.key !== title.key ? r.title : null;
  };

  const tokens = title.key.split(" ");
  const ever = tokens[tokens.length - 1] === "ever" ? null : tryParse(`${title.display} Ever`);

  const start = stableIndex(title.key, VARIANT_ADJECTIVES.length);
  const adjectives: ParsedTitle[] = [];
  for (let i = 0; i < VARIANT_ADJECTIVES.length; i++) {
    const adj = VARIANT_ADJECTIVES[(start + i) % VARIANT_ADJECTIVES.length];
    if (tokens[0] === adj.toLowerCase()) continue;
    const parsed = tryParse(`${adj} ${title.display}`);
    if (parsed) adjectives.push(parsed);
  }
  return { ever, adjectives };
}

/**
 * Up to three variants for a taken title: "<title> Ever", one adjective
 * prepended, and "<title> in ___" for the user to complete. Only variants
 * that are free are returned; the "in ___" variant is a prompt whose
 * availability is checked once the user completes it.
 *
 * @param freeKeys returns the subset of the given keys that have no active holder.
 */
export async function suggestVariants(
  title: ParsedTitle,
  blockedTerms: Iterable<string>,
  freeKeys: (keys: string[]) => Promise<ReadonlySet<string>>,
): Promise<TitleVariant[]> {
  const { ever, adjectives } = variantCandidates(title, blockedTerms);
  const keys = [...(ever ? [ever.key] : []), ...adjectives.map((a) => a.key)];
  const free = keys.length > 0 ? await freeKeys(keys) : new Set<string>();

  const out: TitleVariant[] = [];
  if (ever && free.has(ever.key)) out.push({ kind: "ever", title: ever });
  const adj = adjectives.find((a) => free.has(a.key));
  if (adj) out.push({ kind: "adjective", title: adj });

  const displayPrefix = `${title.display} in `;
  if (codePointLength(displayPrefix) + TITLE_MIN_LENGTH <= TITLE_MAX_LENGTH) {
    out.push({ kind: "place", displayPrefix, placeholder: PLACE_PLACEHOLDER });
  }
  return out;
}
