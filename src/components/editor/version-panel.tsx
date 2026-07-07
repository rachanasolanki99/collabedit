"use client";

import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
import * as Y from "yjs";
import { yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import { toast } from "sonner";
import { History, Loader2, RotateCcw, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { COLLAB_FIELD } from "@/lib/collab/constants";
import { bytesToBase64, base64ToBytes } from "@/lib/collab/base64";
import { formatBytes, timeAgo } from "@/lib/utils";

interface VersionMeta {
  id: string;
  label: string;
  size: number;
  createdAt: string;
  createdBy: { name: string | null } | null;
}

interface Props {
  documentId: string;
  doc: Y.Doc | null;
  editor: Editor | null;
  canEdit: boolean;
}

export function VersionPanel({ documentId, doc, editor, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVersions(data.versions);
    } catch {
      toast.error("Could not load versions.");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
  }

  async function captureSnapshot() {
    if (!doc) return;
    setSaving(true);
    try {
      const state = Y.encodeStateAsUpdate(doc);
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || `Snapshot ${new Date().toLocaleString()}`,
          state: bytesToBase64(state),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save snapshot.");
      }
      setLabel("");
      toast.success("Snapshot captured");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function restore(version: VersionMeta) {
    if (!editor) return;
    if (
      !confirm(
        `Restore "${version.label}"? The document's current content will be replaced with this version. ` +
          `This is applied as a new collaborative edit — history and other collaborators are preserved.`,
      )
    )
      return;

    setRestoringId(version.id);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions/${version.id}`);
      if (!res.ok) throw new Error("Could not fetch version.");
      const data = await res.json();

      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, base64ToBytes(data.version.state));
      const json = yXmlFragmentToProsemirrorJSON(tempDoc.getXmlFragment(COLLAB_FIELD));
      tempDoc.destroy();

      editor.commands.setContent(json, { emitUpdate: true });
      toast.success(`Restored "${version.label}"`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="size-4" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Capture snapshots and travel back in time. Restores merge safely into
            the live document.
          </DialogDescription>
        </DialogHeader>

        {canEdit && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="snapshot-label" className="mb-1.5 block">
                Snapshot label
              </Label>
              <Input
                id="snapshot-label"
                placeholder="e.g. First draft"
                value={label}
                maxLength={120}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !saving && captureSnapshot()}
              />
            </div>
            <Button onClick={captureSnapshot} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Camera className="size-4" />}
              Capture
            </Button>
          </div>
        )}

        <div className="-mx-2 max-h-[46vh] overflow-y-auto px-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No snapshots yet. Capture one to start your timeline.
            </p>
          ) : (
            <ol className="relative space-y-1 border-l border-border pl-4">
              {versions.map((v) => (
                <li key={v.id} className="relative py-2">
                  <span className="absolute -left-[1.35rem] top-3.5 size-2 rounded-full bg-primary" />
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {timeAgo(v.createdAt)} · {v.createdBy?.name ?? "Unknown"} ·{" "}
                        {formatBytes(v.size)}
                      </p>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restore(v)}
                        disabled={restoringId === v.id || !editor}
                      >
                        {restoringId === v.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                        Restore
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
