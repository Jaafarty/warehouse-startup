import { redirect } from "next/navigation";
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <Sidebar
        storeId={storeId}
        storeName={store.name}
        role={store.role}
        permissions={store.effectivePermissions}
      />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
