import "server-only";
import type { ToolDefinition, ToolCall } from "@/types/ai";
import type { Repositories } from "@/services/repositories";
import type { BookingService } from "@/services/business/booking.service";
import type { CalendarService } from "@/services/google/calendar.service";
import type { RagService } from "@/services/ai/rag";

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: "search_knowledge_base",
    description: "Search the school's knowledge base for pricing, promotions, teachers, policies, FAQ, school info, or holidays.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "What the customer wants to know" } },
      required: ["query"],
    },
  },
  {
    name: "check_calendar_availability",
    description: "Find open lesson slots for a teacher between two ISO datetimes.",
    parameters: {
      type: "object",
      properties: {
        teacherId: { type: "string" },
        timeMin: { type: "string", description: "ISO 8601 start of search window" },
        timeMax: { type: "string", description: "ISO 8601 end of search window" },
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
        startTime: { type: "string", description: "ISO 8601" },
        endTime: { type: "string", description: "ISO 8601" },
      },
      required: ["customerId", "teacherId", "startTime", "endTime"],
    },
  },
  {
    name: "reschedule_lesson",
    description: "Move an existing booking to a new time.",
    parameters: {
      type: "object",
      properties: {
        bookingId: { type: "string" },
        newStart: { type: "string" },
        newEnd: { type: "string" },
      },
      required: ["bookingId", "newStart", "newEnd"],
    },
  },
  {
    name: "cancel_lesson",
    description: "Cancel an existing booking and remove its calendar event.",
    parameters: {
      type: "object",
      properties: { bookingId: { type: "string" } },
      required: ["bookingId"],
    },
  },
  {
    name: "lookup_customer",
    description: "Look up a customer's CRM record (course hours, sales status, notes) by id or LINE user id.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        lineUserId: { type: "string" },
      },
    },
  },
  {
    name: "update_customer_profile",
    description: "Update qualification fields collected during a sales conversation (age, goal, budget, experience, preferred teacher/schedule).",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        age: { type: "number" },
        learningGoal: { type: "string" },
        budget: { type: "string" },
        experienceLevel: { type: "string" },
        preferredSchedule: { type: "string" },
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
    description: "Escalate the current conversation to the owner (angry customer, out-of-policy request, or unknown answer).",
    parameters: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        reason: { type: "string" },
      },
      required: ["conversationId", "reason"],
    },
  },
];

export interface ToolContext {
  repos: Repositories;
  booking: BookingService;
  calendar: CalendarService;
  rag: RagService;
}

export async function executeTool(call: ToolCall, ctx: ToolContext): Promise<unknown> {
  const args = call.arguments as Record<string, never>;

  switch (call.name) {
    case "search_knowledge_base":
      return { context: await ctx.rag.retrieveAsContext(String(args.query ?? "")) };

    case "check_calendar_availability":
      return {
        slots: await ctx.calendar.findAvailableSlots(
          String(args.timeMin),
          String(args.timeMax),
          Number(args.durationMinutes ?? 60)
        ),
      };

    case "book_lesson":
      return ctx.booking.book({
        customerId: String(args.customerId),
        teacherId: String(args.teacherId),
        startTime: String(args.startTime),
        endTime: String(args.endTime),
      });

    case "reschedule_lesson":
      return ctx.booking.reschedule(String(args.bookingId), String(args.newStart), String(args.newEnd));

    case "cancel_lesson":
      return ctx.booking.cancel(String(args.bookingId));

    case "lookup_customer": {
      if (args.customerId) return ctx.repos.customers.findById(String(args.customerId));
      if (args.lineUserId) return ctx.repos.customers.findByLineUserId(String(args.lineUserId));
      return null;
    }

    case "update_customer_profile": {
      const { customerId, learningGoal, experienceLevel, preferredSchedule, ...rest } = args;
      return ctx.repos.customers.update(String(customerId), {
        ...(learningGoal ? { learning_goal: String(learningGoal) } : {}),
        ...(experienceLevel ? { experience_level: String(experienceLevel) } : {}),
        ...(preferredSchedule ? { preferred_schedule: String(preferredSchedule) } : {}),
        ...(rest.age ? { age: Number(rest.age) } : {}),
        ...(rest.budget ? { budget: String(rest.budget) } : {}),
        ...(rest.notes ? { notes: String(rest.notes) } : {}),
      });
    }

    case "change_sales_status":
      await ctx.repos.sales.changeStatus(
        String(args.customerId),
        args.status as never,
        args.note ? String(args.note) : undefined
      );
      return { ok: true };

    case "flag_needs_review":
      await ctx.repos.conversations.setNeedsReview(String(args.conversationId), true);
      await ctx.repos.notifications.create(
        "ai_needs_review",
        "AI escalated a conversation",
        String(args.reason),
        undefined,
        undefined
      );
      return { ok: true };

    default:
      throw new Error(`Unknown tool: ${call.name}`);
  }
}
