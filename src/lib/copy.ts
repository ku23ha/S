/** User-facing copy shared across pages, images and email. See docs/COPY.md. */

/** Must appear exactly, on every page, certificate image and email. */
export const DISCLAIMER =
  "A novelty registry for fun and affection. Titles have no legal or official status.";

export const PRODUCT_NAME = "The World's Best Registry";

export const HEADLINE = "Every 'World's Best' title can belong to one person. Is yours taken?";

/** Christmas extras (card download, collection first) run 15 November to 6 January. */
export function isChristmasSeason(now = new Date()): boolean {
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return (m === 10 && d >= 15) || m === 11 || (m === 0 && d <= 6);
}

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

/** Curated starting points, grouped by who it's for. Each opens the claim page. */
export const COLLECTIONS = [
  {
    id: "christmas",
    name: "Christmas",
    blurb: "A gift that arrives as a link and lasts longer than the wrapping. Every certificate comes with a Christmas card to share.",
    titles: [
      { title: "Santa", note: "for whoever plays him" },
      { title: "Secret Santa", note: "for the office exchange" },
      { title: "Gift Wrapper", note: "for the neat one" },
      { title: "Christmas Tree Decorator", note: "for the lights person" },
      { title: "Plum Cake Baker", note: "for the kitchen star" },
      { title: "Elf", note: "for the helper" },
    ],
  },
  {
    id: "love",
    name: "For your person",
    blurb: "For the one who already knows they're the best. Now it's on the record.",
    titles: [
      { title: "Girlfriend", note: "iconic, one holder" },
      { title: "Boyfriend", note: "iconic, one holder" },
      { title: "Person I've Ever Dated", note: "for the one who stayed" },
      { title: "Smile", note: "for the one you look for" },
      { title: "Cuddler", note: "for the warm one" },
      { title: "Good Morning Texter", note: "for the first message of the day" },
    ],
  },
  {
    id: "family",
    name: "Family",
    blurb: "Mum's chai, Dad's driving, the sibling who always shows up.",
    titles: [
      { title: "Dad", note: "the classic" },
      { title: "Mom", note: "the classic" },
      { title: "Big Sister", note: "for Rakhi or her birthday" },
      { title: "Chai Maker", note: "for the morning hero" },
      { title: "Dad Joke Teller", note: "for the groaner" },
      { title: "Plant Mom", note: "for the green thumb" },
    ],
  },
  {
    id: "friends",
    name: "Friends & work",
    blurb: "Birthdays, farewells, team awards and inside jokes.",
    titles: [
      { title: "Road Trip Navigator", note: "for the co-pilot" },
      { title: "Work Bestie", note: "for the desk neighbour" },
      { title: "Boss", note: "iconic, one holder" },
      { title: "Parallel Parker", note: "for the show-off" },
      { title: "Hug Giver", note: "for your person" },
      { title: "Biryani Finder", note: "for the foodie" },
    ],
  },
] as const;

/** Why a certificate from here means something. Every line must stay literally true. */
export const TRUST = [
  {
    title: "One holder, enforced",
    text: "Uniqueness is built into the registry itself. Once a title is claimed, the system will not accept a second holder, today or ever.",
  },
  {
    title: "A public, numbered record",
    text: "Every certificate gets the next registry number and its own page. Anyone can look it up, and numbers are never reused.",
  },
  {
    title: "Made to keep",
    text: "Share images sized for WhatsApp and stories, a QR code that leads back to the page, and a print file for framing.",
  },
  {
    title: "Fair by design",
    text: "Fixed prices that never change with demand, a secure hosted checkout, and a full refund if anything goes wrong.",
  },
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
    a: "After paying you get a link to their certificate, images to share and, around Christmas, a Christmas card. Send it on WhatsApp, reveal it at dinner, or add the print file to frame it.",
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
