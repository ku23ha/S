/**
 * Outbound store links for the gift shop. Nothing is sold or carted here:
 * every link opens the store's own search results in a new tab. Affiliate
 * ids are optional and come from public env vars; when any is set, the shop
 * discloses it.
 */

export type StoreId = "amazon_in" | "amazon_com" | "flipkart" | "myntra";

export const STORES: Record<StoreId, { label: string; region: string }> = {
  amazon_in: { label: "Amazon.in", region: "India" },
  flipkart: { label: "Flipkart", region: "India" },
  myntra: { label: "Myntra", region: "India" },
  amazon_com: { label: "Amazon.com", region: "US and worldwide" },
};

const TAGS = {
  amazon_in: process.env.NEXT_PUBLIC_AMAZON_TAG_IN,
  amazon_com: process.env.NEXT_PUBLIC_AMAZON_TAG_COM,
  flipkart: process.env.NEXT_PUBLIC_FLIPKART_AFFID,
} as const;

export function hasAffiliateIds(): boolean {
  return Boolean(TAGS.amazon_in || TAGS.amazon_com || TAGS.flipkart);
}

/** A store search URL for a query, with the affiliate id if configured. */
export function storeSearchUrl(store: StoreId, query: string): string {
  if (store === "flipkart") {
    const p = new URLSearchParams({ q: query });
    if (TAGS.flipkart) p.set("affid", TAGS.flipkart);
    return `https://www.flipkart.com/search?${p.toString()}`;
  }
  if (store === "myntra") {
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `https://www.myntra.com/${slug}?${new URLSearchParams({ rawQuery: query }).toString()}`;
  }
  const domain = store === "amazon_in" ? "amazon.in" : "amazon.com";
  const p = new URLSearchParams({ k: query });
  const tag = TAGS[store];
  if (tag) p.set("tag", tag);
  return `https://www.${domain}/s?${p.toString()}`;
}

export interface GiftIdea {
  id: string;
  name: string;
  why: string;
  /** Store search queries; a store without a query isn't shown for this idea. */
  queries: Partial<Record<StoreId, string>>;
}

export interface GiftShelf {
  id: string;
  name: string;
  blurb: string;
  ideas: GiftIdea[];
}

/** Curated pairings: things to unwrap alongside the certificate link. */
export const GIFT_SHELVES: GiftShelf[] = [
  {
    id: "keep",
    name: "Make the certificate something to hold",
    blurb: "Print the certificate and frame it, or tuck the link inside a card. The two most-bought companions.",
    ideas: [
      {
        id: "frame",
        name: "A4 photo frame",
        why: "The print file is sized for A4 and US Letter. A simple frame turns it into something for the wall.",
        queries: { amazon_in: "A4 certificate photo frame", flipkart: "A4 photo frame", amazon_com: "8.5x11 document frame" },
      },
      {
        id: "card",
        name: "Greeting card",
        why: "Write the certificate link inside, or the registry number. A small reveal before the big one.",
        queries: { amazon_in: "greeting cards blank inside", flipkart: "greeting card", amazon_com: "blank greeting cards" },
      },
    ],
  },
  {
    id: "christmas",
    name: "Christmas",
    blurb: "Pair the Christmas card from your certificate with something under the tree.",
    ideas: [
      {
        id: "xmas-cards",
        name: "Christmas cards",
        why: "For the friends and colleagues you'd like to include too.",
        queries: { amazon_in: "christmas greeting cards", flipkart: "christmas cards", amazon_com: "christmas cards boxed" },
      },
      {
        id: "xmas-hamper",
        name: "Christmas hamper",
        why: "Plum cake, cookies and chocolates to go with “World's Best Plum Cake Baker”.",
        queries: { amazon_in: "christmas gift hamper", flipkart: "christmas hamper", amazon_com: "christmas gift basket" },
      },
      {
        id: "xmas-decor",
        name: "Ornaments and lights",
        why: "For the “World's Best Christmas Tree Decorator”.",
        queries: { amazon_in: "christmas tree ornaments", flipkart: "christmas decoration lights", amazon_com: "christmas ornaments set" },
      },
      {
        id: "secret-santa",
        name: "Secret Santa under ₹500",
        why: "Small, fun gifts for the office exchange, alongside “World's Best Secret Santa”.",
        queries: { amazon_in: "secret santa gift under 500", flipkart: "secret santa gift" },
      },
    ],
  },
  {
    id: "love",
    name: "For your person",
    blurb: "Something to hold while they read their certificate.",
    ideas: [
      {
        id: "couple",
        name: "Couple keepsakes",
        why: "Matching mugs, keychains or bracelets for the two of you.",
        queries: { amazon_in: "couple gifts", flipkart: "couple gift set", myntra: "couple bracelets" },
      },
      {
        id: "jewellery",
        name: "Jewellery",
        why: "A small pendant or bracelet to go with “World's Best Girlfriend” or “Wife”.",
        queries: { myntra: "women pendant", amazon_in: "pendant for girlfriend", flipkart: "pendant for women" },
      },
      {
        id: "fragrance",
        name: "Fragrance",
        why: "A classic pairing for “World's Best Boyfriend” or “Husband”.",
        queries: { myntra: "perfume gift set", amazon_in: "perfume gift set", flipkart: "perfume gift set" },
      },
      {
        id: "chocolates",
        name: "Chocolates and flowers",
        why: "The timeless add-on. Order it to arrive the day you send the link.",
        queries: { amazon_in: "chocolate gift box", flipkart: "chocolate gift pack", amazon_com: "chocolate gift box" },
      },
    ],
  },
  {
    id: "family",
    name: "Family",
    blurb: "For Mom's chai, Dad's driving, and the sibling who always shows up.",
    ideas: [
      {
        id: "mug",
        name: "A mug for the morning",
        why: "For “World's Best Chai Maker” or “Dad Joke Teller”. Pick one plain enough to let the certificate do the talking.",
        queries: { amazon_in: "ceramic coffee mug gift", flipkart: "ceramic mug", amazon_com: "ceramic mug gift" },
      },
      {
        id: "watch",
        name: "Watches",
        why: "A lasting gift for a parent, to go with “World's Best Dad” or “Mom”.",
        queries: { myntra: "watches", amazon_in: "watch gift for father", flipkart: "watch for men" },
      },
      {
        id: "rakhi",
        name: "Rakhi and sibling gifts",
        why: "For “World's Best Big Sister” or “Little Brother”, any time of year.",
        queries: { amazon_in: "gift for sister", flipkart: "gift for brother", myntra: "gift for sister" },
      },
      {
        id: "plants",
        name: "Indoor plants",
        why: "For “World's Best Plant Mom”, obviously.",
        queries: { amazon_in: "indoor plant gift pot", flipkart: "indoor plants", amazon_com: "indoor plant gift" },
      },
    ],
  },
];
