"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@ware-house/shared";
import {
  Bell,
  CheckCheck,
  Package,
  ShoppingCart,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string }
> = {
  low_stock_alert: { icon: AlertTriangle, color: "text-destructive" },
  sale_completed: { icon: ShoppingCart, color: "text-[color:var(--color-success)]" },
  store_invitation: { icon: UserPlus, color: "text-[color:var(--color-info)]" },
  member_joined: { icon: UserPlus, color: "text-[color:var(--color-info)]" },
};

export default function NotificationsPage() {
  const { userId } = useCurrentUser();

  const allNotifications = useQuery(
    api.notifications.list,
    userId ? { userId } : "skip"
  );

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const notifications = allNotifications
    ? allNotifications.filter((n) => n.createdAt >= Date.now() - SEVEN_DAYS_MS)
    : undefined;

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  async function handleMarkAsRead(notificationId: string) {
    if (!userId) return;
    try {
      await markAsRead({
        notificationId: notificationId as Id<"notifications">,
        userId,
      });
    } catch {
      toast.error("Failed to mark as read");
    }
  }

  async function handleMarkAllAsRead() {
    if (!userId) return;
    try {
      const result = await markAllAsRead({ userId });
      if (result.count > 0) {
        toast.success(`Marked ${result.count} as read`);
      }
    } catch {
      toast.error("Failed to mark all as read");
    }
  }

  const unreadCount =
    notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      {notifications === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No notifications</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You'll see alerts here when something needs your attention.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const config = TYPE_CONFIG[notification.type] ?? {
              icon: Bell,
              color: "text-muted-foreground",
            };
            const Icon = config.icon;

            return (
              <Card
                key={notification._id}
                className={
                  notification.isRead ? "opacity-60" : ""
                }
              >
                <CardContent className="flex items-start gap-3 py-4">
                  <div className={`mt-0.5 ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleMarkAsRead(notification._id)}
                    >
                      Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
