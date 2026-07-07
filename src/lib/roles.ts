import type { Role } from "@prisma/client";

export const ROLE_RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function canWrite(role: Role): boolean {
  return roleAtLeast(role, "EDITOR");
}
