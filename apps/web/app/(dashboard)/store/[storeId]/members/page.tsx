"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import {
  inviteMember,
  updateMemberRole,
  removeMember,
} from "@/app/actions/stores";
import { UserPlus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const members = useQuery(
    api.members.listByStore,
    userId ? { storeId: storeId as any, userId: userId as any } : "skip"
  );

  const invitations = useQuery(
    api.invitations.listByStore,
    userId ? { storeId: storeId as any, userId: userId as any } : "skip"
  );

  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleInvite(formData: FormData) {
    setPending(true);
    const result = await inviteMember(storeId, formData);
    setPending(false);
    if (result.success) {
      toast.success("Invitation sent!");
      setInviteOpen(false);
    } else {
      toast.error(result.error ?? "Failed to invite");
    }
  }

  async function handleRoleChange(
    memberId: string,
    newRole: "admin" | "editor" | "viewer"
  ) {
    const result = await updateMemberRole(storeId, memberId, newRole);
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
      case "admin":
        return "default" as const;
      case "editor":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-muted-foreground">
            Manage who has access to this store.
          </p>
        </div>
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
                <Select name="role" defaultValue="editor">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sending..." : "Send Invitation"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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
                {members.map((member: any) => (
                  <TableRow key={member._id}>
                    <TableCell className="font-medium">
                      {member.userName}
                      {member.userId === userId && (
                        <span className="text-muted-foreground ml-1">
                          (you)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{member.userEmail}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.userId !== userId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex items-center justify-center rounded-lg size-8 hover:bg-muted"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleRoleChange(member._id, "admin")
                              }
                            >
                              Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleRoleChange(member._id, "editor")
                              }
                            >
                              Make Editor
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleRoleChange(member._id, "viewer")
                              }
                            >
                              Make Viewer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger className="relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent">
                                Remove
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Remove member?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {member.userName} will lose access to this
                                    store. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRemove(member._id)}
                                  >
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {invitations && invitations.filter((i: any) => i.status === "pending").length > 0 && (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations
                  .filter((i: any) => i.status === "pending")
                  .map((invite: any) => (
                    <TableRow key={invite._id}>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{invite.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Pending</Badge>
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
