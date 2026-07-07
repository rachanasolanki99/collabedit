import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/authz";
import { handle, json } from "@/lib/http";
import { addMemberSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const user = await requireUser();
  await requireRole(user.id, id, "VIEWER");

  const members = await prisma.membership.findMany({
    where: { documentId: id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return json({ members });
});

export const POST = handle(async (req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const user = await requireUser();
  await requireRole(user.id, id, "OWNER");

  const body = addMemberSchema.parse(await req.json());

  const invitee = await prisma.user.findUnique({
    where: { email: body.email },
    select: { id: true, name: true, email: true },
  });
  if (!invitee) return json({ error: "No user with that email is registered." }, 404);

  const existing = await prisma.membership.findUnique({
    where: { documentId_userId: { documentId: id, userId: invitee.id } },
  });
  if (existing) return json({ error: "That user is already a collaborator." }, 409);

  const member = await prisma.membership.create({
    data: { documentId: id, userId: invitee.id, role: body.role },
    select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } },
  });

  return json({ member }, 201);
});
