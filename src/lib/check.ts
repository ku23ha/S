/**
 * Title availability check, shared by GET /api/titles/check and the claim page.
 */
import type { Db } from "@/lib/db";
import { findFreeKeys, getActiveHolder, loadBlockedTerms, loadTierMap } from "@/lib/queries";
import {
  type ParsedTitle,
  type Tier,
  type TitleRejectReason,
  getTier,
  parseTitle,
  priceCents,
  suggestVariants,
} from "@/lib/titles";

export interface PricedTitle extends ParsedTitle {
  tier: Tier;
  priceCents: number;
}

export type CheckVariant =
  | { kind: "ever" | "adjective"; title: PricedTitle }
  | { kind: "place"; displayPrefix: string; placeholder: string };

export interface CheckHolder {
  /** Hidden while the entry is in review. */
  recipientName: string | null;
  registryNo: number | null;
  claimedAt: string | null;
  slug: string;
  inReview: boolean;
}

export type CheckResult =
  | { status: "not_allowed"; reason: TitleRejectReason; message: string }
  | { status: "available"; title: PricedTitle }
  | { status: "reserved"; title: PricedTitle; variants: CheckVariant[] }
  | { status: "taken"; title: PricedTitle; holder: CheckHolder; variants: CheckVariant[] };

function priced(t: ParsedTitle, tiers: Map<string, Exclude<Tier, "standard">>): PricedTitle {
  const tier = getTier(t.key, tiers);
  return { ...t, tier, priceCents: priceCents(tier, false) };
}

export async function checkTitle(db: Db, raw: string): Promise<CheckResult> {
  const [blocked, tiers] = await Promise.all([loadBlockedTerms(db), loadTierMap(db)]);
  const parsed = parseTitle(raw, blocked);
  if (!parsed.ok) return { status: "not_allowed", reason: parsed.reason, message: parsed.message };

  const title = priced(parsed.title, tiers);
  const holder = await getActiveHolder(db, title.key);
  if (!holder) return { status: "available", title };

  const variants: CheckVariant[] = (await suggestVariants(parsed.title, blocked, (keys) => findFreeKeys(db, keys))).map(
    (v) => (v.kind === "place" ? v : { kind: v.kind, title: priced(v.title, tiers) }),
  );

  if (holder.status === "reserved") return { status: "reserved", title, variants };

  const inReview = holder.status === "in_review";
  return {
    status: "taken",
    title: { ...title, display: holder.titleDisplay },
    holder: {
      recipientName: inReview ? null : holder.recipientName,
      registryNo: holder.registryNo,
      claimedAt: holder.claimedAt ? holder.claimedAt.toISOString() : null,
      slug: holder.slug,
      inReview,
    },
    variants,
  };
}
