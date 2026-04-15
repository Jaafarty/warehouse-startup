"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { updateProfile, changePassword } from "@/app/actions/auth";
import { User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function UserSettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [profilePending, setProfilePending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);

  async function handleProfileUpdate(formData: FormData) {
    setProfilePending(true);
    const result = await updateProfile(formData);
    setProfilePending(false);
    if (result.success) {
      toast.success("Profile updated");
      updateSession();
    } else {
      toast.error(result.error ?? "Failed to update profile");
    }
  }

  async function handlePasswordChange(formData: FormData) {
    setPasswordPending(true);
    const result = await changePassword(formData);
    setPasswordPending(false);
    if (result.success) {
      toast.success("Password changed successfully");
    } else {
      toast.error(result.error ?? "Failed to change password");
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
          <CardDescription>Update your display name.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleProfileUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={session?.user?.name ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={session?.user?.email ?? ""} disabled />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed.
              </p>
            </div>
            <Button type="submit" disabled={profilePending}>
              {profilePending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password. Must be at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={passwordPending}>
              {passwordPending ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
