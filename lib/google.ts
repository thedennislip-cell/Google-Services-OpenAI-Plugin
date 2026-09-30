import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "gs_session";
export const STATE_COOKIE = "gs_oauth_state";
export const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly"
];

export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
  token_type?: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing server configuration: " + name);
  return value;
}

export function oauthConfig() {
  return {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    redirectUri: required("GOOGLE_REDIRECT_URI")
  };
}

function encryptionKey() {
  return createHash("sha256").update(required("APP_ENCRYPTION_KEY"), "utf8").digest();
}

export function encryptTokens(tokens: GoogleTokens): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptTokens(value: string): GoogleTokens {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Stored credentials are invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as GoogleTokens;
}

function databaseConfig() {
  return {
    url: required("SUPABASE_URL").replace(/\/$/, ""),
    key: required("SUPABASE_SERVICE_ROLE_KEY")
  };
}

async function dbRequest(path: string, init: RequestInit = {}) {
  const db = databaseConfig();
  const response = await fetch(db.url + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: db.key,
      Authorization: "Bearer " + db.key,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Database request failed:", response.status);
    throw new Error("Secure token storage is unavailable. Check the server database setup.");
  }
  return response;
}

export async function saveTokens(sessionId: string, tokens: GoogleTokens) {
  await dbRequest("google_sessions?on_conflict=session_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      session_id: sessionId,
      encrypted_tokens: encryptTokens(tokens),
      updated_at: new Date().toISOString()
    })
  });
}

export async function readTokens(sessionId: string): Promise<GoogleTokens | null> {
  const response = await dbRequest("google_sessions?select=encrypted_tokens&session_id=eq." + encodeURIComponent(sessionId) + "&limit=1");
  const rows = await response.json() as Array<{ encrypted_tokens: string }>;
  return rows[0]?.encrypted_tokens ? decryptTokens(rows[0].encrypted_tokens) : null;
}

export async function deleteTokens(sessionId: string) {
  await dbRequest("google_sessions?session_id=eq." + encodeURIComponent(sessionId), { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

export async function getSessionTokens(request: Request): Promise<{ sessionId: string; tokens: GoogleTokens } | null> {
  const sessionId = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(SESSION_COOKIE + "="))?.slice(SESSION_COOKIE.length + 1);
  if (!sessionId) return null;
  const tokens = await readTokens(decodeURIComponent(sessionId));
  if (!tokens) return null;
  if (tokens.expires_at > Date.now() + 60_000) return { sessionId: decodeURIComponent(sessionId), tokens };

  if (!tokens.refresh_token) return null;
  const config = oauthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) return null;
  const refreshed = await response.json() as { access_token: string; expires_in: number; scope?: string; token_type?: string };
  const next: GoogleTokens = {
    ...tokens,
    access_token: refreshed.access_token,
    expires_at: Date.now() + refreshed.expires_in * 1000,
    scope: refreshed.scope || tokens.scope,
    token_type: refreshed.token_type || tokens.token_type
  };
  await saveTokens(decodeURIComponent(sessionId), next);
  return { sessionId: decodeURIComponent(sessionId), tokens: next };
}

export async function googleFetch(path: string, tokens: GoogleTokens) {
  const response = await fetch("https://www.googleapis.com/" + path, {
    headers: { Authorization: "Bearer " + tokens.access_token },
    cache: "no-store"
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Google session expired. Please disconnect and reconnect.");
    if (response.status === 403) throw new Error("Google denied this request. Check the granted permissions or account administrator settings.");
    throw new Error("Google API request failed (" + response.status + ").");
  }
  return response.json();
}

export async function currentSession(request: Request) {
  return getSessionTokens(request);
}

export async function setSessionCookie(response: Response, name: string, value: string, maxAge: number) {
  // This helper is retained for shared cookie policy documentation; route handlers set cookies on NextResponse.
  return { response, name, value, maxAge };
}

export async function hasSessionCookie() {
  const jar = await cookies();
  return jar.has(SESSION_COOKIE);
}
