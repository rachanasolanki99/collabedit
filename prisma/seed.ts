import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@demo.dev" },
    update: {},
    create: { name: "Alice", email: "alice@demo.dev", passwordHash },
  });
  const bob = await prisma.user.upsert({
    where: { email: "bob@demo.dev" },
    update: {},
    create: { name: "Bob", email: "bob@demo.dev", passwordHash },
  });

  const existing = await prisma.document.findFirst({
    where: { title: "Welcome to CollabEdit", members: { some: { userId: alice.id } } },
  });
  if (!existing) {
    await prisma.document.create({
      data: {
        title: "Welcome to CollabEdit",
        members: {
          create: [
            { userId: alice.id, role: "OWNER" },
            { userId: bob.id, role: "VIEWER" },
          ],
        },
      },
    });
  }

  console.log("Seeded demo users: alice@demo.dev / bob@demo.dev (password123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
