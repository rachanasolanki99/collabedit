"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import type { Role } from "@prisma/client";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { useCollab } from "@/lib/collab/use-collab";
import { CollabEditor } from "./collab-editor";
import { StatusBadge } from "./status-badge";
import { Presence } from "./presence";
import { VersionPanel } from "./version-panel";
import { SharePanel } from "./share-panel";
import { AiPanel } from "./ai-panel";
import { RoleBadge } from "@/components/documents/role-badge";

interface Props {
  documentId: string;
  initialTitle: string;
  role: Role;
  currentUser: { id: string; name: string };
}

export function DocumentWorkspace({ documentId, initialTitle, role: initialRole, currentUser }: Props) {
  const collab = useCollab(documentId);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const savedTitle = useRef(initialTitle);

  const role = collab.role ?? initialRole;
  const canEdit = role !== "VIEWER";

  const onReady = useCallback((e: Editor | null) => setEditor(e), []);

  async function saveTitle() {
    const next = title.trim();
    if (!next || next === savedTitle.current) {
      setTitle(savedTitle.current);
      return;
    }
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (res.ok) {
        savedTitle.current = next;
        document.title = `${next} · CollabEdit`;
      }
    } catch {
    }
  }

  useEffect(() => {
    document.title = `${savedTitle.current} · CollabEdit`;
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/documents"
            aria-label="Back to documents"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          {canEdit ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              aria-label="Document title"
              maxLength={200}
              className="min-w-0 flex-1 truncate bg-transparent text-lg font-semibold outline-none focus:border-b focus:border-primary"
            />
          ) : (
            <h1 className="truncate text-lg font-semibold">{title}</h1>
          )}
          <RoleBadge role={role} />
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge
            status={collab.status}
            synced={collab.synced}
            pending={collab.pending}
            localLoaded={collab.localLoaded}
          />
          <Presence provider={collab.provider} />
          <SharePanel documentId={documentId} role={role} />
          <VersionPanel documentId={documentId} doc={collab.doc} editor={editor} canEdit={canEdit} />
          <AiPanel documentId={documentId} editor={editor} />
        </div>
      </div>

      {!canEdit && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Eye className="size-4" />
          You have view-only access. Your edits are disabled and the server will
          reject any write attempts.
        </div>
      )}

      <div className="mt-2 flex flex-1 flex-col">
        {collab.doc && collab.provider && collab.localLoaded ? (
          <CollabEditor
            doc={collab.doc}
            provider={collab.provider}
            editable={canEdit}
            currentUser={currentUser}
            onReady={onReady}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Loading your document…
          </div>
        )}
      </div>
    </div>
  );
}
