import "dotenv/config";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { PrismaClient } from "@prisma/client";
import { issueSyncToken } from "../src/lib/sync-token";

const WS_URL = process.env.NEXT_PUBLIC_SYNC_URL ?? "ws://localhost:1234";
const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function connect(docId: string, token: string) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(WS_URL, docId, doc, {
    WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    params: { token },
    disableBc: true,
    connect: true,
  });
  return { doc, provider };
}

async function waitSynced(provider: WebsocketProvider, ms = 4000) {
  const start = Date.now();
  while (!provider.synced && Date.now() - start < ms) await sleep(50);
}

async function main() {
  const stamp = Date.now();
  const owner = await prisma.user.create({
    data: { name: "Owner", email: `owner-${stamp}@test.dev`, passwordHash: "x" },
  });
  const viewerUser = await prisma.user.create({
    data: { name: "Viewer", email: `viewer-${stamp}@test.dev`, passwordHash: "x" },
  });
  const document = await prisma.document.create({
    data: {
      title: "Sync verification",
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: viewerUser.id, role: "VIEWER" },
        ],
      },
    },
  });

  const editorToken = issueSyncToken({ sub: owner.id, doc: document.id, role: "OWNER" });
  const viewerToken = issueSyncToken({ sub: viewerUser.id, doc: document.id, role: "VIEWER" });

  const editor = connect(document.id, editorToken);
  const viewer = connect(document.id, viewerToken);

  await waitSynced(editor.provider);
  await waitSynced(viewer.provider);

  let failures = 0;
  const check = (name: string, cond: boolean) => {
    console.log(`${cond ? "✅ PASS" : "❌ FAIL"}  ${name}`);
    if (!cond) failures++;
  };

  editor.doc.getText("body").insert(0, "Hello from the editor. ");
  await sleep(800);
  check(
    "editor edit propagates to viewer",
    viewer.doc.getText("body").toString().includes("Hello from the editor."),
  );

  viewer.doc.getText("body").insert(0, "VIEWER TRYING TO WRITE. ");
  await sleep(800);
  check(
    "viewer edit is rejected (not seen by editor)",
    !editor.doc.getText("body").toString().includes("VIEWER TRYING TO WRITE."),
  );

  await sleep(2500);
  const updates = await prisma.docUpdate.count({ where: { documentId: document.id } });
  check("editor edit persisted to Postgres", updates > 0);

  editor.provider.destroy();
  viewer.provider.destroy();

  await prisma.document.delete({ where: { id: document.id } });
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, viewerUser.id] } } });
  await prisma.$disconnect();

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
