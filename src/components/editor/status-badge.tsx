"use client";

import { Cloud, CloudOff, RefreshCw, Loader2, Check } from "lucide-react";
import type { ConnStatus } from "@/lib/collab/use-collab";
import { cn } from "@/lib/utils";

interface Props {
  status: ConnStatus;
  synced: boolean;
  pending: number;
  localLoaded: boolean;
}

export function StatusBadge({ status, synced, pending, localLoaded }: Props) {
  let icon = <Loader2 className="size-3.5 animate-spin" />;
  let label = "Loading…";
  let tone = "text-muted-foreground";
  let live = "polite";

  if (!localLoaded) {
  } else if (status === "offline") {
    icon = <CloudOff className="size-3.5" />;
    label = pending > 0 ? `Offline · ${pending} change${pending > 1 ? "s" : ""} queued` : "Offline";
    tone = "text-amber-600 dark:text-amber-400";
    live = "assertive";
  } else if (status === "connecting") {
    icon = <RefreshCw className="size-3.5 animate-spin" />;
    label = "Connecting…";
  } else if (status === "error") {
    icon = <CloudOff className="size-3.5" />;
    label = pending > 0 ? `Reconnecting · ${pending} queued` : "Reconnecting…";
    tone = "text-amber-600 dark:text-amber-400";
    live = "assertive";
  } else if (status === "connected") {
    if (synced && pending === 0) {
      icon = <Check className="size-3.5" />;
      label = "All changes synced";
      tone = "text-emerald-600 dark:text-emerald-400";
    } else {
      icon = <Cloud className="size-3.5" />;
      label = "Syncing…";
      tone = "text-blue-600 dark:text-blue-400";
    }
  }

  return (
    <span
      role="status"
      aria-live={live as "polite" | "assertive"}
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", tone)}
    >
      {icon}
      {label}
    </span>
  );
}
