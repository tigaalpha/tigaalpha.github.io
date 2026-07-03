import { CalendarClock, MessagesSquare, Clock3, Users2 } from "lucide-react";
import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { LessonListCard } from "@/features/dashboard/components/lesson-list-card";
import { SalesFunnelCard } from "@/features/dashboard/components/sales-funnel-card";
import { NotificationsCard } from "@/features/dashboard/components/notifications-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const repos = createRepositories(supabase);

  const [today, tomorrow, funnel, notifications, conversations, nearRenewal] = await Promise.all([
    repos.bookings.listToday(),
    repos.bookings.listTomorrow(),
    repos.sales.funnelCounts(),
    repos.notifications.listUnread(8),
    repos.conversations.listNeedingReview(),
    repos.courses.listNearingCompletion(1),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Dashboard</h1>
        <p className="text-sm text-secondary/50">Today&apos;s overview of your studio</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Lessons" value={today.length} icon={CalendarClock} />
        <StatCard label="Pending Chats" value={conversations.length} icon={MessagesSquare} tone={conversations.length > 0 ? "danger" : "default"} />
        <StatCard label="Near Renewal" value={nearRenewal.length} icon={Clock3} tone="warning" />
        <StatCard label="New Leads" value={0} icon={Users2} hint="Wire up lead-source tracking" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LessonListCard
          title="Today's Lessons"
          lessons={today.map((b) => ({ id: b.id, title: b.title, startTime: b.start_time, lessonType: b.lesson_type }))}
        />
        <LessonListCard
          title="Tomorrow's Lessons"
          lessons={tomorrow.map((b) => ({ id: b.id, title: b.title, startTime: b.start_time, lessonType: b.lesson_type }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SalesFunnelCard counts={funnel} />
        <NotificationsCard notifications={notifications} />
      </div>
    </div>
  );
}
