"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import { useRouter } from "next/navigation";

export interface CalendarBookingEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  lessonType: "normal" | "final";
}

const LESSON_COLOR: Record<CalendarBookingEvent["lessonType"], string> = {
  normal: "#FFC107",
  final: "#00C853",
};

export function CalendarView({ events }: { events: CalendarBookingEvent[] }) {
  const router = useRouter();

  function handleEventClick(arg: EventClickArg) {
    router.push(`/booking?bookingId=${arg.event.id}`);
  }

  return (
    <div className="rounded-2xl border border-line/5 bg-card p-4 shadow-soft [--fc-border-color:rgba(18,18,18,0.06)] [--fc-today-bg-color:rgba(255,95,162,0.06)]">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
        height="auto"
        slotMinTime="08:00:00"
        slotMaxTime="21:00:00"
        nowIndicator
        eventClick={handleEventClick}
        events={events.map((event) => ({
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end,
          backgroundColor: LESSON_COLOR[event.lessonType],
          borderColor: LESSON_COLOR[event.lessonType],
          textColor: "#121212",
        }))}
      />
    </div>
  );
}
