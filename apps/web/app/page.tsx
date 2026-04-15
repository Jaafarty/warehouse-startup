import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Ware-House</h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Modern inventory and sales management for small and medium businesses.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/auth/login">
          <Button variant="outline" size="lg">
            Sign In
          </Button>
        </Link>
        <Link href="/auth/signup">
          <Button size="lg">Get Started</Button>
        </Link>
      </div>
    </div>
  );
}
