import { CalendarPlus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { BookingStatus, Tables } from "@/types/database";

const STATUS_TONE: Record<BookingStatus, "default" | "success" | "warning" | "danger"> = {
  pending: "warning",
  confirmed: "default",
  rescheduled: "warning",
  cancelled: "danger",
  completed: "success",
};

export function BookingsTable({ bookings }: { bookings: Tables<"bookings">[] }) {
  if (bookings.length === 0) {
    return <EmptyState icon={CalendarPlus} title="No booking requests" />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-soft">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-black/5 text-xs text-secondary/50">
          <tr>
            <th className="px-4 py-3 font-medium">Lesson</th>
            <th className="px-4 py-3 font-medium">Start</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {bookings.map((booking) => (
            <tr key={booking.id} className="hover:bg-black/[0.02]">
              <td className="px-4 py-3 font-medium text-secondary">{booking.title}</td>
              <td className="px-4 py-3 text-secondary/70">{new Date(booking.start_time).toLocaleString()}</td>
              <td className="px-4 py-3 text-secondary/70">{booking.lesson_type}</td>
              <td className="px-4 py-3">
                <Badge variant={STATUS_TONE[booking.status]}>{booking.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
