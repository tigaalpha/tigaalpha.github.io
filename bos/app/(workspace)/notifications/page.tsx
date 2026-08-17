"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { NotificationsCard } from "@/features/dashboard/components/notifications-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Tables<"notifications">[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setNotifications(await createRepositories(createClient()).notifications.listAll(100));
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, [load]);

  async function markRead(id: string) {
    try {
      await createClient().from("notifications").update({ read: true }).eq("id", id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำเครื่องหมายไม่สำเร็จ");
    }
  }

  async function markAllRead() {
    try {
      await createClient().from("notifications").update({ read: true }).eq("read", false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำเครื่องหมายไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Notifications</h1>
        <p className="text-sm text-secondary/50">Lesson reminders, conflicts, renewals, and AI escalations</p>
      </div>
      {error ? <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {notifications ? (
        <NotificationsCard notifications={notifications} onMarkRead={markRead} onMarkAllRead={markAllRead} />
      ) : (
        <Skeleton className="h-64" />
      )}
    </div>
  );
}
