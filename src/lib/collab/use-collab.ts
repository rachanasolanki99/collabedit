"use client";

import { useEffect, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import type { Role } from "@prisma/client";

export type ConnStatus =
  | "local"
  | "connecting"
  | "connected"
  | "offline"
  | "error";

export interface CollabHandle {
  doc: Y.Doc | null;
  provider: WebsocketProvider | null;
  status: ConnStatus;
  synced: boolean;
  localLoaded: boolean;
  role: Role | null;
  pending: number;
  peers: number;
}

interface TokenResponse {
  token: string;
  role: Role;
  userId: string;
  name: string;
}

export function useCollab(documentId: string): CollabHandle {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [status, setStatus] = useState<ConnStatus>("local");
  const [synced, setSynced] = useState(false);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [pending, setPending] = useState(0);
  const [peers, setPeers] = useState(0);

  const [prevDocId, setPrevDocId] = useState(documentId);
  if (prevDocId !== documentId) {
    setPrevDocId(documentId);
    setDoc(null);
    setProvider(null);
    setStatus("local");
    setSynced(false);
    setLocalLoaded(false);
    setRole(null);
    setPending(0);
    setPeers(0);
  }

  useEffect(() => {
    let disposed = false;
    let cancelled = false;
    const syncUrl = process.env.NEXT_PUBLIC_SYNC_URL ?? "ws://localhost:1234";

    const ydoc = new Y.Doc();
    const persistence = new IndexeddbPersistence(`collabedit:${documentId}`, ydoc);
    const wsProvider = new WebsocketProvider(syncUrl, documentId, ydoc, { connect: false });

    persistence.once("synced", () => {
      if (!disposed) setLocalLoaded(true);
    });

    let unacked = 0;
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin !== wsProvider && !wsProvider.wsconnected) {
        unacked += 1;
        setPending(unacked);
      }
    };
    ydoc.on("update", onUpdate);

    const onStatus = (e: { status: "connecting" | "connected" | "disconnected" }) => {
      if (disposed) return;
      if (!navigator.onLine) return setStatus("offline");
      if (e.status === "connected") setStatus("connected");
      else if (e.status === "connecting") setStatus("connecting");
      else setStatus("error");
    };
    const onSync = (isSynced: boolean) => {
      if (disposed) return;
      setSynced(isSynced);
      if (isSynced) {
        unacked = 0;
        setPending(0);
      }
    };
    const onPeers = () => {
      if (!disposed) setPeers(wsProvider.awareness.getStates().size);
    };
    wsProvider.on("status", onStatus);
    wsProvider.on("sync", onSync);
    wsProvider.awareness.on("change", onPeers);

    async function authenticateAndConnect() {
      if (cancelled || disposed) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      try {
        setStatus("connecting");
        const res = await fetch(`/api/documents/${documentId}/token`, { method: "POST" });
        if (!res.ok) throw new Error(`token ${res.status}`);
        const data: TokenResponse = await res.json();
        if (cancelled || disposed) return;

        setRole(data.role);
        wsProvider.params.token = data.token;
        wsProvider.connect();
      } catch {
        if (!disposed) setStatus(navigator.onLine ? "error" : "offline");
      }
    }

    const handleOnline = () => authenticateAndConnect();
    const handleOffline = () => {
      if (!disposed) setStatus("offline");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    queueMicrotask(() => {
      if (disposed) return;
      setDoc(ydoc);
      setProvider(wsProvider);
      void authenticateAndConnect();
    });

    return () => {
      disposed = true;
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      ydoc.off("update", onUpdate);
      wsProvider.off("status", onStatus);
      wsProvider.off("sync", onSync);
      wsProvider.awareness.off("change", onPeers);
      wsProvider.destroy();
      persistence.destroy();
      ydoc.destroy();
    };
  }, [documentId]);

  return { doc, provider, status, synced, localLoaded, role, pending, peers };
}
