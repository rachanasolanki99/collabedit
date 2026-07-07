import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, HttpError } from "@/lib/authz";
import { handle, json } from "@/lib/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; versionId: string }> };

export const GET = handle(async (_req: NextRequest, { params }: Params) => {
  const { id, versionId } = await params;
  const user = await requireUser();
  await requireRole(user.id, id, "VIEWER");

  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: { id: true, label: true, state: true, documentId: true, createdAt: true },
  });
  if (!version || version.documentId !== id) {
    throw new HttpError(404, "Version not found.");
  }

  return json({
    version: {
      id: version.id,
      label: version.label,
      createdAt: version.createdAt,
      state: Buffer.from(version.state).toString("base64"),
    },
  });
});
