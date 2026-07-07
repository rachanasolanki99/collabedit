import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { handle, json } from "@/lib/http";

export const runtime = "nodejs";

export const POST = handle(async (req: NextRequest) => {
  const raw = await req.text();
  if (raw.length > 4096) return json({ error: "Payload too large" }, 413);

  const data = registerSchema.parse(JSON.parse(raw));

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return json({ error: "An account with this email already exists." }, 409);

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash },
    select: { id: true, email: true, name: true },
  });

  return json({ user }, 201);
});
