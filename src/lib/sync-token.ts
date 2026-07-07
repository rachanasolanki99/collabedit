import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { canWrite } from "./roles";

export { canWrite };

export interface SyncTokenPayload {
  sub: string;
  doc: string;
  role: Role;
}

function secret(): string {
  const s = process.env.SYNC_JWT_SECRET;
  if (!s) throw new Error("SYNC_JWT_SECRET is not set");
  return s;
}

export function issueSyncToken(payload: SyncTokenPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: "15m" });
}

export function verifySyncToken(token: string): SyncTokenPayload {
  const decoded = jwt.verify(token, secret());
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof (decoded as SyncTokenPayload).sub !== "string" ||
    typeof (decoded as SyncTokenPayload).doc !== "string"
  ) {
    throw new Error("Malformed sync token");
  }
  return decoded as SyncTokenPayload & jwt.JwtPayload;
}
