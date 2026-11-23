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
import { formatDate } from "@/lib/format";
import { TITLE_PREFIX } from "@/lib/titles";
import { errorSummary } from "@/lib/log";
import { qrDataUri } from "@/lib/qr";

export type ImageKind = "share" | "story" | "a4" | "letter" | "christmas";

export const IMAGE_SIZES: Record<ImageKind, { width: number; height: number }> = {
  share: { width: 1200, height: 630 },
  christmas: { width: 1080, height: 1350 }, // 4:5, fits Instagram and WhatsApp
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
  /** Public certificate URL, drawn as a QR code. */
  url?: string;
}

/** Gold seal with the registry number, drawn with boxes (Satori has no SVG text paths). */
function SealBox({ registryNo, size }: { registryNo: number | null; size: number }) {
  const no = registryNo == null ? "——" : String(registryNo).padStart(6, "0");
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 40% 35%, #f6e2a8 0%, #d4a548 55%, #9a6410 100%)",
        border: `${Math.max(2, size * 0.03)}px solid #8a5a0c`,
        boxShadow: "0 4px 10px rgba(91,53,4,0.35)",
        transform: "rotate(-8deg)",
      }}
    >
      <div
        style={{
          width: size * 0.74,
          height: size * 0.74,
          borderRadius: size,
          border: `${Math.max(1, size * 0.012)}px solid rgba(124,74,6,0.6)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#3f2503",
        }}
      >
        <div style={{ display: "flex", fontSize: size * 0.1, letterSpacing: size * 0.012, fontWeight: 700 }}>REGISTRY</div>
        <div style={{ display: "flex", fontSize: size * 0.17, fontWeight: 700, marginTop: size * 0.02 }}>{`No. ${no}`}</div>
        <div style={{ display: "flex", fontSize: size * 0.08, letterSpacing: size * 0.01, marginTop: size * 0.02 }}>ONE HOLDER</div>
      </div>
    </div>
  );
}

function FooterRow({ d, landscape, s }: { d: CertImageData; landscape: boolean; s: number }) {
  const seal = landscape ? 110 : 190 * s;
  const qr = landscape ? 92 : 150 * s;
  const label = landscape ? 15 : 24 * s;
  const value = landscape ? 22 : 34 * s;
  const date = d.claimedAt ? formatDate(d.claimedAt) : "";
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: `${landscape ? 1 : 2 * s}px solid rgba(161,98,10,0.4)`,
        paddingTop: landscape ? 10 : 30 * s,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: qr * 1.6, color: MUTED }}>
        <div style={{ display: "flex", fontSize: label, letterSpacing: 3 }}>ENTERED</div>
        <div style={{ display: "flex", fontSize: value, color: INK, fontFamily: SERIF, fontWeight: 700 }}>{date}</div>
      </div>
      <SealBox registryNo={d.registryNo} size={seal} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: qr * 1.6, color: MUTED }}>
        {d.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUri(d.url, INK, "#fffaf0")} width={qr} height={qr} alt="" />
        ) : (
          <div style={{ display: "flex", fontSize: value, color: INK, fontFamily: SERIF }}>{d.siteHost}</div>
        )}
        {d.url && <div style={{ display: "flex", fontSize: label, marginTop: 4 }}>Scan to look it up</div>}
      </div>
    </div>
  );
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
            <FooterRow d={d} landscape={landscape} s={s} />
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

const PINE = "#123528";
const PINE_DEEP = "#0b2419";
const CREAM = "#fdf6e3";
const GOLD_BRIGHT = "#e2b55a";

/** Deterministic "snow": small gold dots scattered across the card. */
function snow(width: number, height: number, count = 46) {
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: count }, (_, i) => {
    const r = 2 + rand() * 5;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: rand() * width,
          top: rand() * height,
          width: r,
          height: r,
          borderRadius: r,
          background: i % 3 === 0 ? GOLD_BRIGHT : "rgba(253,246,227,0.55)",
        }}
      />
    );
  });
}

/** Christmas card built from a certificate (1080 x 1350). */
function ChristmasCard({ d }: { d: CertImageData }) {
  const { width, height } = IMAGE_SIZES.christmas;
  const title = isRenderable(d.titleDisplay) ? d.titleDisplay : "";
  const showName = !d.inReview && isRenderable(d.recipientName);
  const showGiver = !d.inReview && !!d.giverName && isRenderable(d.giverName);
  const showDedication = !d.inReview && !!d.dedication && isRenderable(d.dedication);
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        position: "relative",
        background: `linear-gradient(160deg, ${PINE} 0%, ${PINE_DEEP} 100%)`,
        padding: 48,
        fontFamily: SANS,
        color: CREAM,
      }}
    >
      {snow(width, height)}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "center",
          border: `3px solid ${GOLD_BRIGHT}`,
          borderRadius: 32,
          padding: "64px 56px 40px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 10, color: GOLD_BRIGHT, fontWeight: 700 }}>MERRY CHRISTMAS</div>
          <div style={{ display: "flex", fontSize: 22, marginTop: 10, color: "rgba(253,246,227,0.75)" }}>and a very happy new year</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", fontSize: 30, color: "rgba(253,246,227,0.8)" }}>This year, you are the</div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 30, letterSpacing: 8, color: GOLD_BRIGHT }}>
            {TITLE_PREFIX.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: sizeFor(title, [[12, 120], [20, 96], [28, 80]], 64),
              lineHeight: 1.08,
              marginTop: 6,
              color: CREAM,
              wordBreak: "break-word",
              maxWidth: "100%",
            }}
          >
            {title}
          </div>
          {showName && (
            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: sizeFor(d.recipientName, [[16, 64], [28, 52]], 40),
                color: CREAM,
                wordBreak: "break-word",
              }}
            >
              {d.recipientName}
            </div>
          )}
          {showDedication && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 28,
                fontSize: sizeFor(d.dedication ?? "", [[60, 34], [140, 28]], 24),
                fontStyle: "italic",
                color: "rgba(253,246,227,0.85)",
                lineHeight: 1.4,
                maxWidth: "88%",
              }}
            >
              {`“${d.dedication}”`}
            </div>
          )}
          {showGiver && (
            <div style={{ display: "flex", marginTop: 22, fontSize: 26, letterSpacing: 4, color: GOLD_BRIGHT }}>
              {`WITH LOVE, ${d.giverName?.toUpperCase()}`}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <div
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              background: CREAM,
              color: INK,
              borderRadius: 20,
              padding: "18px 26px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", width: 230 }}>
              <div style={{ display: "flex", fontSize: 16, letterSpacing: 3, color: MUTED }}>ENTERED</div>
              <div style={{ display: "flex", fontSize: 24, fontFamily: SERIF, fontWeight: 700 }}>
                {d.claimedAt ? formatDate(d.claimedAt) : ""}
              </div>
            </div>
            <SealBox registryNo={d.registryNo} size={130} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 230 }}>
              {d.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUri(d.url, INK, CREAM)} width={104} height={104} alt="" />
              ) : null}
              <div style={{ display: "flex", fontSize: 16, color: MUTED, marginTop: 4 }}>{d.siteHost}</div>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 17, color: "rgba(253,246,227,0.7)", textAlign: "center" }}>
            {DISCLAIMER}
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
  const element = kind === "christmas" ? <ChristmasCard d={d} /> : <Certificate d={d} kind={kind} />;
  return toPng(element, kind, await loadFonts());
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
