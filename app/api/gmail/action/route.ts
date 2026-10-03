import { NextResponse } from "next/server";
import { currentSession, googleFetch } from "@/lib/google";

export const runtime = "nodejs";

function b64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export async function POST(request: Request) {
  try {
    const session = await currentSession(request);
    if (!session) return NextResponse.json({ error: "Connect Google first." }, { status: 401 });
    const body = await request.json() as {
      action?: "send" | "trash" | "delete" | "modify";
      messageId?: string;
      to?: string;
      subject?: string;
      body?: string;
      addLabelIds?: string[];
      removeLabelIds?: string[];
    };

    if (body.action === "send") {
      if (!body.to || !body.subject || !body.body) {
        return NextResponse.json({ error: "to, subject, and body are required." }, { status: 400 });
      }
      const raw = [
        "To: " + body.to,
        "Subject: " + body.subject,
        "Content-Type: text/plain; charset=UTF-8",
        "MIME-Version: 1.0",
        "",
        body.body
      ].join("\r\n");
      const result = await googleFetch("gmail/v1/users/me/messages/send", session.tokens, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: b64url(raw) })
      });
      return NextResponse.json(result);
    }

    if (!body.messageId) return NextResponse.json({ error: "messageId is required." }, { status: 400 });
    const id = encodeURIComponent(body.messageId);

    if (body.action === "trash") {
      return NextResponse.json(await googleFetch("gmail/v1/users/me/messages/" + id + "/trash", session.tokens, { method: "POST" }));
    }
    if (body.action === "delete") {
      await googleFetch("gmail/v1/users/me/messages/" + id, session.tokens, { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "modify") {
      return NextResponse.json(await googleFetch("gmail/v1/users/me/messages/" + id + "/modify", session.tokens, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addLabelIds: body.addLabelIds || [],
          removeLabelIds: body.removeLabelIds || []
        })
      }));
    }
    return NextResponse.json({ error: "Unknown Gmail action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gmail action failed." }, { status: 500 });
  }
}
