"use client";

import { useEffect, useState } from "react";
import type { WebsocketProvider } from "y-websocket";

interface PresenceUser {
  clientId: number;
  name: string;
  color: string;
}

export function Presence({ provider }: { provider: WebsocketProvider | null }) {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!provider) return;
    const awareness = provider.awareness;

    const update = () => {
      const list: PresenceUser[] = [];
      awareness.getStates().forEach((state, clientId) => {
        const user = (state as { user?: { name?: string; color?: string } }).user;
        if (user?.name) {
          list.push({ clientId, name: user.name, color: user.color ?? "#888" });
        }
      });
      setUsers(list);
    };

    awareness.on("change", update);
    update();
    return () => awareness.off("change", update);
  }, [provider]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2" aria-label={`${users.length} people here`}>
      {users.slice(0, 5).map((u) => (
        <span
          key={u.clientId}
          title={u.name}
          className="flex size-7 items-center justify-center rounded-full border-2 border-background text-xs font-semibold text-white"
          style={{ backgroundColor: u.color }}
        >
          {u.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {users.length > 5 && (
        <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
          +{users.length - 5}
        </span>
      )}
    </div>
  );
}
