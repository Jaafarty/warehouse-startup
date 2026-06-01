"use client";
import React from "react";
import { ShieldAlert } from "lucide-react";
import { friendlyMessage } from "@/lib/extract-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface State {
  error: Error | null;
}

export default class ConvexErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    // Only catch ConvexErrors (they have .data)
    if ((error as { data?: unknown }).data !== undefined) return { error };
    throw error; // re-throw non-Convex errors
  }

  componentDidCatch(_error: Error) {
    // Already handled in getDerivedStateFromError
  }

  render() {
    if (this.state.error) {
      const msg = friendlyMessage(
        this.state.error,
        "You don't have permission to view this page."
      );
      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{msg}</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => window.history.back()}>
                  Go back
                </Button>
                <Button
                  onClick={() => {
                    this.setState({ error: null });
                    window.location.reload();
                  }}
                >
                  Reload page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
