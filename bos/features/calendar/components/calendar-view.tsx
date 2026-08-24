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
 * Handles abbreviations like "11Eth" === "Ethar", "11Aic" === "Aider",
 * "28Mi" === "Miya", "34Ca" === "Calvin".
 * Strategy: exact → prefix → first-2-char match.
 */
function isSameStudent(titleA: string, titleB: string): boolean {
  const a = extractStudentName(titleA);
  const b = extractStudentName(titleB);
  if (!a || !b) return false;
  // 1. Exact match
  if (a === b) return true;
  // 2. One is prefix of the other (e.g. "eth" ⊂ "ethar")
  if (a.length >= 2 && b.length >= 2) {
    if (a.startsWith(b) || b.startsWith(a)) return true;
  }
  // 3. First 2 characters match (handles loose abbreviations like "aic" ↔ "aider")
  if (a.length >= 2 && b.length >= 2 && a[0] === b[0] && a[1] === b[1]) return true;
  return false;
}

/**
 * Extract YYYY-MM-DD from an ISO date string, handling both UTC and local offsets.
 */
function toDateKey(iso: string): string {
  // If it's just a date (YYYY-MM-DD), return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  // Parse the date — use the local calendar date, not UTC
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Deduplicate events: same student name on the same calendar date = keep only one.
 * External (Google Calendar / blue) events take priority over internal bookings.
 * Internal events that match an external event are hidden.
 * Internal events with NO external match are shown in blue (not yellow).
 */
const BLUE_COLOR = "#039be5";

function deduplicateEvents(
  internalEvents: { id: string; title: string; start: string; end: string; bgColor: string; borderColor: string; textColor: string; extendedProps?: Record<string, unknown> }[],
  externalMapped: { id: string; title: string; start: string; end: string; bgColor: string; borderColor: string; textColor: string; extendedProps?: Record<string, unknown> }[],
) {
  // 1. Process external events first (they take priority)
  const seen: { key: string; date: string }[] = [];
  const result: typeof externalMapped = [];

  for (const ev of externalMapped) {
    const dateStr = toDateKey(ev.start);
    seen.push({ key: ev.title, date: dateStr });
    result.push(ev);
  }

  // 2. Add internal events only if they don't match any external event
  //    Recolor them to blue so everything looks consistent
  for (const ev of internalEvents) {
    const dateStr = toDateKey(ev.start);
    const isDuplicate = seen.some(
      (s) => s.date === dateStr && isSameStudent(s.key, ev.title),
    );
    if (isDuplicate) continue; // skip — external already covers this
    seen.push({ key: ev.title, date: dateStr });
    // Recolor internal-only events to blue
    result.push({ ...ev, bgColor: BLUE_COLOR, borderColor: BLUE_COLOR, textColor: "#ffffff" });
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
