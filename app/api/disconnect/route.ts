import { NextRequest, NextResponse } from "next/server";
import { currentSession, deleteTokens, SESSION_COOKIE } from "@/lib/google";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const session = await currentSession(request);
    if (session) {
      try {
        await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(session.tokens.refresh_token || session.tokens.access_token), { method: "POST" });
      } catch {}
      await deleteTokens(session.sessionId);
    }
  } catch {
    // Clear the browser session even if the database is temporarily unavailable.
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
