import { NextResponse } from "next/server";
import { currentSession } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await currentSession(request);
    return NextResponse.json({ connected: Boolean(session) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ connected: false, setupRequired: true }, { headers: { "Cache-Control": "no-store" } });
  }
}
