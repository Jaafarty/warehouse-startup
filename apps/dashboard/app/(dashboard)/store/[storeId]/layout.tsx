import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUserId } from "@/lib/auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/auth/sign-in");

  const { storeId } = await params;

const store = await convex.query(api.stores.getById, {
  storeId: storeId as Id<"stores">,
  userId,
});

  if (!store) {
    redirect("/dashboard");
  }

  const user = await currentUser();
  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    "User";
  const userEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    "";

  return (
    <div className="flex h-[calc(100vh-60px)]">
      <Sidebar
        storeId={storeId}
        storeName={store.name}
        role={store.role}
        permissions={store.effectivePermissions}
        userName={userName}
        userEmail={userEmail}
      />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
