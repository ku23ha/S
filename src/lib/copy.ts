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

export const TAGLINE = "The gift only one person can have";

export const SUBHEAD =
  "Search any “World's Best” title. If it's free, give it to someone you love. They become its only holder, with a numbered certificate page that's theirs for good.";

/** Things that are true of every claim, shown near the search box. */
export const PROMISES = [
  "One holder per title, ever",
  "Numbered public certificate",
  "Secure checkout, no account",
  "Refund if it isn't approved",
] as const;

/** Starting points for people who don't know what to search. Each links to the claim page. */
export const GIFT_IDEAS = [
  { title: "Dad", note: "the classic" },
  { title: "Big Sister", note: "for Rakhi or her birthday" },
  { title: "Chai Maker", note: "for the morning hero" },
  { title: "Road Trip Navigator", note: "for the co-pilot" },
  { title: "Plant Mom", note: "for the green thumb" },
  { title: "Dad Joke Teller", note: "for the groaner" },
  { title: "Parallel Parker", note: "for the show-off" },
  { title: "Hug Giver", note: "for your person" },
] as const;

export const BENEFITS = [
  {
    title: "Truly one of a kind",
    text: "Each title can have exactly one holder. Once it's claimed, nobody else can ever claim it.",
  },
  {
    title: "A page they'll show people",
    text: "A numbered certificate page with their name, your note and the date, plus images sized for WhatsApp and Instagram stories.",
  },
  {
    title: "Given in two minutes",
    text: "No account and no app. Type the title, add their name and a dedication, pay once, and send the link.",
  },
] as const;

export const FAQ = [
  {
    q: "What exactly am I buying?",
    a: `A title in the registry under the name you choose, with its own public certificate page, share images and a registry number. It's a keepsake and a bit of fun: ${DISCLAIMER}`,
  },
  {
    q: "What if the title I want is taken?",
    a: "You'll see who holds it and since when, plus close titles that are still free, such as adding “Ever” or a place: “World's Best Dad in Pune”.",
  },
  {
    q: "Can someone else take the title later?",
    a: "No. There's no bidding, no renewals and no transfers. Once claimed, it stays with the person you named.",
  },
  {
    q: "How do I give it?",
    a: "After paying you get a link to their certificate and images to share. Send it on WhatsApp, reveal it at dinner, or add the print file (+$7) to frame it.",
  },
  {
    q: "What if I make a typo?",
    a: "Your email includes a private link. You can fix the name, the “from” line or the dedication for 24 hours.",
  },
  {
    q: "What if something goes wrong?",
    a: "If someone else completes a claim before your payment arrives, or your entry doesn't pass review, you're refunded in full automatically.",
  },
  {
    q: "Is my email shown anywhere?",
    a: "Never. It's only used to send you the certificate link and receipts. The certificate shows only what you write on it.",
  },
] as const;

export const HOW_IT_WORKS = [
  { step: "Search", text: "Type a title after “World's Best” and see if it is free." },
  { step: "Claim", text: "Enter who it is for, add a dedication if you like, and pay once." },
  { step: "Share", text: "They get a numbered certificate page that is theirs alone." },
] as const;
