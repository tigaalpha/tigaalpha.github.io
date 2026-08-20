"use client";

import { CalendarView } from "@/features/calendar/components/calendar-view";
import { GoogleCalendarBanner } from "@/features/calendar/components/google-calendar-banner";
import { GoogleCalendarFilter } from "@/features/calendar/components/google-calendar-filter";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { Skeleton } from "@/components/ui/skeleton";

const RANGE_DAYS_BACK = 14;
const RANGE_DAYS_FORWARD = 45;

export default function CalendarPage() {
  const { events, connections, selectedIds, externalEvents, toggleConnection } = useCalendarEvents(RANGE_DAYS_BACK, RANGE_DAYS_FORWARD);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Calendar</h1>
        <p className="text-sm text-secondary/50">Yellow = normal lesson · Green = final lesson (collect payment / renew)</p>
      </div>
      <GoogleCalendarBanner />
      {connections && connections.length > 0 ? (
        <GoogleCalendarFilter connections={connections} selectedIds={selectedIds} onToggle={toggleConnection} />
      ) : null}
      {events ? <CalendarView events={events} externalEvents={externalEvents} /> : <Skeleton className="h-[600px]" />}
    </div>
  );
}
