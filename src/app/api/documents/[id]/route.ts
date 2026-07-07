import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/authz";
import { handle, json } from "@/lib/http";
import { updateDocumentSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const user = await requireUser();
  const membership = await requireRole(user.id, id, "VIEWER");

  const document = await prisma.document.findUniqueOrThrow({
    where: { id },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });

  return json({ document, role: membership.role });
});

export const PATCH = handle(async (req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const user = await requireUser();
  await requireRole(user.id, id, "EDITOR");

  const body = updateDocumentSchema.parse(await req.json());
  const document = await prisma.document.update({
    where: { id },
    data: { title: body.title },
    select: { id: true, title: true },
  });

  return json({ document });
});

export const DELETE = handle(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const user = await requireUser();
  await requireRole(user.id, id, "OWNER");

  await prisma.document.delete({ where: { id } });
  return json({ ok: true });
});
