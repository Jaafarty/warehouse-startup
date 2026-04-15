"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { acceptInvitation, declineInvitation } from "@/app/actions/stores";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function InviteContent() {
  const { token } = useParams<{ token: string }>();
  const { data: session, status: authStatus } = useSession();

  const invite = useQuery(api.invitations.getByToken, { token });

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authStatus === "loading" || invite === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Skeleton className="h-48 w-full max-w-md" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              You need to sign in or create an account to accept this
              invitation.
            </CardDescription>
          </CardHeader>
          <CardFooter className="gap-2">
            <Link href="/auth/login" className="flex-1">
              <Button variant="outline" className="w-full">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup" className="flex-1">
              <Button className="w-full">Sign Up</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/dashboard" className="w-full">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (invite.status !== "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation {invite.status}</CardTitle>
            <CardDescription>
              This invitation has already been {invite.status}.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/dashboard" className="w-full">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  async function handleAccept() {
    setPending(true);
    setError(null);
    const result = await acceptInvitation(token);
    setPending(false);
    if (result && !result.success) {
      setError(result.error ?? "Failed to accept");
    }
  }

  async function handleDecline() {
    setPending(true);
    setError(null);
    const result = await declineInvitation(token);
    setPending(false);
    if (result.success) {
      window.location.href = "/dashboard";
    } else {
      setError(result.error ?? "Failed to decline");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You&apos;re invited!</CardTitle>
          <CardDescription>
            <span className="font-medium">{invite.inviterName}</span> invited
            you to join{" "}
            <span className="font-medium">{invite.storeName}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Role:</span>
            <Badge>{invite.role}</Badge>
          </div>
          {error && (
            <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDecline}
            disabled={pending}
          >
            Decline
          </Button>
          <Button
            className="flex-1"
            onClick={handleAccept}
            disabled={pending}
          >
            {pending ? "Accepting..." : "Accept"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteContent />
    </Suspense>
  );
}
