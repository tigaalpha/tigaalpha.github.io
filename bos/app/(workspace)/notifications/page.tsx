"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { NotificationsCard } from "@/features/dashboard/components/notifications-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Tables<"notifications">[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.notifications.listAll(100).then(setNotifications);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Notifications</h1>
        <p className="text-sm text-secondary/50">Lesson reminders, conflicts, renewals, and AI escalations</p>
      </div>
      {notifications ? <NotificationsCard notifications={notifications} /> : <Skeleton className="h-64" />}
    </div>
  );
}
