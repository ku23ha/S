/** User-facing copy shared across pages, images and email. See docs/COPY.md. */

/** Must appear exactly, on every page, certificate image and email. */
export const DISCLAIMER =
  "A novelty registry for fun and affection. Titles have no legal or official status.";

export const PRODUCT_NAME = "The World's Best Registry";

export const HEADLINE = "Every 'World's Best' title can belong to one person. Is yours taken?";

/** Public contact address, set with NEXT_PUBLIC_CONTACT_EMAIL. */
export function contactEmail(): string | null {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
}

export const HOW_IT_WORKS = [
  { step: "Search", text: "Type a title after “World's Best” and see if it is free." },
  { step: "Claim", text: "Enter who it is for, add a dedication if you like, and pay once." },
  { step: "Share", text: "They get a numbered certificate page that is theirs alone." },
] as const;
