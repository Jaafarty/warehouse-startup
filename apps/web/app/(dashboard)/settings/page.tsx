"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { updateProfile } from "@/app/actions/auth";
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
import { toast } from "sonner";

export default function UserSettingsPage() {
  const { user } = useUser();
  const [profilePending, setProfilePending] = useState(false);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    "";
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    "";

  async function handleProfileUpdate(formData: FormData) {
    setProfilePending(true);
    const result = await updateProfile(formData);
    setProfilePending(false);
    if (result.success) {
      toast.success("Profile updated");
    } else {
      toast.error(result.error ?? "Failed to update profile");
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
                defaultValue={displayName}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} disabled />
              <p className="text-xs text-muted-foreground">
                Email is managed by your account provider.
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
            Security
          </CardTitle>
          <CardDescription>
            Passwords, connected accounts, and two-factor authentication are
            managed through Clerk. Open your account menu in the top-right to
            access these settings.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
