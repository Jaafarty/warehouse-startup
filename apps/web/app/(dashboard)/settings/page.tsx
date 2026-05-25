"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { updateProfile } from "@/app/actions/auth";
import { User, Lock, Settings as SettingsIcon, Save } from "lucide-react";
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
import { PageHeader } from "@/components/layout/page-header";

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

  const initials =
    displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

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
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Manage your account settings."
      />

      <div className="grid gap-5 lg:grid-cols-4">
        {/* Main: forms */}
        <div className="lg:col-span-3 space-y-5 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
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
                <div className="flex justify-end">
                  <Button type="submit" disabled={profilePending}>
                    <Save className="h-4 w-4 mr-2" />
                    {profilePending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Security
              </CardTitle>
              <CardDescription>
                Passwords, connected accounts, and two-factor authentication are
                managed through your account provider. Open the profile menu to
                access these settings.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Aside: account summary */}
        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--primary), oklch(0.62 0.16 165))",
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {displayName || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {email || "—"}
                  </p>
                </div>
              </div>
              <p className="border-t pt-3 text-xs text-muted-foreground">
                Your profile is shared across every store you belong to.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
