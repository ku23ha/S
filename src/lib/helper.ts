import { DISCLAIMER } from "@/lib/copy";

/**
 * The gift helper's script and the dedication templates. Everything here is
 * written by us, not generated: the helper only picks from these lists.
 */

export interface Recipient {
  id: string;
  label: string;
  emoji: string;
  titles: string[];
}

/** "Who is it for?" → titles worth checking first. Specific, personal titles are usually free. */
export const RECIPIENTS: Recipient[] = [
  { id: "partner-f", label: "Girlfriend or wife", emoji: "💛", titles: ["Girlfriend", "Wife", "Smile", "Good Morning Texter", "Hug Giver", "Road Trip Partner"] },
  { id: "partner-m", label: "Boyfriend or husband", emoji: "💙", titles: ["Boyfriend", "Husband", "Cuddler", "Late Night Driver", "Maggi Maker", "Person I've Ever Dated"] },
  { id: "mom", label: "Mom", emoji: "🌸", titles: ["Mom", "Chai Maker", "Plant Mom", "Worrier", "Packed Lunch Maker", "Hug Giver"] },
  { id: "dad", label: "Dad", emoji: "🧢", titles: ["Dad", "Dad Joke Teller", "Parallel Parker", "Remote Control Holder", "Bargainer", "Driver"] },
  { id: "sibling", label: "Sister or brother", emoji: "🤝", titles: ["Big Sister", "Little Brother", "Secret Keeper", "Partner in Crime", "Wardrobe Lender", "Sibling"] },
  { id: "friend", label: "Best friend", emoji: "🫶", titles: ["Best Friend", "Hype Woman", "Hype Man", "Voice Note Sender", "3 AM Friend", "Wingman"] },
  { id: "grand", label: "Grandparent", emoji: "👵", titles: ["Grandma", "Grandpa", "Storyteller", "Pickle Maker", "Spoiler of Grandkids", "Laddoo Maker"] },
  { id: "work", label: "Colleague or boss", emoji: "💼", titles: ["Boss", "Desk Neighbour", "Secret Santa", "Meeting Saver", "Chai Break Planner", "Excel Wizard"] },
  { id: "teacher", label: "Teacher", emoji: "📚", titles: ["Teacher", "Maths Teacher", "Explainer", "Mentor", "Coach", "Homework Forgiver"] },
  { id: "christmas", label: "Christmas", emoji: "🎄", titles: ["Santa", "Secret Santa", "Gift Wrapper", "Christmas Tree Decorator", "Plum Cake Baker", "Elf"] },
];

export type Tone = "sweet" | "funny" | "grateful" | "christmas";

export const TONES: { id: Tone; label: string }[] = [
  { id: "sweet", label: "Sweet" },
  { id: "funny", label: "Funny" },
  { id: "grateful", label: "Grateful" },
  { id: "christmas", label: "Christmas" },
];

/** Dedication templates; {name} becomes the recipient's first name. All under 120 characters once filled. */
const TEMPLATES: Record<Tone, string[]> = {
  sweet: [
    "For being the best part of every ordinary day, {name}. Now it's on the record.",
    "{name}, of all the people in the world, it was always going to be you.",
    "Because you make everything feel like home, {name}.",
  ],
  funny: [
    "After careful research and zero competition, {name} wins. Again.",
    "{name}: unbeatable at this. Please don't let it go to your head.",
    "The judges (me) have decided, {name}. No appeals.",
  ],
  grateful: [
    "For every time you showed up without being asked. Thank you, {name}.",
    "{name}, you made the hard days lighter. This one is yours.",
    "For all the things you never got thanked for, {name}.",
  ],
  christmas: [
    "Merry Christmas, {name}. The best gift was always you.",
    "Santa checked the list twice, {name}. Still you.",
    "For making every Christmas feel like Christmas, {name}.",
  ],
};

function firstName(name: string): string {
  const n = name.trim().split(/\s+/)[0] ?? "";
  return n || "you";
}

export function dedicationTemplates(tone: Tone, recipientName: string): string[] {
  return TEMPLATES[tone].map((t) => t.replaceAll("{name}", firstName(recipientName)));
}

/** Scripted questions and answers for the helper (mirrors the FAQ, in a friendlier voice). */
export const HELPER_ANSWERS: { id: string; q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    id: "what",
    q: "What is this?",
    a: "A public registry where every “World's Best ___” title can belong to one person. You claim one for someone you love, and they get a numbered certificate page with their name on it. Once it's claimed, no one else can hold that title.",
  },
  {
    id: "real",
    q: "Is it a real award?",
    a: `It's a keepsake, not an award. ${DISCLAIMER} What is true: the registry keeps one holder per title, and the certificate page and number are theirs for good.`,
  },
  {
    id: "delivery",
    q: "How do they get it?",
    a: "Instantly. After you pay you see the certificate, and we email you the link. Send it however you like, or as a surprise: they see a sealed envelope and open it themselves. You can also download a print file and frame it.",
    link: { href: "/delivery", label: "Delivery policy" },
  },
  {
    id: "price",
    q: "How much is it?",
    a: "One payment, no subscription. Most personal titles are the Standard price; common family titles cost a little more, and the 25 iconic ones (like Dad or Mom) the most. The price is shown before you pay.",
    link: { href: "/#pricing", label: "See prices" },
  },
  {
    id: "refund",
    q: "What if something goes wrong?",
    a: "If someone else claimed the title first, or your entry can't be approved, you're refunded in full automatically. You can fix typos for 24 hours with the private link in your email.",
    link: { href: "/refunds", label: "Cancellation and refunds" },
  },
];
