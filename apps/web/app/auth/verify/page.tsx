"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token provided.");
      return;
    }

    verifyEmail(token).then((result) => {
      if (result.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(result.error ?? "Verification failed");
      }
    });
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {status === "loading" && "Verifying your email..."}
          {status === "success" && "Email verified!"}
          {status === "error" && "Verification failed"}
        </CardTitle>
        <CardDescription>
          {status === "loading" && "Please wait while we verify your email."}
          {status === "success" &&
            "Your email has been verified. You can now sign in."}
          {status === "error" && errorMessage}
        </CardDescription>
      </CardHeader>
      {status !== "loading" && (
        <CardFooter>
          <Link href="/auth/login" className="w-full">
            <Button className="w-full">
              {status === "success" ? "Sign In" : "Back to Login"}
            </Button>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
