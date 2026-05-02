import { notFound, redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getCurrentUserId } from "@/lib/auth";
import { AnalyticsView } from "@/components/analytics/analytics-view";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/auth/sign-in");

  const { storeId } = await params;

  const store = await convex.query(api.stores.getById, {
    storeId: storeId as any,
    userId,
  });

  if (!store) notFound();
  const isPrivileged = store.role === "owner" || store.role === "admin";
  if (!isPrivileged && !store.effectivePermissions?.analytics?.enabled) {
    notFound();
  }

  return <AnalyticsView storeId={storeId} />;
}
