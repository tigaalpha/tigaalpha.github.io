import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";

interface ConnectionRow {
  id: string;
  label: string;
  calendar_id: string;
  refresh_token: string;
  color: string;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  colorId?: string;
}

// Google Calendar's fixed event color palette (colorId -> hex) — same values
// Google's own web/app UI uses, so events with a per-event color override
// look identical to what the user sees in Google Calendar itself.
const EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb",
  "2": "#33b679",
  "3": "#8e24aa",
  "4": "#e67c73",
  "5": "#f6bf26",
  "6": "#f4511e",
  "7": "#039be5",
  "8": "#616161",
  "9": "#3f51b5",
  "10": "#0b8043",
  "11": "#d50000",
};

async function getCalendarColor(accessToken: string, calendarId: string, fallback: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) return fallback;
    const data = (await response.json()) as { backgroundColor?: string };
    return data.backgroundColor ?? fallback;
  } catch {
    return fallback;
  }
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`Token refresh failed (${response.status})`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access token returned");
  return data.access_token;
}

async function listEvents(accessToken: string, calendarId: string, timeMin: string, timeMax: string): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error(`Calendar API failed (${response.status})`);
  const data = (await response.json()) as { items?: GoogleEvent[] };
  return data.items ?? [];
}

// Read-only viewing across up to 3 separately connected Google accounts —
// each account's refresh token stays server-side; only event data goes back
// to the browser. Distinct from calendar.ts, which is the single-account
// booking-sync path (createEvent/updateEvent for lessons).
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    const { connectionIds, timeMin, timeMax } = await req.json();
    if (!timeMin || !timeMax) return jsonResponse({ error: "timeMin and timeMax are required" }, 400);

    let query = admin.from("google_calendar_connections").select("id, label, calendar_id, refresh_token, color");
    if (Array.isArray(connectionIds) && connectionIds.length > 0) {
      query = query.in("id", connectionIds);
    }
    const { data: connections, error } = await query;
    if (error) throw error;

    const clientIdRow = await admin.from("integration_settings").select("value").eq("key", "google_client_id").maybeSingle();
    const clientId = clientIdRow.data?.value;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "Google Client ID/Secret not configured" }, 400);
    }

    const results = await Promise.all(
      ((connections ?? []) as ConnectionRow[]).map(async (conn) => {
        try {
          const accessToken = await getAccessToken(clientId, clientSecret, conn.refresh_token);
          const [events, calendarColor] = await Promise.all([
            listEvents(accessToken, conn.calendar_id, timeMin, timeMax),
            getCalendarColor(accessToken, conn.calendar_id, conn.color),
          ]);
          return {
            connectionId: conn.id,
            label: conn.label,
            color: conn.color,
            events: events.map((e) => ({
              id: e.id,
              title: e.summary ?? "(no title)",
              start: e.start?.dateTime ?? e.start?.date ?? "",
              end: e.end?.dateTime ?? e.end?.date ?? "",
              // Per-event color override (set by the user in Google Calendar)
              // falls back to that account's own calendar color, matching
              // exactly what they see in the real Google Calendar UI.
              color: (e.colorId && EVENT_COLORS[e.colorId]) || calendarColor,
            })),
            error: null as string | null,
          };
        } catch (err) {
          return {
            connectionId: conn.id,
            label: conn.label,
            color: conn.color,
            events: [] as { id: string; title: string; start: string; end: string }[],
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      })
    );

    return jsonResponse({ connections: results });
  } catch (error) {
    return await handleUnexpectedError(admin, "gcal-events", error);
  }
});
