import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ToolDefinition, ToolCall } from "./ai-types.ts";
import { embed } from "./ai-provider.ts";
import * as calendar from "./calendar.ts";

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: "search_knowledge_base",
    description: "Search the school's knowledge base for pricing, promotions, teachers, policies, FAQ, school info, or holidays.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "check_calendar_availability",
    description: "Find open lesson slots for a teacher between two ISO datetimes.",
    parameters: {
      type: "object",
      properties: {
        teacherId: { type: "string" },
        timeMin: { type: "string" },
        timeMax: { type: "string" },
        durationMinutes: { type: "number", default: 60 },
      },
      required: ["teacherId", "timeMin", "timeMax"],
    },
  },
  {
    name: "book_lesson",
    description: "Book a confirmed lesson for a customer with an active course, creating the calendar event.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        teacherId: { type: "string" },
        startTime: { type: "string" },
        endTime: { type: "string" },
      },
      required: ["customerId", "teacherId", "startTime", "endTime"],
    },
  },
  {
    name: "reschedule_lesson",
    description: "Move an existing booking to a new time.",
    parameters: {
      type: "object",
      properties: { bookingId: { type: "string" }, newStart: { type: "string" }, newEnd: { type: "string" } },
      required: ["bookingId", "newStart", "newEnd"],
    },
  },
  {
    name: "cancel_lesson",
    description: "Cancel an existing booking and remove its calendar event.",
    parameters: { type: "object", properties: { bookingId: { type: "string" } }, required: ["bookingId"] },
  },
  {
    name: "lookup_customer",
    description: "Look up a customer's CRM record by id or LINE user id.",
    parameters: { type: "object", properties: { customerId: { type: "string" }, lineUserId: { type: "string" } } },
  },
  {
    name: "list_teachers",
    description: "List active teachers with their id, name, and specialties — use this to resolve a teacher's name to their id before booking or saving a preferred teacher.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "update_customer_profile",
    description: "Update qualification fields collected during a sales conversation.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        age: { type: "number" },
        learningGoal: { type: "string" },
        budget: { type: "string" },
        experienceLevel: { type: "string" },
        preferredSchedule: { type: "string" },
        preferredTeacherId: { type: "string", description: "Teacher id from list_teachers, if the customer names a preference." },
        parentName: { type: "string", description: "For a minor student, the parent/guardian's name." },
        parentPhone: { type: "string", description: "For a minor student, the parent/guardian's phone number." },
        leadSource: { type: "string", description: "How the customer found the school, if they mention it (e.g. Facebook, friend referral, walk-in)." },
        notes: { type: "string" },
      },
      required: ["customerId"],
    },
  },
  {
    name: "change_sales_status",
    description: "Move a customer to a new stage of the sales pipeline, with a short reason.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        status: {
          type: "string",
          enum: [
            "new_lead", "contacted", "qualified", "interested", "trial_booked",
            "trial_completed", "negotiating", "waiting_decision", "won", "lost",
            "renew_pending", "renewed",
          ],
        },
        note: { type: "string" },
      },
      required: ["customerId", "status"],
    },
  },
  {
    name: "flag_needs_review",
    description: "Escalate the current conversation to the owner.",
    parameters: {
      type: "object",
      properties: { conversationId: { type: "string" }, reason: { type: "string" } },
      required: ["conversationId", "reason"],
    },
  },
];

export async function executeTool(call: ToolCall, db: SupabaseClient): Promise<unknown> {
  const args = call.arguments as Record<string, string | number | undefined>;

  switch (call.name) {
    case "search_knowledge_base": {
      const embedding = await embed(String(args.query ?? ""));
      const { data, error } = await db.rpc("match_knowledge_chunks", {
        query_embedding: embedding,
        match_count: 6,
        min_similarity: 0.65,
      });
      if (error) throw error;
      const context = (data ?? [])
        .map((m: { similarity: number; content: string }, i: number) => `[${i + 1}] (similarity ${m.similarity.toFixed(2)}) ${m.content}`)
        .join("\n\n");
      return { context };
    }

    case "list_teachers": {
      const { data, error } = await db.from("teachers").select("id, name, specialties").eq("active", true);
      if (error) throw error;
      return { teachers: data };
    }

    case "check_calendar_availability":
      return { slots: await calendar.findAvailableSlots(String(args.timeMin), String(args.timeMax), Number(args.durationMinutes ?? 60)) };

    case "book_lesson": {
      const { data: customer, error: custErr } = await db.from("customers").select("*").eq("id", args.customerId).single();
      if (custErr || !customer) throw new Error("Customer not found");

      const { data: course, error: courseErr } = await db
        .from("courses")
        .select("*")
        .eq("customer_id", args.customerId)
        .gt("remaining_hour", 0)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (courseErr || !course) throw new Error("No active course with remaining hours");

      const { data: conflicts } = await db
        .from("bookings")
        .select("id")
        .eq("teacher_id", args.teacherId)
        .neq("status", "cancelled")
        .lt("start_time", String(args.endTime))
        .gt("end_time", String(args.startTime));
      if (conflicts && conflicts.length > 0) {
        await db.from("notifications").insert({
          type: "conflict_booking",
          title: "AI attempted a conflicting booking",
          body: `${customer.name} wanted ${args.startTime}, but this teacher already has a lesson then.`,
          customer_id: args.customerId as string,
        });
        throw new Error("Teacher already booked in this time range");
      }

      const lessonNumber = course.current_hour + 1;
      const lessonType = lessonNumber >= course.total_hours ? "final" : "normal";
      const title = `${lessonNumber}${String(customer.name).trim().replace(/\s+/g, "").toUpperCase()}`;

      const event = await calendar.createEvent({
        title,
        startTime: String(args.startTime),
        endTime: String(args.endTime),
        lessonType,
      });

      const { data: booking, error: bookingErr } = await db
        .from("bookings")
        .insert({
          customer_id: args.customerId,
          course_id: course.id,
          teacher_id: args.teacherId,
          google_event_id: event.id,
          title,
          lesson_type: lessonType,
          status: "confirmed",
          start_time: args.startTime,
          end_time: args.endTime,
        })
        .select("*")
        .single();
      if (bookingErr) throw bookingErr;

      return { booking, lessonNumber, lessonType };
    }

    case "reschedule_lesson": {
      const { data: booking, error } = await db.from("bookings").select("*").eq("id", args.bookingId).single();
      if (error || !booking) throw new Error("Booking not found");

      if (booking.google_event_id) {
        await calendar.updateEvent(booking.google_event_id, { startTime: String(args.newStart), endTime: String(args.newEnd) });
      }

      const { data: updated, error: updateErr } = await db
        .from("bookings")
        .update({ start_time: args.newStart, end_time: args.newEnd, status: "rescheduled" })
        .eq("id", args.bookingId)
        .select("*")
        .single();
      if (updateErr) throw updateErr;
      return updated;
    }

    case "cancel_lesson": {
      const { data: booking, error } = await db.from("bookings").select("*").eq("id", args.bookingId).single();
      if (error || !booking) throw new Error("Booking not found");
      if (booking.google_event_id) await calendar.deleteEvent(booking.google_event_id);

      const { data: updated, error: updateErr } = await db
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", args.bookingId)
        .select("*")
        .single();
      if (updateErr) throw updateErr;
      return updated;
    }

    case "lookup_customer": {
      const query = db.from("customers").select("*");
      if (args.customerId) {
        const { data } = await query.eq("id", args.customerId).maybeSingle();
        return data;
      }
      if (args.lineUserId) {
        const { data } = await query.eq("line_user_id", args.lineUserId).maybeSingle();
        return data;
      }
      return null;
    }

    case "update_customer_profile": {
      const {
        customerId, learningGoal, experienceLevel, preferredSchedule, age, budget,
        preferredTeacherId, parentName, parentPhone, leadSource, notes,
      } = args as Record<string, string | number>;
      const patch: Record<string, unknown> = {};
      if (learningGoal) patch.learning_goal = learningGoal;
      if (experienceLevel) patch.experience_level = experienceLevel;
      if (preferredSchedule) patch.preferred_schedule = preferredSchedule;
      if (age) patch.age = Number(age);
      if (budget) patch.budget = budget;
      if (preferredTeacherId) patch.preferred_teacher_id = preferredTeacherId;
      if (parentName) patch.parent_name = parentName;
      if (parentPhone) patch.parent_phone = parentPhone;
      if (leadSource) patch.lead_source = leadSource;
      if (notes) patch.notes = notes;

      const { data, error } = await db.from("customers").update(patch).eq("id", customerId).select("*").single();
      if (error) throw error;
      return data;
    }

    case "change_sales_status": {
      const { data: customer, error: fetchErr } = await db.from("customers").select("sales_status").eq("id", args.customerId).single();
      if (fetchErr) throw fetchErr;

      await db.from("sales_status_history").insert({
        customer_id: args.customerId,
        from_status: customer.sales_status,
        to_status: args.status,
        note: args.note ?? null,
      });

      const { error: updateErr } = await db.from("customers").update({ sales_status: args.status }).eq("id", args.customerId);
      if (updateErr) throw updateErr;
      return { ok: true };
    }

    case "flag_needs_review": {
      await db.from("conversations").update({ needs_review: true }).eq("id", args.conversationId);
      await db.from("notifications").insert({ type: "ai_needs_review", title: "AI escalated a conversation", body: args.reason });
      return { ok: true };
    }

    default:
      throw new Error(`Unknown tool: ${call.name}`);
  }
}
