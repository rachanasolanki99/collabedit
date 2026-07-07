import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handle, json } from "@/lib/http";
import { createDocumentSchema } from "@/lib/validation";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireUser();

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    orderBy: { document: { updatedAt: "desc" } },
    select: {
      role: true,
      document: {
        select: {
          id: true,
          title: true,
          updatedAt: true,
          _count: { select: { members: true, versions: true } },
        },
      },
    },
  });

  const documents = memberships.map((m) => ({
    id: m.document.id,
    title: m.document.title,
    updatedAt: m.document.updatedAt,
    role: m.role,
    memberCount: m.document._count.members,
    versionCount: m.document._count.versions,
  }));

  return json({ documents });
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const body = createDocumentSchema.parse(await req.json());

  const document = await prisma.document.create({
    data: {
      title: body.title ?? "Untitled document",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
    select: { id: true, title: true },
  });

  return json({ document }, 201);
});
