import { clearCookieHeader, sameOrigin } from "@/lib/admin-auth";

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin." }, { status: 403 });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookieHeader() } });
}
