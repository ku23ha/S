/**
 * Claim form input. Shared by the claim form (client) and POST /api/checkout
 * (server). There is deliberately no price field: prices come from the tier.
 */
import { z } from "zod";
import { CONTACT_DETAIL_MESSAGES, findContactDetail } from "@/lib/titles";

export const NAME_MAX = 60;
export const DEDICATION_MAX = 120;
export const DEDICATION_MAX_WITH_PRINT = 280;

// Control characters and angle brackets are never needed in a name or note.
const FORBIDDEN_CHARS = /[\u0000-\u001F\u007F-\u009F<>]/u;

function freeText(label: string, max: number) {
  return z
    .string()
    .transform((s) => s.normalize("NFKC").replace(/\s+/gu, " ").trim())
    .refine((s) => [...s].length <= max, `${label} can be at most ${max} characters.`)
    .refine((s) => !FORBIDDEN_CHARS.test(s), `${label} contains characters that can't be used.`)
    .superRefine((s, ctx) => {
      const c = findContactDetail(s);
      if (c) ctx.addIssue({ code: "custom", message: CONTACT_DETAIL_MESSAGES[c] });
    });
}

export const ClaimInput = z
  .object({
    title: z.string().min(1).max(200),
    recipientName: freeText("The name", NAME_MAX).refine((s) => s.length > 0, "Enter who this title is for."),
    giverName: freeText("The from line", NAME_MAX).optional().default(""),
    dedication: freeText("The dedication", DEDICATION_MAX_WITH_PRINT).optional().default(""),
    email: z
      .string()
      .trim()
      .max(254)
      .pipe(z.email("Enter a valid email address.")),
    addonPrint: z.boolean().default(false),
    refSlug: z.string().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.addonPrint && [...v.dedication].length > DEDICATION_MAX) {
      ctx.addIssue({
        code: "custom",
        path: ["dedication"],
        message: `The dedication can be at most ${DEDICATION_MAX} characters, or ${DEDICATION_MAX_WITH_PRINT} with the print file.`,
      });
    }
  });

export type ClaimInput = z.infer<typeof ClaimInput>;
