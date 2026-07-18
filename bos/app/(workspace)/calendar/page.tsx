"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { CalendarView, type CalendarBookingEvent } from "@/features/calendar/components/calendar-view";
import { GoogleCalendarBanner } from "@/features/calendar/components/google-calendar-banner";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarBookingEvent[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());

    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - 14);
    const rangeEnd = new Date(now);
    rangeEnd.setDate(rangeEnd.getDate() + 45);

    repos.bookings.listBetween(rangeStart.toISOString(), rangeEnd.toISOString()).then((bookings) => {
      setEvents(
        bookings.map((b) => ({ id: b.id, title: b.title, start: b.start_time, end: b.end_time, lessonType: b.lesson_type }))
      );
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Calendar</h1>
        <p className="text-sm text-secondary/50">Yellow = normal lesson · Green = final lesson (collect payment / renew)</p>
      </div>
      <GoogleCalendarBanner />
      {events ? <CalendarView events={events} /> : <Skeleton className="h-[600px]" />}
    </div>
  );
}
