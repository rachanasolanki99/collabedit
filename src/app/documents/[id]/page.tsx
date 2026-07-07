import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser, getMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { DocumentWorkspace } from "@/components/editor/document-workspace";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: doc?.title ?? "Document" };
}

export default async function DocumentPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  const membership = await getMembership(user.id, id);
  if (!membership) notFound();

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!document) notFound();

  return (
    <DocumentWorkspace
      documentId={document.id}
      initialTitle={document.title}
      role={membership.role}
      currentUser={{ id: user.id, name: user.name ?? "Anonymous" }}
    />
  );
}
