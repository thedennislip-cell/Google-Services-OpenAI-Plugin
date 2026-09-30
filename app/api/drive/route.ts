import { NextResponse } from "next/server";
import { currentSession, googleFetch } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await currentSession(request);
    if (!session) return NextResponse.json({ error: "Connect Google first." }, { status: 401 });
    const url = new URL(request.url);
    const search = (url.searchParams.get("q") || "").slice(0, 120).replace(/['\\\\]/g, "");
    const query = new URLSearchParams({
      pageSize: "20",
      orderBy: "modifiedTime desc",
      fields: "files(id,name,mimeType,modifiedTime,webViewLink,size)"
    });
    query.set("q", "trashed = false" + (search ? " and name contains '" + search.replace(/'/g, "") + "'" : ""));
    const data = await googleFetch("drive/v3/files?" + query.toString(), session.tokens) as { files?: Array<{ id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string; size?: string }> };
    return NextResponse.json({ files: data.files || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Drive." }, { status: 500 });
  }
}
