/**
 * QR codes as SVG, generated on the server with the `qrcode` package (pure
 * JavaScript). Used on certificates so a printed or shared copy leads back
 * to its live page in the registry.
 */
import QRCode from "qrcode";

export interface QrPath {
  /** Modules per side, including the 2-module quiet zone. */
  size: number;
  /** One SVG path drawing every dark module. */
  d: string;
}

export function qrPath(text: string): QrPath {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 2;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return { size: n + quiet * 2, d };
}

/** A standalone SVG document, e.g. for an <img> data URI in generated images. */
export function qrSvg(text: string, color = "#1c1917", background = "#fffbeb"): string {
  const { size, d } = qrPath(text);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${background}"/><path d="${d}" fill="${color}"/></svg>`;
}

export function qrDataUri(text: string, color?: string, background?: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(qrSvg(text, color, background)).toString("base64")}`;
}
