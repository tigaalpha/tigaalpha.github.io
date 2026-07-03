import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createRepositories } from "@/services/repositories";
import { CalendarService } from "@/services/google/calendar.service";
import { BookingService } from "@/services/business/booking.service";
import { getAIProvider } from "@/services/ai/provider";
import { ChatService } from "@/services/ai/chat.service";
import { LineService } from "@/services/line/line.service";

/** Application-wide dependency container, built once per request. */
export function createContainer(db: SupabaseClient<Database>) {
  const repos = createRepositories(db);
  const calendar = new CalendarService();
  const booking = new BookingService(repos, calendar);
  const ai = getAIProvider();
  const chat = new ChatService(ai, repos, booking, calendar);
  const line = new LineService();

  return { repos, calendar, booking, ai, chat, line };
}
