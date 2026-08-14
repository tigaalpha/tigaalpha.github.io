"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import type { CalendarBookingEvent, ExternalCalendarEvent } from "@/features/calendar/components/calendar-view";
import type { GoogleCalendarConnectionSummary } from "@/services/repositories/google-calendar-connections.repository";

// Titles from teachers' personal Google Calendars lead with the lesson
// number (e.g. "13แดง" = student "แดง", lesson 13) — color-code the first
// and last lesson of a course the same yellow/green convention as the
// internal Bookings calendar, instead of leaving every session the same
// flat Google Calendar color.
const FIRST_LESSON_COLOR = "#FFC107";
const FINAL_LESSON_COLOR = "#00C853";
const FINAL_LESSON_NUMBERS = new Set([10, 20, 40, 80]);

function lessonNumberColor(title: string): string | null {
  const match = title.trim().match(/^(\d+)/);
  if (!match) return null;
  const lessonNumber = Number(match[1]);
  if (lessonNumber === 1) return FIRST_LESSON_COLOR;
  if (FINAL_LESSON_NUMBERS.has(lessonNumber)) return FINAL_LESSON_COLOR;
  return null;
}

interface GcalEventsResponse {
  connections: {
    connectionId: string;
    label: string;
    color: string;
    events: { id: string; title: string; start: string; end: string; color: string }[];
    error: string | null;
  }[];
}

/**
 * Shared data source for anywhere that needs to show real lesson times --
 * internal bookings plus events from up to 3 linked external Google
 * Calendar accounts. Originally lived only in calendar/page.tsx; extracted
 * so the Attendance page can show the same real data instead of the owner
 * re-entering schedules that already exist here.
 */
export function useCalendarEvents(rangeDaysBack: number, rangeDaysForward: number) {
  const [events, setEvents] = useState<CalendarBookingEvent[] | null>(null);
  const [connections, setConnections] = useState<GoogleCalendarConnectionSummary[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [externalEvents, setExternalEvents] = useState<ExternalCalendarEvent[]>([]);

  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - rangeDaysBack);
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + rangeDaysForward);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.bookings.listBetween(rangeStart.toISOString(), rangeEnd.toISOString()).then((bookings) => {
      setEvents(bookings.map((b) => ({ id: b.id, title: b.title, start: b.start_time, end: b.end_time, lessonType: b.lesson_type })));
    });
    repos.googleCalendarConnections.list().then((list) => {
      setConnections(list);
      setSelectedIds(new Set(list.map((c) => c.id)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadExternalEvents = useCallback(async (ids: Set<string>) => {
    if (ids.size === 0) {
      setExternalEvents([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.functions.invoke<GcalEventsResponse>("gcal-events", {
      body: { connectionIds: Array.from(ids), timeMin: rangeStart.toISOString(), timeMax: rangeEnd.toISOString() },
    });
    if (!data) return;
    setExternalEvents(
      data.connections.flatMap((conn) =>
        conn.events.map((e) => ({
          id: `${conn.connectionId}:${e.id}`,
          title: `${e.title} (${conn.label})`,
          start: e.start,
          end: e.end,
          color: lessonNumberColor(e.title) ?? e.color,
        }))
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connections && connections.length > 0) void loadExternalEvents(selectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, connections]);

  function toggleConnection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return { events, connections, selectedIds, externalEvents, toggleConnection };
}
