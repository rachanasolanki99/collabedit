import { NextRequest } from "next/server";
import { requireUser, requireRole } from "@/lib/authz";
import { handle, json } from "@/lib/http";
import { issueSyncToken } from "@/lib/sync-token";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const POST = handle(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const user = await requireUser();
  const membership = await requireRole(user.id, id, "VIEWER");

  const token = issueSyncToken({ sub: user.id, doc: id, role: membership.role });
  return json({ token, role: membership.role, userId: user.id, name: user.name ?? "Anonymous" });
});
