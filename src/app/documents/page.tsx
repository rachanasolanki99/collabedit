import type { Metadata } from "next";
import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Dashboard, type DocSummary } from "@/components/documents/dashboard";

export const metadata: Metadata = { title: "Your documents" };

export default async function DocumentsPage() {
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

  const documents: DocSummary[] = memberships.map((m) => ({
    id: m.document.id,
    title: m.document.title,
    updatedAt: m.document.updatedAt.toISOString(),
    role: m.role,
    memberCount: m.document._count.members,
    versionCount: m.document._count.versions,
  }));

  return <Dashboard initialDocuments={documents} />;
}
