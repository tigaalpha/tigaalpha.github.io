import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { CalendarView } from "@/features/calendar/components/calendar-view";

export default async function CalendarPage() {
  const supabase = await createClient();
  const repos = createRepositories(supabase);

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 14);
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + 45);

  const bookings = await repos.bookings.listBetween(rangeStart.toISOString(), rangeEnd.toISOString());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Calendar</h1>
        <p className="text-sm text-secondary/50">Yellow = normal lesson · Green = final lesson (collect payment / renew)</p>
      </div>
      <CalendarView
        events={bookings.map((b) => ({ id: b.id, title: b.title, start: b.start_time, end: b.end_time, lessonType: b.lesson_type }))}
      />
    </div>
  );
}
