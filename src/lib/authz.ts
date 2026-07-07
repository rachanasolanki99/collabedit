import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleAtLeast } from "@/lib/roles";

export { roleAtLeast };

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type SessionUser = { id: string; email?: string | null; name?: string | null };

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "You must be signed in.");
  return session.user;
}

export async function getMembership(userId: string, documentId: string) {
  return prisma.membership.findUnique({
    where: { documentId_userId: { documentId, userId } },
  });
}

export async function requireRole(userId: string, documentId: string, min: Role) {
  const membership = await getMembership(userId, documentId);
  if (!membership) throw new HttpError(404, "Document not found.");
  if (!roleAtLeast(membership.role, min)) {
    throw new HttpError(403, "You do not have permission to do that.");
  }
  return membership;
}
