"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import * as Y from "yjs";
import { yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import { toast } from "sonner";
import { Sparkles, Loader2, FileText, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { COLLAB_FIELD } from "@/lib/collab/constants";
import { base64ToBytes } from "@/lib/collab/base64";
import { pmJsonToText } from "@/lib/collab/pm-text";

type Mode = "idle" | "summary" | "diff";

export function AiPanel({ documentId, editor }: { documentId: string; editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  async function streamInto(url: string, body: unknown) {
    setBusy(true);
    setOutput("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "AI request failed.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setMode("idle");
    } finally {
      setBusy(false);
    }
  }

  async function summarize() {
    if (!editor) return;
    const text = editor.getText().trim();
    if (!text) return toast.error("The document is empty.");
    setMode("summary");
    await streamInto("/api/ai/summarize", { text });
  }

  async function explainChanges() {
    if (!editor) return;
    setMode("diff");
    setBusy(true);
    setOutput("");
    try {
      const listRes = await fetch(`/api/documents/${documentId}/versions`);
      const { versions } = await listRes.json();
      if (!versions?.length) {
        toast.error("Capture a snapshot first to compare against.");
        setMode("idle");
        setBusy(false);
        return;
      }
      const verRes = await fetch(`/api/documents/${documentId}/versions/${versions[0].id}`);
      const { version } = await verRes.json();

      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, base64ToBytes(version.state));
      const beforeJson = yXmlFragmentToProsemirrorJSON(tempDoc.getXmlFragment(COLLAB_FIELD));
      tempDoc.destroy();

      const before = pmJsonToText(beforeJson);
      const after = editor.getText();
      await streamInto("/api/ai/diff", { before, after });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not compare versions.");
      setMode("idle");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="size-4" />
          AI
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI assistant
          </DialogTitle>
          <DialogDescription>
            Summarize your document or explain what changed since the last snapshot.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={summarize} disabled={busy || !editor}>
            <FileText className="size-4" />
            Summarize
          </Button>
          <Button variant="secondary" size="sm" onClick={explainChanges} disabled={busy || !editor}>
            <GitCompare className="size-4" />
            What changed?
          </Button>
        </div>

        {(mode !== "idle" || busy) && (
          <div className="max-h-[45vh] overflow-y-auto rounded-md border border-border bg-muted/50 p-3 text-sm">
            {busy && !output && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Thinking…
              </div>
            )}
            <p className="whitespace-pre-wrap leading-relaxed">{output}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
