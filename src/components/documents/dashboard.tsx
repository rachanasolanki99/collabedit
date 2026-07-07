"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Plus, Users, History, Loader2, Trash2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/documents/role-badge";
import { timeAgo } from "@/lib/utils";

export interface DocSummary {
  id: string;
  title: string;
  updatedAt: string;
  role: Role;
  memberCount: number;
  versionCount: number;
}

export function Dashboard({ initialDocuments }: { initialDocuments: DocSummary[] }) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function createDocument() {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Could not create document.");
      const { document } = await res.json();
      router.push(`/documents/${document.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setCreating(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!confirm("Delete this document for everyone? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete document.");
      setDocuments((docs) => docs.filter((d) => d.id !== id));
      toast.success("Document deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your documents</h1>
          <p className="text-sm text-muted-foreground">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </p>
        </div>
        <Button onClick={createDocument} disabled={creating}>
          {creating ? <Loader2 className="animate-spin" /> : <Plus />}
          New document
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <FileText className="size-10 text-muted-foreground" />
          <p className="mt-4 font-medium">No documents yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first offline-first document to get started.
          </p>
          <Button className="mt-5" onClick={createDocument} disabled={creating}>
            <Plus /> New document
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <li key={doc.id} className="group relative">
              <Link
                href={`/documents/${doc.id}`}
                className="block h-full rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <FileText className="size-5 shrink-0 text-primary" />
                  <RoleBadge role={doc.role} />
                </div>
                <h2 className="mt-3 line-clamp-2 font-medium">{doc.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Edited {timeAgo(doc.updatedAt)}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="gap-1">
                    <Users className="size-3" /> {doc.memberCount}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <History className="size-3" /> {doc.versionCount}
                  </Badge>
                </div>
              </Link>
              {doc.role === "OWNER" && (
                <button
                  onClick={() => deleteDocument(doc.id)}
                  disabled={deletingId === doc.id}
                  aria-label="Delete document"
                  className="absolute bottom-4 right-4 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
