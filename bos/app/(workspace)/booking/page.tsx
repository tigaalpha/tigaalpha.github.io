"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { BookingsTable } from "@/features/booking/components/bookings-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function BookingPage() {
  const [bookings, setBookings] = useState<Tables<"bookings">[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());

    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - 7);
    const rangeEnd = new Date(now);
    rangeEnd.setDate(rangeEnd.getDate() + 30);

    repos.bookings.listBetween(rangeStart.toISOString(), rangeEnd.toISOString()).then(setBookings);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Bookings</h1>
        <p className="text-sm text-secondary/50">Requests confirmed or created by the AI Booking Assistant</p>
      </div>
      {bookings ? <BookingsTable bookings={bookings} /> : <Skeleton className="h-64" />}
    </div>
  );
}
