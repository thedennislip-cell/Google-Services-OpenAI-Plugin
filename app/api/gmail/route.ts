import { NextResponse } from "next/server";
import { currentSession, googleFetch } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await currentSession(request);
    if (!session) return NextResponse.json({ error: "Connect Google first." }, { status: 401 });
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").slice(0, 180);
    const query = new URLSearchParams({ maxResults: "12" });
    if (q) query.set("q", q);
    const list = await googleFetch("gmail/v1/users/me/messages?" + query.toString(), session.tokens) as { messages?: Array<{ id: string; threadId: string }> };
    const messages = await Promise.all((list.messages || []).slice(0, 12).map(async item => {
      const detail = await googleFetch("gmail/v1/users/me/messages/" + encodeURIComponent(item.id) + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date", session.tokens) as {
        id: string; snippet?: string; internalDate?: string; payload?: { headers?: Array<{ name: string; value: string }> };
      };
      const headers = detail.payload?.headers || [];
      const header = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
      return { id: detail.id, from: header("From"), subject: header("Subject") || "(no subject)", date: header("Date"), snippet: detail.snippet || "" };
    }));
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Gmail." }, { status: 500 });
  }
}
