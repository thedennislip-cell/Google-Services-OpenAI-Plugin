import { NextResponse } from "next/server";
import { currentSession, googleFetch } from "@/lib/google";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await currentSession(request);
    if (!session) return NextResponse.json({ error: "Connect Google first." }, { status: 401 });
    const body = await request.json() as {
      action?: "rename" | "move" | "copy" | "trash" | "delete" | "createFolder" | "share" | "updatePermission" | "deletePermission";
      fileId?: string;
      name?: string;
      description?: string;
      addParentId?: string;
      removeParentId?: string;
      permissionId?: string;
      permission?: { type: "user" | "group" | "domain" | "anyone"; role: string; emailAddress?: string };
    };

    if (body.action === "createFolder") {
      if (!body.name) return NextResponse.json({ error: "name is required." }, { status: 400 });
      return NextResponse.json(await googleFetch("drive/v3/files", session.tokens, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: body.name, mimeType: "application/vnd.google-apps.folder", ...(body.addParentId ? { parents: [body.addParentId] } : {}) })
      }));
    }

    if (!body.fileId) return NextResponse.json({ error: "fileId is required." }, { status: 400 });
    const id = encodeURIComponent(body.fileId);

    if (body.action === "rename") {
      return NextResponse.json(await googleFetch("drive/v3/files/" + id, session.tokens, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(body.name !== undefined ? { name: body.name } : {}), ...(body.description !== undefined ? { description: body.description } : {}) })
      }));
    }
    if (body.action === "move") {
      const params = new URLSearchParams();
      if (body.addParentId) params.set("addParents", body.addParentId);
      if (body.removeParentId) params.set("removeParents", body.removeParentId);
      return NextResponse.json(await googleFetch("drive/v3/files/" + id + "?" + params.toString(), session.tokens, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" }));
    }
    if (body.action === "copy") {
      return NextResponse.json(await googleFetch("drive/v3/files/" + id + "/copy", session.tokens, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.name ? { name: body.name } : {})
      }));
    }
    if (body.action === "trash") {
      return NextResponse.json(await googleFetch("drive/v3/files/" + id, session.tokens, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) }));
    }
    if (body.action === "delete") {
      await googleFetch("drive/v3/files/" + id, session.tokens, { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "share") {
      if (!body.permission) return NextResponse.json({ error: "permission is required." }, { status: 400 });
      return NextResponse.json(await googleFetch("drive/v3/files/" + id + "/permissions", session.tokens, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.permission)
      }));
    }
    if (body.action === "updatePermission") {
      if (!body.permissionId || !body.permission) return NextResponse.json({ error: "permissionId and permission are required." }, { status: 400 });
      return NextResponse.json(await googleFetch("drive/v3/files/" + id + "/permissions/" + encodeURIComponent(body.permissionId), session.tokens, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.permission)
      }));
    }
    if (body.action === "deletePermission") {
      if (!body.permissionId) return NextResponse.json({ error: "permissionId is required." }, { status: 400 });
      await googleFetch("drive/v3/files/" + id + "/permissions/" + encodeURIComponent(body.permissionId), session.tokens, { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown Drive action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Drive action failed." }, { status: 500 });
  }
}
