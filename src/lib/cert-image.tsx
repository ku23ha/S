/**
 * Certificate images with next/og (Satori + Resvg): the 1200x630 share
 * image, the 1080x1920 story image, and A4 / US Letter print files.
 *
 * Fonts are bundled Noto files (assets/fonts, SIL OFL) covering Latin,
 * Greek, Cyrillic, Devanagari, Bengali and Tamil; emoji come from Twemoji.
 * Text in other scripts would render as empty boxes, and Satori cannot
 * shape Indic conjuncts, so such names are left off the image and replaced
 * by a pointer to the certificate page, which shows them correctly.
 * Every image carries the disclaimer line.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { DISCLAIMER, PRODUCT_NAME } from "@/lib/copy";
import { formatDate, formatRegistryNo } from "@/lib/format";
import { TITLE_PREFIX } from "@/lib/titles";
import { errorSummary } from "@/lib/log";

export type ImageKind = "share" | "story" | "a4" | "letter";

export const IMAGE_SIZES: Record<ImageKind, { width: number; height: number }> = {
  share: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
  a4: { width: 2480, height: 3508 }, // 210 x 297 mm at 300 dpi
  letter: { width: 2550, height: 3300 }, // 8.5 x 11 in at 300 dpi
};

export interface CertImageData {
  titleDisplay: string;
  recipientName: string;
  registryNo: number | null;
  claimedAt: Date | string | null;
  giverName?: string | null;
  dedication?: string | null;
  inReview?: boolean;
  siteHost: string;
}

const SUPPORTED_TEXT =
  /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Tamil}\p{Script=Common}\p{Script=Inherited}]*$/u;

/**
 * Satori does not shape complex scripts: Indic conjuncts (a virama between
 * consonants) and vowel signs written before their consonant come out wrong.
 * Text without them, such as "मीरा", draws correctly.
 */
const NEEDS_SHAPING =
  /[्ि্িেৈোৌ்ெேைொோௌ]/u;

/** True if the image renderer can draw every character correctly. */
export function isRenderable(text: string): boolean {
  return SUPPORTED_TEXT.test(text) && !NEEDS_SHAPING.test(text);
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

type FontSpec = { name: string; file: string; weight: 400 | 700 };

const FONT_FILES: FontSpec[] = [
  { name: "Noto Serif", file: "noto-serif-latin-400-normal.woff", weight: 400 },
  { name: "Noto Serif", file: "noto-serif-latin-700-normal.woff", weight: 700 },
  { name: "Noto Serif", file: "noto-serif-latin-ext-700-normal.woff", weight: 700 },
  { name: "Noto Serif", file: "noto-serif-cyrillic-700-normal.woff", weight: 700 },
  { name: "Noto Serif", file: "noto-serif-greek-700-normal.woff", weight: 700 },
  { name: "Noto Sans", file: "noto-sans-latin-400-normal.woff", weight: 400 },
  { name: "Noto Sans", file: "noto-sans-latin-700-normal.woff", weight: 700 },
  { name: "Noto Sans", file: "noto-sans-latin-ext-400-normal.woff", weight: 400 },
  { name: "Noto Sans", file: "noto-sans-cyrillic-400-normal.woff", weight: 400 },
  { name: "Noto Sans", file: "noto-sans-greek-400-normal.woff", weight: 400 },
  { name: "Noto Sans Devanagari", file: "noto-sans-devanagari-devanagari-400-normal.woff", weight: 400 },
  { name: "Noto Sans Devanagari", file: "noto-sans-devanagari-devanagari-700-normal.woff", weight: 700 },
  { name: "Noto Sans Bengali", file: "noto-sans-bengali-bengali-400-normal.woff", weight: 400 },
  { name: "Noto Sans Bengali", file: "noto-sans-bengali-bengali-700-normal.woff", weight: 700 },
  { name: "Noto Sans Tamil", file: "noto-sans-tamil-tamil-400-normal.woff", weight: 400 },
  { name: "Noto Sans Tamil", file: "noto-sans-tamil-tamil-700-normal.woff", weight: 700 },
];

type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };
let fontsPromise: Promise<LoadedFont[]> | null = null;

function loadFonts(): Promise<LoadedFont[]> {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async (f) => {
      const buf = await readFile(path.join(process.cwd(), "assets", "fonts", f.file));
      const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return { name: f.name, data, weight: f.weight, style: "normal" as const };
    }),
  ).catch((err) => {
    fontsPromise = null;
    throw err;
  });
  return fontsPromise;
}

const SERIF = "'Noto Serif', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Tamil', 'Noto Sans'";
const SANS = "'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Tamil'";

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const INK = "#1c1917";
const MUTED = "#57534e";
const GOLD = "#b45309";
const PAPER = "#fffbeb";

function sizeFor(text: string, sizes: [number, number][], fallback: number): number {
  const n = [...text].length;
  for (const [max, size] of sizes) if (n <= max) return size;
  return fallback;
}

function Certificate({ d, kind }: { d: CertImageData; kind: ImageKind }) {
  const { width, height } = IMAGE_SIZES[kind];
  const landscape = kind === "share";
  // Portrait layouts scale from a 1080-wide design.
  const s = landscape ? 1 : width / 1080;
  const showName = !d.inReview && isRenderable(d.recipientName);
  const showGiver = !landscape && !d.inReview && !!d.giverName && isRenderable(d.giverName);
  const showDedication = !landscape && !d.inReview && !!d.dedication && isRenderable(d.dedication);
  const title = isRenderable(d.titleDisplay) ? d.titleDisplay : "";

  const titleSize = landscape
    ? sizeFor(title, [[12, 104], [20, 84], [28, 68]], 56)
    : sizeFor(title, [[12, 132], [20, 110], [28, 92]], 76) * s;
  const nameSize = landscape
    ? sizeFor(d.recipientName, [[16, 60], [28, 48], [40, 38]], 30)
    : sizeFor(d.recipientName, [[16, 84], [28, 68], [40, 56]], 44) * s;

  const meta = [formatRegistryNo(d.registryNo), formatDate(d.claimedAt)].filter(Boolean).join("  ·  ");

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        background: PAPER,
        padding: landscape ? 28 : 56 * s,
        fontFamily: SANS,
        color: INK,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          border: `${landscape ? 6 : 10 * s}px solid ${GOLD}`,
          borderRadius: landscape ? 24 : 36 * s,
          padding: landscape ? 8 : 14 * s,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            textAlign: "center",
            border: `${landscape ? 2 : 3 * s}px solid ${GOLD}`,
            borderRadius: landscape ? 16 : 26 * s,
            padding: landscape ? "28px 48px 20px" : `${90 * s}px ${70 * s}px ${50 * s}px`,
          }}
        >
          <div style={{ display: "flex", fontSize: landscape ? 20 : 30 * s, letterSpacing: 6, color: GOLD, fontWeight: 700 }}>
            {PRODUCT_NAME.toUpperCase()}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", fontSize: landscape ? 24 : 38 * s, letterSpacing: 4, color: MUTED }}>
              {TITLE_PREFIX.toUpperCase()}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                fontFamily: SERIF,
                fontWeight: 700,
                fontSize: titleSize,
                lineHeight: 1.1,
                marginTop: landscape ? 4 : 12 * s,
                wordBreak: "break-word",
                maxWidth: "100%",
              }}
            >
              {title}
            </div>

            {d.inReview ? (
              <div style={{ display: "flex", marginTop: landscape ? 24 : 60 * s, fontSize: landscape ? 26 : 40 * s, color: MUTED }}>
                In review
              </div>
            ) : showName ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: landscape ? 18 : 70 * s, width: "100%" }}>
                <div style={{ display: "flex", fontSize: landscape ? 24 : 36 * s, color: MUTED }}>is held by</div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    fontFamily: SERIF,
                    fontWeight: 700,
                    fontSize: nameSize,
                    lineHeight: 1.15,
                    marginTop: landscape ? 4 : 10 * s,
                    wordBreak: "break-word",
                    maxWidth: "100%",
                  }}
                >
                  {d.recipientName}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", marginTop: landscape ? 24 : 70 * s, fontSize: landscape ? 28 : 44 * s, color: MUTED }}>
                The holder&apos;s name is on the certificate page
              </div>
            )}

            {showDedication && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 60 * s,
                  fontSize: sizeFor(d.dedication ?? "", [[60, 44], [140, 36]], 30) * s,
                  fontStyle: "italic",
                  color: "#44403c",
                  lineHeight: 1.35,
                  maxWidth: "90%",
                  wordBreak: "break-word",
                }}
              >
                {`“${d.dedication}”`}
              </div>
            )}
            {showGiver && (
              <div style={{ display: "flex", marginTop: 28 * s, fontSize: 34 * s, color: MUTED }}>{`From ${d.giverName}`}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
            {meta && (
              <div style={{ display: "flex", fontSize: landscape ? 24 : 36 * s, color: INK, fontWeight: 700 }}>{meta}</div>
            )}
            {kind === "story" && (
              <div style={{ display: "flex", marginTop: 40 * s, fontSize: 38 * s, color: GOLD, fontWeight: 700 }}>
                {`Is your title taken? ${d.siteHost}`}
              </div>
            )}
            {kind !== "story" && (
              <div style={{ display: "flex", marginTop: landscape ? 6 : 20 * s, fontSize: landscape ? 20 : 30 * s, color: MUTED }}>
                {d.siteHost}
              </div>
            )}
            <div
              style={{
                display: "flex",
                marginTop: landscape ? 10 : 28 * s,
                fontSize: landscape ? 16 : 24 * s,
                color: MUTED,
                maxWidth: "95%",
                justifyContent: "center",
              }}
            >
              {DISCLAIMER}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fallback({ kind, siteHost }: { kind: ImageKind; siteHost: string }) {
  const { width, height } = IMAGE_SIZES[kind];
  const s = width / 1200;
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: PAPER,
        color: INK,
        textAlign: "center",
        padding: 60 * s,
      }}
    >
      <div style={{ display: "flex", fontSize: 64 * s, fontWeight: 700 }}>{PRODUCT_NAME}</div>
      <div style={{ display: "flex", fontSize: 32 * s, marginTop: 24 * s, color: MUTED }}>{siteHost}</div>
      <div style={{ display: "flex", fontSize: 22 * s, marginTop: 40 * s, color: MUTED }}>{DISCLAIMER}</div>
    </div>
  );
}

/** Render an image and buffer it, so rendering errors surface here, not mid-stream. */
async function toPng(element: ReactElement, kind: ImageKind, fonts?: LoadedFont[]): Promise<ArrayBuffer> {
  const res = new ImageResponse(element, { ...IMAGE_SIZES[kind], fonts, emoji: "twemoji" });
  return res.arrayBuffer();
}

export async function renderCertificatePng(d: CertImageData, kind: ImageKind): Promise<ArrayBuffer> {
  return toPng(<Certificate d={d} kind={kind} />, kind, await loadFonts());
}

/**
 * Certificate image response. On any rendering failure, logs and serves a
 * plain fallback image instead.
 */
export async function certificateImageResponse(
  d: CertImageData | null,
  kind: ImageKind,
  headers: Record<string, string>,
  siteHost: string,
): Promise<Response> {
  try {
    if (!d) throw new Error("no certificate");
    const png = await renderCertificatePng(d, kind);
    return new Response(png, { headers: { "Content-Type": "image/png", ...headers } });
  } catch (err) {
    if (d) console.error(`certificate image (${kind}) failed`, errorSummary(err));
    const png = await toPng(<Fallback kind={kind} siteHost={siteHost} />, kind);
    return new Response(png, {
      status: d ? 200 : 404,
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60" },
    });
  }
}
