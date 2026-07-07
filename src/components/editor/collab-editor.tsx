"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { COLLAB_FIELD } from "@/lib/collab/constants";
import { colorForId } from "@/lib/collab/colors";
import { EditorToolbar } from "./toolbar";

interface Props {
  doc: Y.Doc;
  provider: WebsocketProvider;
  editable: boolean;
  currentUser: { id: string; name: string };
  onReady: (editor: Editor | null) => void;
}

export function CollabEditor({ doc, provider, editable, currentUser, onReady }: Props) {
  const editor = useEditor(
    {
      editable,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "mx-auto max-w-3xl px-1 py-6 focus:outline-none",
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": "Document content",
        },
      },
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Placeholder.configure({
          placeholder: "Start writing… edits are saved locally and sync automatically.",
        }),
        Collaboration.configure({ document: doc, field: COLLAB_FIELD }),
        CollaborationCaret.configure({
          provider,
          user: { name: currentUser.name, color: colorForId(currentUser.id) },
        }),
      ],
    },
    [doc, provider],
  );

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  return (
    <div className="flex flex-1 flex-col">
      {editable && editor && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}
