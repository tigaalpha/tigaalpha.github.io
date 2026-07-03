import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { BookingsTable } from "@/features/booking/components/bookings-table";

export default async function BookingPage() {
  const supabase = await createClient();
  const repos = createRepositories(supabase);

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 7);
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + 30);

  const bookings = await repos.bookings.listBetween(rangeStart.toISOString(), rangeEnd.toISOString());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Bookings</h1>
        <p className="text-sm text-secondary/50">Requests confirmed or created by the AI Booking Assistant</p>
      </div>
      <BookingsTable bookings={bookings} />
    </div>
  );
}
