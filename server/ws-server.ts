import "dotenv/config";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { PrismaClient } from "@prisma/client";
import { verifySyncToken, canWrite } from "../src/lib/sync-token";
import { LIMITS } from "../src/lib/validation";
import { DocPersistence } from "./persistence";

const PORT = Number(process.env.PORT ?? 1234);
const prisma = new PrismaClient();

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface ConnMeta {
  userId: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  write: boolean;
  room: Room;
  controlledIds: Set<number>;
  windowStart: number;
  count: number;
}

class Room {
  readonly name: string;
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  readonly conns = new Set<WebSocket>();
  readonly persistence: DocPersistence;
  readonly ready: Promise<void>;
  private connMeta: WeakMap<WebSocket, ConnMeta>;

  constructor(name: string, connMeta: WeakMap<WebSocket, ConnMeta>) {
    this.name = name;
    this.connMeta = connMeta;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null);
    this.persistence = new DocPersistence(prisma, name);
    this.ready = this.persistence.load(this.doc);

    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder), origin);

      const author =
        origin instanceof WebSocket ? (this.connMeta.get(origin)?.userId ?? null) : null;
      this.persistence.enqueue(update, author);
    });

    this.awareness.on(
      "update",
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        const changed = added.concat(updated, removed);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed),
        );
        this.broadcast(encoding.toUint8Array(encoder), origin);
      },
    );
  }

  broadcast(message: Uint8Array, exclude?: unknown) {
    this.conns.forEach((conn) => {
      if (conn === exclude) return;
      if (conn.readyState === WebSocket.OPEN) conn.send(message);
    });
  }
}

const rooms = new Map<string, Room>();
const connMeta = new WeakMap<WebSocket, ConnMeta>();

function getRoom(name: string): Room {
  let room = rooms.get(name);
  if (!room) {
    room = new Room(name, connMeta);
    rooms.set(name, room);
  }
  return room;
}

function underRateLimit(meta: ConnMeta): boolean {
  const now = Date.now();
  if (now - meta.windowStart > LIMITS.RATE_WINDOW_MS) {
    meta.windowStart = now;
    meta.count = 0;
  }
  meta.count += 1;
  return meta.count <= LIMITS.MAX_MESSAGES_PER_WINDOW;
}

function handleMessage(conn: WebSocket, meta: ConnMeta, data: Uint8Array) {
  if (!underRateLimit(meta)) {
    conn.close(1008, "rate limit exceeded");
    return;
  }

  const decoder = decoding.createDecoder(data);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case MESSAGE_SYNC: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      const syncType = decoding.readVarUint(decoder);

      if (syncType === syncProtocol.messageYjsSyncStep1) {
        syncProtocol.readSyncStep1(decoder, encoder, meta.room.doc);
      } else if (meta.write) {
        if (syncType === syncProtocol.messageYjsSyncStep2) {
          syncProtocol.readSyncStep2(decoder, meta.room.doc, conn);
        } else if (syncType === syncProtocol.messageYjsUpdate) {
          syncProtocol.readUpdate(decoder, meta.room.doc, conn);
        }
      }
      if (encoding.length(encoder) > 1 && conn.readyState === WebSocket.OPEN) {
        conn.send(encoding.toUint8Array(encoder));
      }
      break;
    }
    case MESSAGE_AWARENESS: {
      awarenessProtocol.applyAwarenessUpdate(
        meta.room.awareness,
        decoding.readVarUint8Array(decoder),
        conn,
      );
      break;
    }
    default:
      break;
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: LIMITS.MAX_UPDATE_BYTES,
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", async (conn: WebSocket, req: http.IncomingMessage) => {
  let room: Room;
  let meta: ConnMeta;
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const roomName = decodeURIComponent(url.pathname.slice(1));
    const token = url.searchParams.get("token");
    if (!roomName || !token) throw new Error("missing room or token");

    const payload = verifySyncToken(token);
    if (payload.doc !== roomName) throw new Error("token/room mismatch");

    room = getRoom(roomName);
    meta = {
      userId: payload.sub,
      role: payload.role,
      write: canWrite(payload.role),
      room,
      controlledIds: new Set(),
      windowStart: Date.now(),
      count: 0,
    };
    connMeta.set(conn, meta);
  } catch {
    conn.close(1008, "unauthorized");
    return;
  }

  conn.binaryType = "arraybuffer";
  room.conns.add(conn);

  const queued: Uint8Array[] = [];
  let ready = false;
  const onMessage = (data: ArrayBuffer) => {
    const msg = new Uint8Array(data);
    if (!ready) {
      queued.push(msg);
      return;
    }
    try {
      handleMessage(conn, meta, msg);
    } catch (err) {
      console.error(`[ws] message error in room ${room.name}:`, err);
      conn.close(1011, "internal error");
    }
  };
  conn.on("message", onMessage);

  const awarenessChangeHandler = (
    { added, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === conn) {
      added.forEach((id) => meta.controlledIds.add(id));
      removed.forEach((id) => meta.controlledIds.delete(id));
    }
  };
  room.awareness.on("update", awarenessChangeHandler);

  const cleanup = () => {
    room.awareness.off("update", awarenessChangeHandler);
    room.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(
      room.awareness,
      Array.from(meta.controlledIds),
      "connection closed",
    );
    if (room.conns.size === 0) {
      void room.persistence.flush().then(() => {
        if (room.conns.size === 0) {
          room.doc.destroy();
          rooms.delete(room.name);
        }
      });
    }
  };
  conn.on("close", cleanup);
  conn.on("error", cleanup);

  await room.ready;
  if (conn.readyState !== WebSocket.OPEN) return;

  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    conn.send(encoding.toUint8Array(encoder));

    const states = room.awareness.getStates();
    if (states.size > 0) {
      const awEncoder = encoding.createEncoder();
      encoding.writeVarUint(awEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awEncoder,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys())),
      );
      conn.send(encoding.toUint8Array(awEncoder));
    }
  }

  ready = true;
  const backlog = queued.splice(0);
  for (const msg of backlog) {
    try {
      handleMessage(conn, meta, msg);
    } catch (err) {
      console.error(`[ws] message error in room ${room.name}:`, err);
      conn.close(1011, "internal error");
      break;
    }
  }
});

const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if ((ws as WebSocket & { isAlive?: boolean }).isAlive === false) return ws.terminate();
    (ws as WebSocket & { isAlive?: boolean }).isAlive = false;
    ws.ping();
  });
}, 30_000);
wss.on("connection", (ws) => {
  (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
  ws.on("pong", () => ((ws as WebSocket & { isAlive?: boolean }).isAlive = true));
});

server.listen(PORT, () => {
  console.log(`[ws] CollabEdit sync server listening on :${PORT}`);
});

async function shutdown() {
  clearInterval(pingInterval);
  console.log("[ws] shutting down, flushing rooms…");
  await Promise.all(Array.from(rooms.values()).map((r) => r.persistence.flush()));
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
