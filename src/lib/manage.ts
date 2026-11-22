/**
 * Buyer corrections through the manage link: recipient name, from line and
 * dedication, within 24 hours of the claim. Moderation runs again; a flagged
 * edit sends the certificate to review, and an entry already in review stays
 * there until an admin decides.
 */
import { DEDICATION_MAX, type ManageInput, canEdit } from "@/lib/claim";
import type { Db } from "@/lib/db";
import { moderateClaim } from "@/lib/moderation";
import { getTitleByManageToken, loadBlockedTerms } from "@/lib/queries";

export type ManageResult =
  | { ok: true; status: "claimed" | "in_review" }
  | { ok: false; status: 400 | 403 | 404; error: string };

export async function applyManageEdit(db: Db, token: string, input: ManageInput, now = Date.now()): Promise<ManageResult> {
  const t = await getTitleByManageToken(db, token);
  if (!t) return { ok: false, status: 404, error: "This link isn't valid." };
  if (!canEdit(t.claimedAt, now)) {
    return { ok: false, status: 403, error: "Edits are only possible within 24 hours of the claim." };
  }
  if (!t.addonPrint && [...input.dedication].length > DEDICATION_MAX) {
    return { ok: false, status: 400, error: `The dedication can be at most ${DEDICATION_MAX} characters.` };
  }

  const blocked = await loadBlockedTerms(db);
  const mod = moderateClaim(
    { titleKey: t.titleKey, recipientName: input.recipientName, giverName: input.giverName || null, dedication: input.dedication || null },
    blocked,
  );
  const status = mod.flagged || t.status === "in_review" ? "in_review" : "claimed";

  await db.query(
    `update titles set recipient_name = $2, giver_name = $3, dedication = $4, status = $5, updated_at = now()
     where id = $1 and status in ('claimed','in_review')`,
    [t.id, input.recipientName, input.giverName || null, input.dedication || null, status],
  );
  return { ok: true, status };
}
