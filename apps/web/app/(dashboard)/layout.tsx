import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect("/auth/login");
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Topbar
                userName={session.user.name ?? "User"}
                userEmail={session.user.email ?? ""}
            />
            <main className="flex-1">{children}</main>
        </div>
    );
}
