import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, HttpError } from "@/lib/authz";
import { handle, json } from "@/lib/http";
import { updateMemberSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; memberId: string }> };

async function assertNotLastOwner(documentId: string, membershipId: string) {
  const target = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!target || target.documentId !== documentId) {
    throw new HttpError(404, "Member not found.");
  }
  if (target.role === "OWNER") {
    const owners = await prisma.membership.count({
      where: { documentId, role: "OWNER" },
    });
    if (owners <= 1) {
      throw new HttpError(409, "A document must have at least one owner.");
    }
  }
  return target;
}

export const PATCH = handle(async (req: NextRequest, { params }: Params) => {
  const { id, memberId } = await params;
  const user = await requireUser();
  await requireRole(user.id, id, "OWNER");

  const body = updateMemberSchema.parse(await req.json());
  if (body.role !== "OWNER") await assertNotLastOwner(id, memberId);

  const member = await prisma.membership.update({
    where: { id: memberId },
    data: { role: body.role },
    select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } },
  });

  return json({ member });
});

export const DELETE = handle(async (_req: NextRequest, { params }: Params) => {
  const { id, memberId } = await params;
  const user = await requireUser();
  await requireRole(user.id, id, "OWNER");

  await assertNotLastOwner(id, memberId);
  await prisma.membership.delete({ where: { id: memberId } });

  return json({ ok: true });
});
