"use client";

import { useEffect, useState } from "react";
import { CalendarClock, MessagesSquare, Clock3, Users2 } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { LessonListCard } from "@/features/dashboard/components/lesson-list-card";
import { SalesFunnelCard } from "@/features/dashboard/components/sales-funnel-card";
import { NotificationsCard } from "@/features/dashboard/components/notifications-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SalesStatus, Tables } from "@/types/database";

interface DashboardData {
  today: Tables<"bookings">[];
  tomorrow: Tables<"bookings">[];
  funnel: Record<SalesStatus, number>;
  notifications: Tables<"notifications">[];
  conversations: Tables<"conversations">[];
  nearRenewal: Tables<"courses">[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());

    Promise.all([
      repos.bookings.listToday(),
      repos.bookings.listTomorrow(),
      repos.sales.funnelCounts(),
      repos.notifications.listUnread(8),
      repos.conversations.listNeedingReview(),
      repos.courses.listNearingCompletion(1),
    ]).then(([today, tomorrow, funnel, notifications, conversations, nearRenewal]) => {
      setData({ today, tomorrow, funnel, notifications, conversations, nearRenewal });
    });
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const { today, tomorrow, funnel, notifications, conversations, nearRenewal } = data;

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
        <StatCard label="New Leads" value={funnel.new_lead} icon={Users2} />
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
