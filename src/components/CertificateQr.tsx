import { qrPath } from "@/lib/qr";

/** QR code for a certificate URL. Server component: keeps the QR encoder out of client bundles. */
export function CertificateQr({ url }: { url: string }) {
  const { size, d } = qrPath(url);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" className="h-16 w-16 sm:h-20 sm:w-20" aria-hidden="true">
      <rect width={size} height={size} fill="#fffaf0" />
      <path d={d} fill="#1c1917" />
    </svg>
  );
}
