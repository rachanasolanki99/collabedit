import type { Role } from "@prisma/client";
import { Crown, Pencil, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CONFIG: Record<Role, { label: string; icon: typeof Crown; variant: "default" | "secondary" | "outline" }> = {
  OWNER: { label: "Owner", icon: Crown, variant: "default" },
  EDITOR: { label: "Editor", icon: Pencil, variant: "secondary" },
  VIEWER: { label: "Viewer", icon: Eye, variant: "outline" },
};

export function RoleBadge({ role }: { role: Role }) {
  const { label, icon: Icon, variant } = CONFIG[role];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
