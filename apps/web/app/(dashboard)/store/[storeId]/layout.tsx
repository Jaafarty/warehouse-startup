import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Sidebar } from "@/components/layout/sidebar";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const { storeId } = await params;

  const store = await convex.query(api.stores.getById, {
    storeId: storeId as any,
    userId: session.user.id as any,
  });

  if (!store) {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <Sidebar
        storeId={storeId}
        storeName={store.name}
        permissions={store.permissions}
      />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
