import Link from "next/link";
import {
  Bell,
  UserPlus,
  CalendarClock,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  Bot,
  CalendarX2,
  GraduationCap,
  Sparkles,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { NotificationType, Tables } from "@/types/database";

const ACTIVITY_STYLE: Record<NotificationType, { icon: LucideIcon; bg: string }> = {
  new_customer: { icon: UserPlus, bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  lesson_today: { icon: CalendarClock, bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  payment_received: { icon: Banknote, bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  slip_matched: { icon: CheckCircle2, bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  slip_unmatched: { icon: AlertTriangle, bg: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  conflict_booking: { icon: CalendarX2, bg: "bg-red-500/15 text-red-600 dark:text-red-400" },
  ai_needs_review: { icon: Bot, bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  customer_near_end_course: { icon: GraduationCap, bg: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  payment_reminder: { icon: Banknote, bg: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  attendance_declined: { icon: CalendarX2, bg: "bg-red-500/15 text-red-600 dark:text-red-400" },
  system_alert: { icon: AlertTriangle, bg: "bg-red-500/15 text-red-600 dark:text-red-400" },
  lesson_summary: { icon: ClipboardList, bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  monthly_report: { icon: Sparkles, bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  payroll_report: { icon: Sparkles, bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  reactivation: { icon: Sparkles, bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  review_request: { icon: Sparkles, bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  referral_created: { icon: CheckCircle2, bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  post_trial: { icon: Sparkles, bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  renewal_offer: { icon: Sparkles, bg: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  waitlist_offer: { icon: Sparkles, bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  kb_auto_learned: { icon: Bot, bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  ai_budget_exceeded: { icon: AlertTriangle, bg: "bg-red-500/15 text-red-600 dark:text-red-400" },
  drip_sent: { icon: Sparkles, bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  voice_transcript: { icon: Bot, bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  winback_draft: { icon: Sparkles, bg: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  event_notify: { icon: CalendarClock, bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1d ago" : `${days}d ago`;
}

export function RecentActivitiesCard({ notifications }: { notifications: Tables<"notifications">[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent Activities</CardTitle>
        <Link href="/notifications" className="text-xs font-medium text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" />
        ) : (
          <ul className="space-y-1">
            {notifications.map((n) => {
              const style = ACTIVITY_STYLE[n.type] ?? { icon: Bell, bg: "bg-line/5 text-secondary/50 dark:bg-white/5" };
              const Icon = style.icon;
              return (
                <li key={n.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-line/[0.03] dark:hover:bg-white/[0.03]">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", style.bg)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-secondary dark:text-white">{n.title}</p>
                    {n.body ? <p className="truncate text-xs text-secondary/45">{n.body}</p> : null}
                  </div>
                  <span className="shrink-0 text-[11px] text-secondary/35">{timeAgo(n.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
