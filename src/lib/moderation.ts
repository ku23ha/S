/**
 * Moderation for paid claims. Titles with blocked terms never reach checkout
 * (src/lib/titles.ts); this checks the free-text fields buyers add, and sends
 * anything suspicious to the review queue (status in_review) instead of
 * publishing it. Milestone 5 extends the rules and adds the admin queue.
 */
import { findBlockedTerm, findContactDetail, normalizeTitleKey } from "@/lib/titles";

export interface ModerationInput {
  titleKey: string;
  recipientName: string;
  giverName: string | null;
  dedication: string | null;
}

export interface ModerationResult {
  flagged: boolean;
  reasons: string[];
}

export function moderateClaim(input: ModerationInput, blockedTerms: readonly string[]): ModerationResult {
  const reasons: string[] = [];
  const fields: [string, string | null][] = [
    ["title", input.titleKey],
    ["recipient", input.recipientName],
    ["from", input.giverName],
    ["dedication", input.dedication],
  ];
  for (const [name, value] of fields) {
    if (!value) continue;
    const term = findBlockedTerm(normalizeTitleKey(value), blockedTerms);
    if (term) reasons.push(`${name}: blocked term`);
    if (findContactDetail(value)) reasons.push(`${name}: contact detail`);
  }
  return { flagged: reasons.length > 0, reasons };
}
