import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { NotificationsCard } from "@/features/dashboard/components/notifications-card";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const repos = createRepositories(supabase);
  const notifications = await repos.notifications.listAll(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Notifications</h1>
        <p className="text-sm text-secondary/50">Lesson reminders, conflicts, renewals, and AI escalations</p>
      </div>
      <NotificationsCard notifications={notifications} />
    </div>
  );
}
