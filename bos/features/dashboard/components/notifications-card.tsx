import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { NotificationType, Tables } from "@/types/database";

const TONE: Record<NotificationType, "default" | "success" | "warning" | "danger"> = {
  lesson_today: "default",
  conflict_booking: "danger",
  customer_near_end_course: "warning",
  payment_reminder: "warning",
  ai_needs_review: "danger",
  new_customer: "success",
};

export function NotificationsCard({ notifications }: { notifications: Tables<"notifications">[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" />
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-xl border border-line/5 px-3 py-2">
                <Badge variant={TONE[n.type]} className="mt-0.5 shrink-0">
                  {n.type.replace(/_/g, " ")}
                </Badge>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-secondary">{n.title}</p>
                  {n.body ? <p className="truncate text-xs text-secondary/50">{n.body}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
