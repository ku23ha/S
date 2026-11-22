/**
 * Reports from the public "Report this page" link, and the moderation rules
 * that act on them before an admin looks:
 * - a report from the person named ("about_me") hides the page at once;
 * - three open reports of any kind hide it.
 * Hidden means status in_review: the page shows "in review" and the title
 * stays held. The admin then approves (restores) or removes it.
 */
import { z } from "zod";
import { CONTACT_DETAIL_MESSAGES, findContactDetail } from "@/lib/titles";
import type { Db } from "@/lib/db";

export const REPORT_REASONS = {
  offensive: "It's offensive or hurtful",
  about_me: "It's about me and I want it removed",
  spam: "It's spam or advertising",
  other: "Something else",
} as const;

export const AUTO_HIDE_OPEN_REPORTS = 3;

export const ReportInput = z.object({
  slug: z.string().min(1).max(200),
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS, ...(keyof typeof REPORT_REASONS)[]]),
  details: z
    .string()
    .max(500)
    .optional()
    .default("")
    .transform((s) => s.normalize("NFKC").trim())
    .superRefine((s, ctx) => {
      const c = findContactDetail(s);
      if (c && c !== "email") ctx.addIssue({ code: "custom", message: CONTACT_DETAIL_MESSAGES[c] });
    }),
  reporterEmail: z.union([z.literal(""), z.email("Enter a valid email address or leave it empty.")]).optional(),
});

export type ReportInput = z.infer<typeof ReportInput>;

export type ReportResult = { ok: true; hidden: boolean } | { ok: false; status: 404; error: string };

export async function submitReport(db: Db, input: ReportInput): Promise<ReportResult> {
  return db.transaction(async (tx) => {
    const rows = await tx.query<{ id: string; status: string }>(
      `select id, status from titles where slug = $1 and status in ('claimed','in_review') limit 1 for update`,
      [input.slug],
    );
    const t = rows[0];
    if (!t) return { ok: false, status: 404, error: "That certificate wasn't found." };

    const reason = input.details ? `${input.reason}: ${input.details}` : input.reason;
    await tx.query(`insert into reports (title_id, reason, reporter_email) values ($1, $2, $3)`, [
      t.id,
      reason,
      input.reporterEmail || null,
    ]);

    const open = await tx.query<{ c: number }>(`select count(*)::int as c from reports where title_id = $1 and not resolved`, [t.id]);
    const hide = t.status === "claimed" && (input.reason === "about_me" || (open[0]?.c ?? 0) >= AUTO_HIDE_OPEN_REPORTS);
    if (hide) {
      await tx.query(`update titles set status = 'in_review', updated_at = now() where id = $1`, [t.id]);
    }
    return { ok: true, hidden: hide };
  });
}
