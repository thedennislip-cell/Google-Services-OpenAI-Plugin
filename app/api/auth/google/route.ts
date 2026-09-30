import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { oauthConfig, SCOPES, STATE_COOKIE } from "@/lib/google";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = oauthConfig();
    if (!process.env.APP_ENCRYPTION_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.redirect(new URL("/?setup=missing", config.redirectUri));
    }
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: "true",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });
    const response = NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
    response.cookies.set(STATE_COOKIE, JSON.stringify({ state, verifier }), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?setup=missing", process.env.APP_BASE_URL || "https://example.com"));
  }
}
