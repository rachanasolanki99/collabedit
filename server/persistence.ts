import * as Y from "yjs";
import { PrismaClient } from "@prisma/client";

const FLUSH_MS = 1500;
const COMPACT_THRESHOLD = 100;

export class DocPersistence {
  private prisma: PrismaClient;
  private documentId: string;
  private buffer: Uint8Array[] = [];
  private authorOf = new WeakMap<object, string>();
  private lastAuthor: string | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(prisma: PrismaClient, documentId: string) {
    this.prisma = prisma;
    this.documentId = documentId;
  }

  async load(doc: Y.Doc): Promise<void> {
    const rows = await this.prisma.docUpdate.findMany({
      where: { documentId: this.documentId },
      orderBy: { createdAt: "asc" },
      select: { id: true, update: true },
    });
    if (rows.length === 0) return;

    const merged = Y.mergeUpdates(rows.map((r) => new Uint8Array(r.update)));
    Y.applyUpdate(doc, merged, "persistence");

    if (rows.length > COMPACT_THRESHOLD) {
      await this.compact(merged, rows.map((r) => r.id));
    }
  }

  enqueue(update: Uint8Array, author: string | null): void {
    this.buffer.push(update);
    if (author) this.lastAuthor = author;
    if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), FLUSH_MS);
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length === 0) return;

    const merged = Y.mergeUpdates(this.buffer);
    const author = this.lastAuthor;
    this.buffer = [];
    this.lastAuthor = null;

    try {
      await this.prisma.docUpdate.create({
        data: {
          documentId: this.documentId,
          update: Buffer.from(merged),
          authorId: author ?? undefined,
        },
      });
      await this.prisma.document.update({
        where: { id: this.documentId },
        data: { updatedAt: new Date() },
      });
    } catch (err) {
      console.error(`[persist] flush failed for ${this.documentId}:`, err);
      this.buffer.unshift(merged);
    }
  }

  private async compact(merged: Uint8Array, staleIds: string[]): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.docUpdate.create({
          data: { documentId: this.documentId, update: Buffer.from(merged) },
        }),
        this.prisma.docUpdate.deleteMany({ where: { id: { in: staleIds } } }),
      ]);
      console.log(`[persist] compacted ${staleIds.length} rows for ${this.documentId}`);
    } catch (err) {
      console.error(`[persist] compaction failed for ${this.documentId}:`, err);
    }
  }
}
