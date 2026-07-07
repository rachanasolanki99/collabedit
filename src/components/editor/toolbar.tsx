"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Undo2, Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Btn {
  icon: typeof Bold;
  label: string;
  action: (e: Editor) => void;
  isActive?: (e: Editor) => boolean;
}

const GROUPS: Btn[][] = [
  [
    { icon: Bold, label: "Bold", action: (e) => e.chain().focus().toggleBold().run(), isActive: (e) => e.isActive("bold") },
    { icon: Italic, label: "Italic", action: (e) => e.chain().focus().toggleItalic().run(), isActive: (e) => e.isActive("italic") },
    { icon: Strikethrough, label: "Strikethrough", action: (e) => e.chain().focus().toggleStrike().run(), isActive: (e) => e.isActive("strike") },
    { icon: Code, label: "Inline code", action: (e) => e.chain().focus().toggleCode().run(), isActive: (e) => e.isActive("code") },
  ],
  [
    { icon: Heading1, label: "Heading 1", action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), isActive: (e) => e.isActive("heading", { level: 1 }) },
    { icon: Heading2, label: "Heading 2", action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (e) => e.isActive("heading", { level: 2 }) },
    { icon: Heading3, label: "Heading 3", action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), isActive: (e) => e.isActive("heading", { level: 3 }) },
  ],
  [
    { icon: List, label: "Bullet list", action: (e) => e.chain().focus().toggleBulletList().run(), isActive: (e) => e.isActive("bulletList") },
    { icon: ListOrdered, label: "Numbered list", action: (e) => e.chain().focus().toggleOrderedList().run(), isActive: (e) => e.isActive("orderedList") },
    { icon: Quote, label: "Blockquote", action: (e) => e.chain().focus().toggleBlockquote().run(), isActive: (e) => e.isActive("blockquote") },
  ],
  [
    { icon: Undo2, label: "Undo", action: (e) => e.chain().focus().undo().run() },
    { icon: Redo2, label: "Redo", action: (e) => e.chain().focus().redo().run() },
  ],
];

export function EditorToolbar({ editor }: { editor: Editor }) {
  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="sticky top-14 z-20 flex flex-wrap items-center gap-1 border-b border-border bg-background/90 px-1 py-1.5 backdrop-blur"
    >
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
          {group.map((b) => {
            const active = b.isActive?.(editor) ?? false;
            return (
              <button
                key={b.label}
                type="button"
                aria-label={b.label}
                aria-pressed={active}
                title={b.label}
                onClick={() => b.action(editor)}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                <b.icon />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
