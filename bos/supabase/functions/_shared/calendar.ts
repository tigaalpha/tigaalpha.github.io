// Google Calendar REST wrapper via plain fetch (no googleapis SDK — keeps
// the Edge Function bundle small and Deno-native).

import { createAdminClient } from "./supabase-admin.ts";

const COLOR_ID: Record<"normal" | "final", string> = {
  normal: "5", // Banana (yellow)
  final: "10", // Basil (green)
};

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Client ID and refresh token come from the integration_settings table when
 * the owner connected Google Calendar through Settings > Integrations (the
 * guided OAuth flow — see google-oauth-start/google-oauth-callback). Falls
 * back to GOOGLE_CLIENT_ID / GOOGLE_REFRESH_TOKEN Edge Function secrets for
 * anyone who set them up the old way (manually, before that UI existed).
 */
async function getGoogleCredentials(): Promise<{ clientId: string; refreshToken: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integration_settings")
    .select("key, value")
    .in("key", ["google_client_id", "google_refresh_token"]);

  const fromDb = Object.fromEntries((data ?? []).map((row: { key: string; value: string | null }) => [row.key, row.value]));

  const clientId = fromDb.google_client_id || Deno.env.get("GOOGLE_CLIENT_ID");
  const refreshToken = fromDb.google_refresh_token || Deno.env.get("GOOGLE_REFRESH_TOKEN");

  if (!clientId || !refreshToken) {
    throw new Error("Google Calendar is not connected yet — connect it from Settings > Integrations.");
  }

  return { clientId, refreshToken };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const { clientId, refreshToken } = await getGoogleCredentials();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token refresh failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

function calendarId(): string {
  return Deno.env.get("GOOGLE_CALENDAR_ID") ?? "primary";
}

async function calendarFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
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

export async function findAvailableSlots(timeMin: string, timeMax: string, durationMinutes: number): Promise<{ start: string; end: string }[]> {
  const busy = await listEventsBetween(timeMin, timeMax);
  const slots: { start: string; end: string }[] = [];
  const durationMs = durationMinutes * 60 * 1000;

  let cursor = new Date(timeMin).getTime();
  const end = new Date(timeMax).getTime();

  while (cursor + durationMs <= end) {
    const slotStart = cursor;
    const slotEnd = cursor + durationMs;

    const overlaps = busy.some((event) => {
      const eventStart = new Date(event.start).getTime();
      const eventEnd = new Date(event.end).getTime();
      return slotStart < eventEnd && slotEnd > eventStart;
    });

    if (!overlaps) {
      slots.push({ start: new Date(slotStart).toISOString(), end: new Date(slotEnd).toISOString() });
    }

    cursor += durationMs;
  }

  return slots;
}
