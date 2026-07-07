import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/authz";
import { handle, json } from "@/lib/http";
import { createVersionSchema, LIMITS } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const user = await requireUser();
  await requireRole(user.id, id, "VIEWER");

  const versions = await prisma.version.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      size: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });

  return json({ versions });
});

export const POST = handle(async (req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const user = await requireUser();
  await requireRole(user.id, id, "EDITOR");

  const body = createVersionSchema.parse(await req.json());

  const state = Buffer.from(body.state, "base64");
  if (state.length === 0) return json({ error: "Empty snapshot." }, 422);
  if (state.length > LIMITS.MAX_SNAPSHOT_BYTES) {
    return json({ error: "Snapshot exceeds the size limit." }, 413);
  }

  const version = await prisma.version.create({
    data: {
      documentId: id,
      label: body.label,
      state,
      size: state.length,
      createdById: user.id,
    },
    select: {
      id: true,
      label: true,
      size: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });

  return json({ version }, 201);
});
