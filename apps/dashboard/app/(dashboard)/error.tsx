"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { friendlyMessage } from "@/lib/extract-error";

export default function DashboardError({
  error,
  reset: _reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  const isAccessRevoked =
    error.message?.includes("NOT_MEMBER") ||
    error.message?.includes("no longer have access");

  const title = isAccessRevoked
    ? "You've been removed from this store"
    : "Something went wrong";
  const description = isAccessRevoked
    ? "Your access to this store has been revoked. Contact the store owner if you think this is a mistake."
    : friendlyMessage(error, "An unexpected error occurred. Please refresh and try again.");

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center pt-6 gap-4">
          <DoorOpen className="h-12 w-12 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <Button onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
