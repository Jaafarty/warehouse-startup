"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  inviteMember,
  updateMemberRole,
  removeMember,
} from "@/app/actions/stores";
import { canManageRole, SYSTEM_ROLES, type MemberRole } from "@ware-house/shared";
import { UserPlus, MoreHorizontal, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function MembersPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const members = useQuery(
    api.members.listByStore,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const invitations = useQuery(
    api.invitations.listByStore,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const customRoles = useQuery(
    api.storeRoles.listByStore,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState("employee");
  const [pending, setPending] = useState(false);

  const currentUserMember = members?.find((m) => m.userId === userId);
  const currentUserRole = currentUserMember?.role ?? "viewer";
  const canManageMembers = (SYSTEM_ROLES as readonly string[]).includes(currentUserRole);
  const canPromoteToAdmin = canManageRole(currentUserRole as MemberRole, "admin");

  async function handleInvite(formData: FormData) {
    setPending(true);
    const rawRole = inviteRole;
    const role = rawRole.startsWith("custom:") ? "custom" : rawRole;
    const customRoleId = rawRole.startsWith("custom:") ? rawRole.split(":")[1] : undefined;
    formData.set("role", role);
    if (customRoleId) formData.set("customRoleId", customRoleId);
    const result = await inviteMember(storeId, formData);
    setPending(false);
    if (result.success) {
      const link = `${window.location.origin}/invite/${result.token}`;
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Invitation created. Link copied to clipboard.", {
          description: link,
        });
      } catch {
        toast.success("Invitation created.", { description: link });
      }
      setInviteOpen(false);
      setInviteRole("employee");
    } else {
      toast.error(result.error ?? "Failed to invite");
    }
  }

  async function copyInviteLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function handleRoleChange(
    memberId: string,
    newRole: "admin" | "employee" | "viewer" | "custom",
    customRoleId?: string
  ) {
    const result = await updateMemberRole(storeId, memberId, newRole, customRoleId);
    if (result.success) {
      toast.success("Role updated");
    } else {
      toast.error(result.error ?? "Failed to update role");
    }
  }

  async function handleRemove(memberId: string) {
    const result = await removeMember(storeId, memberId);
    if (result.success) {
      toast.success("Member removed");
    } else {
      toast.error(result.error ?? "Failed to remove member");
    }
  }

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default" as const;
      case "admin":
        return "default" as const;
      case "employee":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  function roleLabel(member: { role: string; customRoleName?: string }): string {
    if (member.role === "custom") return member.customRoleName ?? "Custom";
    if (member.role === "employee") return "Employee";
    return member.role.charAt(0).toUpperCase() + member.role.slice(1);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-muted-foreground">
            Manage who has access to this store.
          </p>
        </div>
        {canManageMembers && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger
              className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a member</DialogTitle>
                <DialogDescription>
                  Send an invitation via email.
                </DialogDescription>
              </DialogHeader>
              <form action={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="colleague@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v ?? "employee")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {canPromoteToAdmin && (
                        <SelectItem value="admin">Admin</SelectItem>
                      )}
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      {customRoles && customRoles.length > 0 && (
                        <>
                          <SelectItem disabled value="__divider__">── Custom Roles ──</SelectItem>
                          {customRoles.map((cr) => (
                            <SelectItem key={cr._id} value={`custom:${cr._id}`}>
                              {cr.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Sending..." : "Send Invitation"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {members === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isOwner = member.role === "owner";
                  const isSelf = member.userId === userId;
                  const canEditThisMember =
                    !isOwner &&
                    !isSelf &&
                    canManageMembers &&
                    canManageRole(currentUserRole as MemberRole, member.role as MemberRole);

                  return (
                    <TableRow key={member._id}>
                      <TableCell className="font-medium">
                        {member.userName}
                        {isSelf && (
                          <span className="text-muted-foreground ml-1">(you)</span>
                        )}
                      </TableCell>
                      <TableCell>{member.userEmail}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(member.role)}>
                          {roleLabel(member)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {canEditThisMember && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="inline-flex items-center justify-center rounded-lg size-8 hover:bg-muted"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canPromoteToAdmin && member.role !== "admin" && (
                                <DropdownMenuItem
                                  onClick={() => handleRoleChange(member._id, "admin")}
                                >
                                  Make Admin
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(member._id, "employee")}
                              >
                                Make Employee
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(member._id, "viewer")}
                              >
                                Make Viewer
                              </DropdownMenuItem>
                              {customRoles && customRoles.length > 0 && (
                                <>
                                  <DropdownMenuSeparator />
                                  {customRoles.map((cr) => (
                                    <DropdownMenuItem
                                      key={cr._id}
                                      onClick={() => handleRoleChange(member._id, "custom", cr._id as string)}
                                    >
                                      {cr.name}
                                    </DropdownMenuItem>
                                  ))}
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger className="relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent">
                                  Remove
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove member?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {member.userName} will lose access to this store.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemove(member._id)}>
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {invitations && invitations.filter((i) => i.status === "pending").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20 text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations
                  .filter((i) => i.status === "pending")
                  .map((invite) => (
                    <TableRow key={invite._id}>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{invite.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Pending</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteLink(invite.token)}
                          title="Copy invite link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
