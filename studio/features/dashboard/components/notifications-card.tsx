import { Bell, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NotificationType, Tables } from "@/types/database";

const TONE: Record<NotificationType, "default" | "success" | "warning" | "danger"> = {
  lesson_today: "default",
  conflict_booking: "danger",
  customer_near_end_course: "warning",
  payment_reminder: "warning",
  ai_needs_review: "danger",
  new_customer: "success",
  system_alert: "danger",
  payment_received: "success",
  attendance_declined: "warning",
  slip_matched: "success",
  slip_unmatched: "warning",
  post_trial: "default",
  renewal_offer: "warning",
  monthly_report: "default",
  payroll_report: "default",
  reactivation: "default",
  review_request: "default",
  referral_created: "success",
  lesson_summary: "default",
  waitlist_offer: "default",
  kb_auto_learned: "default",
  ai_budget_exceeded: "danger",
  drip_sent: "default",
  voice_transcript: "default",
  winback_draft: "warning",
  event_notify: "default",
};

export function NotificationsCard({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: Tables<"notifications">[];
  /** Mark a single notification as read (dismiss). */
  onMarkRead?: (id: string) => void;
  /** Mark every notification as read. */
  onMarkAllRead?: () => void;
}) {
  const unreadCount = notifications.filter((n) => !n.read).length;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Notifications</CardTitle>
        {unreadCount > 0 && onMarkAllRead ? (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line/10 px-2.5 py-1.5 text-xs font-medium text-secondary/70 transition-colors hover:bg-primary/10 hover:text-primary-accent"
          >
            <Check className="h-3.5 w-3.5" />
            อ่านแล้วทั้งหมด ({unreadCount})
          </button>
        ) : null}
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" />
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="group flex items-start gap-3 rounded-xl border border-line/5 px-3 py-2">
                <Badge variant={TONE[n.type]} className={cn("mt-0.5 shrink-0", n.read ? "opacity-40" : "")}>
                  {n.type.replace(/_/g, " ")}
                </Badge>
                <div className={cn("min-w-0", n.read ? "opacity-50" : "")}>
                  <p className="truncate text-sm font-medium text-secondary">{n.title}</p>
                  {n.body ? <p className="truncate text-xs text-secondary/50">{n.body}</p> : null}
                </div>
                {!n.read && onMarkRead ? (
                  <button
                    type="button"
                    onClick={() => onMarkRead(n.id)}
                    aria-label="อ่านแล้ว"
                    className="ml-auto mt-0.5 shrink-0 rounded-md p-1 text-secondary/40 opacity-0 transition-opacity hover:bg-primary/10 hover:text-primary-accent group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
