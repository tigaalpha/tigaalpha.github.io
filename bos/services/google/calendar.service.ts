import "server-only";
import { google, type calendar_v3 } from "googleapis";
import { env } from "@/lib/env";
import type { LessonEventType } from "@/types/database";

// Google Calendar colorId palette: 5 = Banana (yellow), 10 = Basil (green).
const COLOR_ID: Record<LessonEventType, string> = {
  normal: "5",
  final: "10",
};

export interface CreateEventInput {
  title: string;
  startTime: string;
  endTime: string;
  lessonType: LessonEventType;
  description?: string;
}

export interface UpdateEventInput {
  title?: string;
  startTime?: string;
  endTime?: string;
  lessonType?: LessonEventType;
}

export interface CalendarEventSlot {
  id: string;
  title: string;
  start: string;
  end: string;
}

/**
 * Wraps the Google Calendar API. This is the only place googleapis is
 * imported — callers depend on this service's interface, not the vendor SDK.
 */
export class CalendarService {
  private calendarId = env.google.calendarId();

  private client(): calendar_v3.Calendar {
    const auth = new google.auth.OAuth2(env.google.clientId(), env.google.clientSecret(), env.google.redirectUri());
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.calendar({ version: "v3", auth });
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEventSlot> {
    const { data } = await this.client().events.insert({
      calendarId: this.calendarId,
      requestBody: {
        summary: input.title,
        description: input.description,
        start: { dateTime: input.startTime },
        end: { dateTime: input.endTime },
        colorId: COLOR_ID[input.lessonType],
      },
    });

    return { id: data.id ?? "", title: data.summary ?? input.title, start: input.startTime, end: input.endTime };
  }

  async updateEvent(eventId: string, input: UpdateEventInput): Promise<CalendarEventSlot> {
    const { data } = await this.client().events.patch({
      calendarId: this.calendarId,
      eventId,
      requestBody: {
        ...(input.title ? { summary: input.title } : {}),
        ...(input.startTime ? { start: { dateTime: input.startTime } } : {}),
        ...(input.endTime ? { end: { dateTime: input.endTime } } : {}),
        ...(input.lessonType ? { colorId: COLOR_ID[input.lessonType] } : {}),
      },
    });

    return {
      id: data.id ?? eventId,
      title: data.summary ?? input.title ?? "",
      start: data.start?.dateTime ?? input.startTime ?? "",
      end: data.end?.dateTime ?? input.endTime ?? "",
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.client().events.delete({ calendarId: this.calendarId, eventId });
  }

  async listEventsBetween(timeMin: string, timeMax: string): Promise<CalendarEventSlot[]> {
    const { data } = await this.client().events.list({
      calendarId: this.calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    return (data.items ?? []).map((event) => ({
      id: event.id ?? "",
      title: event.summary ?? "",
      start: event.start?.dateTime ?? event.start?.date ?? "",
      end: event.end?.dateTime ?? event.end?.date ?? "",
    }));
  }

  /** Free/busy check used before offering a slot to a customer. */
  async findAvailableSlots(timeMin: string, timeMax: string, durationMinutes: number): Promise<{ start: string; end: string }[]> {
    const busy = await this.listEventsBetween(timeMin, timeMax);
    const slots: { start: string; end: string }[] = [];

    let cursor = new Date(timeMin);
    const end = new Date(timeMax);
    const durationMs = durationMinutes * 60 * 1000;

    while (cursor.getTime() + durationMs <= end.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + durationMs);

      const overlaps = busy.some((event) => {
        const eventStart = new Date(event.start).getTime();
        const eventEnd = new Date(event.end).getTime();
        return slotStart.getTime() < eventEnd && slotEnd.getTime() > eventStart;
      });

      if (!overlaps) {
        slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
      }

      cursor = new Date(cursor.getTime() + durationMs);
    }

    return slots;
  }
}
