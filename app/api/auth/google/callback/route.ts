import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { oauthConfig, saveTokens, STATE_COOKIE, SESSION_COOKIE, type GoogleTokens } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) return NextResponse.redirect(new URL("/?error=" + encodeURIComponent(error === "access_denied" ? "access_denied" : "google_oauth_error"), request.url));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !stateCookie) return NextResponse.redirect(new URL("/?error=invalid_oauth_response", request.url));

  try {
    const stored = JSON.parse(stateCookie) as { state: string; verifier: string };
    const a = Buffer.from(state);
    const b = Buffer.from(stored.state);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid OAuth state");

    const config = oauthConfig();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: stored.verifier
      })
    });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const data = await tokenResponse.json() as {
      access_token: string; refresh_token?: string; expires_in: number; scope?: string; token_type?: string;
    };
    const sessionId = randomBytes(32).toString("base64url");
    const tokens: GoogleTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope,
      token_type: data.token_type
    };
    await saveTokens(sessionId, tokens);
    const response = NextResponse.redirect(new URL("/?connected=1", request.url));
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30
    });
    response.cookies.set(STATE_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_setup_failed", request.url));
  }
}
