"use client";

import { useCallback, useState } from "react";
import type { Role } from "@prisma/client";
import { toast } from "sonner";
import { Share2, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { RoleBadge } from "@/components/documents/role-badge";

interface Member {
  id: string;
  role: Role;
  user: { id: string; name: string | null; email: string };
}

export function SharePanel({ documentId, role }: { documentId: string; role: Role }) {
  const canManage = role === "OWNER";
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/members`);
      if (!res.ok) throw new Error();
      setMembers((await res.json()).members);
    } catch {
      toast.error("Could not load collaborators.");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
  }

  async function invite() {
    setInviting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: inviteRole }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not add collaborator.");
      setEmail("");
      toast.success("Collaborator added");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(member: Member, nextRole: Role) {
    try {
      const res = await fetch(`/api/documents/${documentId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not update role.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function remove(member: Member) {
    try {
      const res = await fetch(`/api/documents/${documentId}/members/${member.id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not remove collaborator.");
      toast.success("Collaborator removed");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            {canManage
              ? "Invite collaborators and control their access."
              : "People with access to this document."}
          </DialogDescription>
        </DialogHeader>

        {canManage && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Invite by email</Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !inviting && email && invite()}
              />
              <select
                aria-label="Role for invited collaborator"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "EDITOR" | "VIEWER")}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <Button onClick={invite} disabled={inviting || !email} aria-label="Add collaborator">
                {inviting ? <Loader2 className="animate-spin" /> : <UserPlus className="size-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-[40vh] space-y-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.user.name ?? m.user.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-1">
                    <select
                      aria-label={`Role for ${m.user.email}`}
                      value={m.role}
                      onChange={(e) => changeRole(m, e.target.value as Role)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="OWNER">Owner</option>
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${m.user.email}`}
                      onClick={() => remove(m)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <RoleBadge role={m.role} />
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
