"use client";

import { useMemo } from "react";
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

export interface ExternalCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
}

const LESSON_COLOR: Record<CalendarBookingEvent["lessonType"], string> = {
  normal: "#FFC107",
  final: "#00C853",
};

/**
 * Extract the student name from a booking title.
 * Titles like "13แดง" → "แดง", "11Eth" → "Ethar", "Miya" → "Miya"
 * Strips lesson numbers, digits, and Google Calendar label suffixes like "(GCal Tiga)".
 */
function extractStudentName(title: string): string {
  let name = title.trim();
  // Remove Google Calendar label suffixes like "(GCal Tiga)"
  name = name.replace(/\s*\([^)]*\)\s*$/, "");
  // Remove leading lesson number (e.g. "11Ethar" → "Ethar", "13แดง" → "แดง")
  name = name.replace(/^\d+\s*/, "");
  // Remove trailing lesson numbers like "32GV" → "GV"
  name = name.replace(/\s*\d+[A-Za-z]*\s*$/, "");
  return name.trim().toLowerCase();
}

/**
 * Get the alphabetic-only prefix of a name for fuzzy matching.
 * e.g. "ethar" → "ethar", "eth" → "eth", "calvin" → "calvin", "ca" → "ca"
 */
function getAlphaPrefix(name: string): string {
  return name.replace(/[^a-zก-๙]/g, "");
}

/**
 * Check if two event titles refer to the same student.
 * Handles abbreviations like "11Eth" === "Ethar" and "34Ca" === "Calvin".
 */
function isSameStudent(titleA: string, titleB: string): boolean {
  const a = extractStudentName(titleA);
  const b = extractStudentName(titleB);
  if (!a || !b) return false;
  // Exact match
  if (a === b) return true;
  // One is prefix of the other (handles abbreviation: "eth" prefix of "ethar")
  const aPrefix = getAlphaPrefix(a);
  const bPrefix = getAlphaPrefix(b);
  if (aPrefix.length >= 2 && bPrefix.length >= 2) {
    if (aPrefix.startsWith(bPrefix) || bPrefix.startsWith(aPrefix)) return true;
  }
  return false;
}

/**
 * Deduplicate events: same student name on the same calendar date = keep only one.
 * Internal bookings (lessonType) take priority over external (Google Calendar) events.
 */
function deduplicateEvents(
  internalEvents: { id: string; title: string; start: string; end: string; bgColor: string; borderColor: string; textColor: string; extendedProps?: Record<string, unknown> }[],
  externalMapped: { id: string; title: string; start: string; end: string; bgColor: string; borderColor: string; textColor: string; extendedProps?: Record<string, unknown> }[],
) {
  // Combine: internal first, then external (internal takes priority)
  const all = [...internalEvents, ...externalMapped];
  const seen: { title: string; date: string }[] = [];
  const result: typeof all = [];

  for (const ev of all) {
    const dateStr = ev.start.slice(0, 10); // YYYY-MM-DD
    const isDuplicate = seen.some((s) => s.date === dateStr && isSameStudent(s.title, ev.title));
    if (isDuplicate) continue; // skip duplicate
    seen.push({ title: ev.title, date: dateStr });
    result.push(ev);
  }
  return result;
}

export function CalendarView({ events, externalEvents = [] }: { events: CalendarBookingEvent[]; externalEvents?: ExternalCalendarEvent[] }) {
  const router = useRouter();

  function handleEventClick(arg: EventClickArg) {
    if (arg.event.extendedProps.external) return;
    router.push(`/booking?bookingId=${arg.event.id}`);
  }

  const dedupedEvents = useMemo(() => {
    const internalMapped = events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      bgColor: LESSON_COLOR[event.lessonType],
      borderColor: LESSON_COLOR[event.lessonType],
      textColor: "#121212",
    }));
    const externalMapped = externalEvents.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      bgColor: event.color,
      borderColor: event.color,
      textColor: "#ffffff",
      extendedProps: { external: true },
    }));
    return deduplicateEvents(internalMapped, externalMapped);
  }, [events, externalEvents]);

  return (
    <div className="rounded-2xl border border-line/5 bg-card p-4 shadow-soft [--fc-border-color:rgba(18,18,18,0.06)] [--fc-today-bg-color:rgba(255,95,162,0.06)] [&_.fc-event-title]:text-[11px] [&_.fc-event-time]:text-[11px] [&_.fc-daygrid-event]:font-normal">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
        height="auto"
        slotMinTime="08:00:00"
        slotMaxTime="21:00:00"
        nowIndicator
        views={{ dayGridMonth: { displayEventTime: false } }}
        eventClick={handleEventClick}
        events={dedupedEvents.map((ev) => ({
          id: ev.id,
          title: ev.title,
          start: ev.start,
          end: ev.end,
          backgroundColor: ev.bgColor,
          borderColor: ev.borderColor,
          textColor: ev.textColor,
          extendedProps: ev.extendedProps,
        }))}
      />
    </div>
  );
}
