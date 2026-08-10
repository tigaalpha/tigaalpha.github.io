// Google Calendar REST wrapper via plain fetch (no googleapis SDK — keeps
// the Edge Function bundle small and Deno-native).

import { getGoogleAccessToken } from "./google-auth.ts";
import { computeAvailableSlots } from "./availability.ts";

const COLOR_ID: Record<"normal" | "final", string> = {
  normal: "5", // Banana (yellow)
  final: "10", // Basil (green)
};

function calendarId(): string {
  return Deno.env.get("GOOGLE_CALENDAR_ID") ?? "primary";
}

async function calendarFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getGoogleAccessToken();
  return fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

export interface CalendarEventSlot {
  id: string;
  title: string;
  start: string;
  end: string;
}

export async function createEvent(input: {
  title: string;
  startTime: string;
  endTime: string;
  lessonType: "normal" | "final";
}): Promise<CalendarEventSlot> {
  const response = await calendarFetch("/events", {
    method: "POST",
    body: JSON.stringify({
      summary: input.title,
      start: { dateTime: input.startTime },
      end: { dateTime: input.endTime },
      colorId: COLOR_ID[input.lessonType],
    }),
  });

  if (!response.ok) throw new Error(`Create event failed (${response.status}): ${await response.text()}`);
  const data = await response.json();
  return { id: data.id, title: data.summary, start: input.startTime, end: input.endTime };
}

export async function updateEvent(
  eventId: string,
  input: { title?: string; startTime?: string; endTime?: string; lessonType?: "normal" | "final" }
): Promise<CalendarEventSlot> {
  const response = await calendarFetch(`/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(input.title ? { summary: input.title } : {}),
      ...(input.startTime ? { start: { dateTime: input.startTime } } : {}),
      ...(input.endTime ? { end: { dateTime: input.endTime } } : {}),
      ...(input.lessonType ? { colorId: COLOR_ID[input.lessonType] } : {}),
    }),
  });

  if (!response.ok) throw new Error(`Update event failed (${response.status}): ${await response.text()}`);
  const data = await response.json();
  return { id: data.id, title: data.summary, start: data.start?.dateTime, end: data.end?.dateTime };
}

export async function deleteEvent(eventId: string): Promise<void> {
  const response = await calendarFetch(`/events/${eventId}`, { method: "DELETE" });
  if (!response.ok && response.status !== 410) {
    throw new Error(`Delete event failed (${response.status}): ${await response.text()}`);
  }
}

/** Real connectivity check (used by system-health-check) -- a throwaway 1-minute-window call, true unless it throws. Never throws itself. */
export async function checkConnection(): Promise<boolean> {
  try {
    const now = new Date();
    await listEventsBetween(now.toISOString(), new Date(now.getTime() + 60_000).toISOString());
    return true;
  } catch {
    return false;
  }
}

export async function listEventsBetween(timeMin: string, timeMax: string): Promise<CalendarEventSlot[]> {
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime" });
  const response = await calendarFetch(`/events?${params.toString()}`);
  if (!response.ok) throw new Error(`List events failed (${response.status}): ${await response.text()}`);
  const data = await response.json();
  return (data.items ?? []).map((event: { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }) => ({
    id: event.id,
    title: event.summary ?? "",
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
  }));
}

// Decoupled from Google Calendar so callers that have a better
// (teacher-scoped) source of busy time, like our own `bookings` table,
// don't have to go through the shared, teacher-agnostic Google Calendar
// event list. Lives in its own file (see availability.ts) so it can be
// unit-tested without pulling in this file's Deno-only fetch/env calls.
export { computeAvailableSlots };

/** Whole-calendar (not teacher-scoped) availability — kept for any caller that genuinely wants "is anything on the shared calendar at this time". */
export async function findAvailableSlots(timeMin: string, timeMax: string, durationMinutes: number): Promise<{ start: string; end: string }[]> {
  const busy = await listEventsBetween(timeMin, timeMax);
  return computeAvailableSlots(busy, timeMin, timeMax, durationMinutes);
}
