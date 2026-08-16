import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ToolDefinition, ToolCall } from "./ai-types.ts";
import { embed } from "./ai-provider.ts";
import * as calendar from "./calendar.ts";
import { requestApproval } from "./approvals.ts";
import { requireOwnerOrAdmin } from "./auth.ts";
import { chunkText } from "./text.ts";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from "./categories.ts";
import { sumTransactions } from "./business-metrics.ts";
import { createPayment, confirmPayment } from "./payments.ts";
import { createLessonSummary } from "./lesson-summary.ts";
import { push as linePush } from "./line.ts";

// ISO (UTC) → Bangkok local time for display in messages, e.g. "17:00".
function formatLessonTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok", hour12: false }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

const SALES_STATUSES = [
  "new_lead", "contacted", "qualified", "interested", "trial_booked", "trial_completed",
  "negotiating", "waiting_decision", "won", "lost", "renew_pending", "renewed",
];

// Renewal-opportunity exclusion set, same as courses.repository.ts's
// renewalOpportunities() and automation-engine-runner.ts's
// processCourseThresholdRule -- kept as a local copy here rather than a
// shared import since one is a frontend repository and the other an edge
// function, matching this project's established dual-file precedent.
const RENEWAL_ALREADY_HANDLED_STATUSES = ["renew_pending", "renewed", "lost"];

const KNOWLEDGE_SOURCE_TYPES = [
  "pricing", "promotion", "teachers", "policies", "faq", "school_info", "holiday", "internal_sop",
  "sales_script", "objection_handling", "rule", "example",
];

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
    description:
      "Request cancellation of an existing paid lesson. This does NOT cancel immediately — it submits the request for staff approval and the booking stays active until a staff member approves it. Tell the customer their cancellation request has been sent for review.",
    parameters: {
      type: "object",
      properties: { bookingId: { type: "string" }, reason: { type: "string", description: "Why the customer wants to cancel, if given." } },
      required: ["bookingId"],
    },
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
        practiceFrequency: { type: "string", description: "How often the customer plans to practice (e.g. daily, few times a week, weekends only)." },
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
  {
    name: "create_payment_link",
    description:
      "Issue a bank-transfer payment: the customer transfers straight into the studio's bank account (the account details, amount, and reference code are in the result — relay them exactly) and the owner confirms the transfer after it arrives. Use when the customer agrees to buy a course, renew, or pay a remaining amount.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Customer id — only needed in owner mode; customer chats are bound to the caller automatically." },
        amount: { type: "number", description: "Amount in THB — positive, at most 1,000,000." },
        courseId: { type: "string", description: "Course this payment covers, when known." },
        note: { type: "string", description: "Short note on what this payment is for (e.g. renewal, 40-hour package)." },
      },
      required: ["amount"],
    },
  },
  {
    name: "record_attendance_confirmation",
    description:
      "Record whether the student confirmed they will attend an upcoming lesson (the 24h-before LINE reminder asks this). status = confirmed or declined. Pass bookingId for a one-off lesson, or scheduleId for a weekly recurring slot. Call it the moment the customer answers — this updates the calendar and alerts the owner when they can't come.",
    parameters: {
      type: "object",
      properties: {
        bookingId: { type: "string", description: "The upcoming lesson's booking id." },
        scheduleId: { type: "string", description: "The weekly recurring slot's schedule id." },
        status: { type: "string", enum: ["confirmed", "declined"] },
      },
      required: ["status"],
    },
  },
];

// Only ever offered to the model on the internal/owner channel (see
// chat-core.ts respond() — gated on boundCustomerId === null) — a customer
// on LINE/web must never see these regardless of what they type.
export const OWNER_TOOLS: ToolDefinition[] = [
  {
    name: "record_transaction",
    description:
      "Record an income or expense in the studio's accounting ledger, exactly as the owner describes it. Owner/admin only.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense"] },
        category: {
          type: "string",
          description: `For income use one of: ${INCOME_CATEGORIES.join(", ")}. For expense use one of: ${EXPENSE_CATEGORIES.join(", ")}. Pick the closest match — never invent a new category.`,
          enum: [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES],
        },
        amount: { type: "number", description: "Positive amount in THB." },
        description: { type: "string", description: "Short note on what this transaction was for." },
        transactionDate: { type: "string", description: "ISO date (YYYY-MM-DD). Defaults to today if not given." },
        paymentMethod: { type: "string", enum: PAYMENT_METHODS },
        customerId: { type: "string", description: "If this payment is from/for a specific customer, their id." },
        courseId: { type: "string", description: "If this payment is for a specific course (e.g. a renewal), that course's id." },
      },
      required: ["type", "category", "amount"],
    },
  },
  {
    name: "save_knowledge",
    description:
      "Add a new Knowledge Base document, or update an existing one (pass documentId to overwrite its content) — this is how to teach the AI Chatbot new facts, rules, pricing, or sales scripts.",
    parameters: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Set only when updating an existing document." },
        title: { type: "string" },
        sourceType: { type: "string", enum: KNOWLEDGE_SOURCE_TYPES },
        content: { type: "string", description: "The full text to save — pricing, a rule, an FAQ answer, a sales script, etc." },
      },
      required: ["title", "sourceType", "content"],
    },
  },
  {
    name: "get_business_summary",
    description: "Get a snapshot of the business for today, this week, or this month: revenue, profit, lessons taught, new leads, and deals won in that window.",
    parameters: {
      type: "object",
      properties: { period: { type: "string", enum: ["today", "week", "month"], description: "today = calendar day so far, week = last 7 days, month = last 30 days." } },
      required: ["period"],
    },
  },
  {
    name: "list_customers_needing_attention",
    description:
      "List the customers the owner should look at right now: courses with 3 or fewer remaining hours, leads gone quiet 7+ days, trial lessons today/tomorrow, and bookings still awaiting confirmation. Same list as the Dashboard's 'ต้องทำวันนี้' card.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "bulk_update_sales_status",
    description:
      "Request a sales-status change for several customers at once (e.g. mark a batch of stale leads as lost). This does NOT change anything immediately — it files a request for staff to review and approve, since a bulk change is harder to review after the fact than one customer at a time. Always tell the owner it's pending approval, not done.",
    parameters: {
      type: "object",
      properties: {
        customerIds: { type: "array", items: { type: "string" }, description: "Customer IDs to update (max 50 per request)." },
        toStatus: { type: "string", enum: SALES_STATUSES },
        note: { type: "string", description: "Why this bulk change is being requested." },
      },
      required: ["customerIds", "toStatus"],
    },
  },
  {
    name: "mark_payment_paid",
    description:
      "Owner/admin only: confirm that a bank transfer has actually arrived in the studio's account for a pending payment (check your banking app first!). Records the income in Accounting, moves the customer to won/renewed, and thanks the customer on LINE. Note: when a customer sends their transfer slip photo on LINE, the system auto-verifies it — this tool is for transfers the owner confirmed manually.",
    parameters: {
      type: "object",
      properties: {
        paymentId: { type: "string", description: "The payment's id (from create_payment_link)." },
        note: { type: "string", description: "Optional note for the accounting entry." },
      },
      required: ["paymentId"],
    },
  },
  {
    name: "record_lesson_summary",
    description:
      "Owner/staff only: turn rough notes about a completed lesson into a clean, parent-friendly summary + homework, save it, and send it to the student's parent on LINE automatically. Use right after a lesson ends.",
    parameters: {
      type: "object",
      properties: {
        bookingId: { type: "string", description: "The completed lesson's booking id." },
        notes: { type: "string", description: "Rough notes on what was practiced and how the student did (can be bullet points or a voice-note transcript)." },
      },
      required: ["bookingId", "notes"],
    },
  },
  {
    name: "create_referral_link",
    description:
      "Owner/staff only: generate a referral code for a satisfied customer so they can invite friends and earn a reward. Returns the code and a ready-to-share message. When a referred friend later pays, the system reminds the owner to grant the reward.",
    parameters: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "The customer who will share the referral." },
      },
      required: ["customerId"],
    },
  },
];

// Postgres error code for a violated EXCLUDE/UNIQUE constraint (see
// migration 0023_booking_race_conditions — the real, atomic double-booking
// guard). The old app-level "SELECT for conflicts, then INSERT" pattern was
// a TOCTOU race: two concurrent requests could each pass the check before
// either committed. The DB constraint can't be raced; catching its error
// code here is what turns that into a clean, user-facing "already booked".
const EXCLUSION_VIOLATION = "23P01";

function isExclusionViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === EXCLUSION_VIOLATION);
}

// Postgres error codes for the other common, real failure shapes a
// booking insert/update can hit -- translated to a plain message instead
// of the raw constraint text, which would otherwise reach the model's
// next turn as the tool result (see chat-core.ts) and risk a confusing
// or overly technical reply reaching a real customer.
const FOREIGN_KEY_VIOLATION = "23503";
const NOT_NULL_VIOLATION = "23502";

export function translateDbError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
  if (code === FOREIGN_KEY_VIOLATION) return "ไม่พบครูหรือคอร์สที่ระบุ ตรวจสอบข้อมูลอีกครั้ง";
  if (code === NOT_NULL_VIOLATION) return "ข้อมูลที่จำเป็นสำหรับการจองขาดหายไป";
  return "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

/**
 * `boundCustomerId` is the customer actually tied to the conversation this
 * tool call came from (resolved server-side in chat-core.ts from the
 * conversation row) — null only for internal/owner-mode conversations,
 * where staff are deliberately commanding the AI on an arbitrary customer's
 * behalf. For every other channel (line/web/phone/walk_in), a customer is
 * talking to the AI about themselves only, so any `customerId`/`bookingId`
 * the model's tool-call arguments name is checked against this bound value
 * rather than trusted outright — otherwise a crafted message could get the
 * model to call these tools against a completely different customer's
 * record (a prompt-injection-to-database-write path).
 */
export async function executeTool(
  call: ToolCall,
  db: SupabaseClient,
  boundCustomerId: string | null = null,
  callerId: string | null = null
): Promise<unknown> {
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

    case "check_calendar_availability": {
      // Google Calendar events carry no teacher metadata, so filtering the
      // shared calendar by teacherId isn't possible there — any other
      // teacher's lesson would incorrectly block every teacher's slots.
      // bookings.teacher_id is the source of truth for per-teacher busy
      // time, so availability is computed from our own table instead.
      const { data: busyBookings, error } = await db
        .from("bookings")
        .select("start_time, end_time")
        .eq("teacher_id", args.teacherId)
        .neq("status", "cancelled")
        .lt("start_time", String(args.timeMax))
        .gt("end_time", String(args.timeMin));
      if (error) throw error;
      const busy = (busyBookings ?? []).map((b: { start_time: string; end_time: string }) => ({ start: b.start_time, end: b.end_time }));
      return {
        slots: calendar.computeAvailableSlots(busy, String(args.timeMin), String(args.timeMax), Number(args.durationMinutes ?? 60)),
      };
    }

    case "book_lesson": {
      const customerId = boundCustomerId ?? String(args.customerId ?? "");
      if (!customerId) throw new Error("customerId is required");

      const { data: customer, error: custErr } = await db.from("customers").select("*").eq("id", customerId).single();
      if (custErr || !customer) throw new Error("Customer not found");

      const { data: course, error: courseErr } = await db
        .from("courses")
        .select("*")
        .eq("customer_id", customerId)
        .gt("remaining_hour", 0)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (courseErr || !course) throw new Error("No active course with remaining hours");

      const { data: teacher, error: teacherErr } = await db.from("teachers").select("id, active").eq("id", args.teacherId).maybeSingle();
      if (teacherErr) throw teacherErr;
      if (!teacher) throw new Error("ไม่พบครูที่ระบุ — ใช้ list_teachers เพื่อดูรายชื่อครูที่มีอยู่");
      if (!teacher.active) throw new Error("ครูท่านนี้ไม่ได้อยู่ในสถานะทำงานอยู่ในขณะนี้ เลือกครูท่านอื่น");

      // Lesson number/title/color must reflect how many lessons are already
      // booked for this course, not course.current_hour — current_hour only
      // advances when a lesson is marked *completed* (apply_completed_booking
      // trigger), so booking lesson 2 before lesson 1 has happened would
      // otherwise read the same current_hour and mint a duplicate "1NAME"
      // title/type for both.
      const { count: bookedCount, error: countErr } = await db
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("course_id", course.id)
        .neq("status", "cancelled");
      if (countErr) throw countErr;

      const lessonNumber = (bookedCount ?? 0) + 1;
      const lessonType = lessonNumber >= course.total_hours ? "final" : "normal";
      const title = `${lessonNumber}${String(customer.name).trim().replace(/\s+/g, "").toUpperCase()}`;

      // Insert before touching Google Calendar: the DB exclusion constraint
      // is the atomic conflict guard, so the booking must exist (or be
      // rejected) before any external side effect happens. If the calendar
      // call below fails, the booking still correctly exists with
      // google_event_id left null — calendar-sync flags those for retry —
      // rather than a calendar event existing with no booking behind it.
      const { data: booking, error: bookingErr } = await db
        .from("bookings")
        .insert({
          customer_id: customerId,
          course_id: course.id,
          teacher_id: args.teacherId,
          google_event_id: null,
          title,
          lesson_type: lessonType,
          status: "confirmed",
          start_time: args.startTime,
          end_time: args.endTime,
        })
        .select("*")
        .single();

      if (bookingErr) {
        if (isExclusionViolation(bookingErr)) {
          await db.from("notifications").insert({
            type: "conflict_booking",
            title: "AI attempted a conflicting booking",
            body: `${customer.name} wanted ${args.startTime}, but this teacher already has a lesson then.`,
            customer_id: customerId,
          });
          throw new Error("Teacher already booked in this time range");
        }
        throw new Error(translateDbError(bookingErr));
      }

      const event = await calendar.createEvent({
        title,
        startTime: String(args.startTime),
        endTime: String(args.endTime),
        lessonType,
      });
      const { data: withEvent } = await db.from("bookings").update({ google_event_id: event.id }).eq("id", booking.id).select("*").single();

      return { booking: withEvent ?? booking, lessonNumber, lessonType };
    }

    case "reschedule_lesson": {
      const { data: booking, error } = await db.from("bookings").select("*").eq("id", args.bookingId).single();
      if (error || !booking) throw new Error("Booking not found");
      if (boundCustomerId && booking.customer_id !== boundCustomerId) throw new Error("Not authorized to modify this booking");

      // DB update first — it goes through the exclusion constraint, so a
      // conflicting new time is rejected atomically before Google Calendar
      // is ever touched (previously the calendar event was moved first,
      // so a rejected reschedule left the calendar showing a time the DB
      // never actually accepted).
      const { data: updated, error: updateErr } = await db
        .from("bookings")
        .update({ start_time: args.newStart, end_time: args.newEnd, status: "rescheduled" })
        .eq("id", args.bookingId)
        .select("*")
        .single();

      if (updateErr) {
        if (isExclusionViolation(updateErr)) throw new Error("Teacher already booked in this time range");
        throw new Error(translateDbError(updateErr));
      }

      if (updated.google_event_id) {
        await calendar.updateEvent(updated.google_event_id, { startTime: String(args.newStart), endTime: String(args.newEnd) });
      }
      return updated;
    }

    case "cancel_lesson": {
      const { data: booking, error } = await db.from("bookings").select("*").eq("id", args.bookingId).single();
      if (error || !booking) throw new Error("Booking not found");
      if (boundCustomerId && booking.customer_id !== boundCustomerId) throw new Error("Not authorized to modify this booking");
      if (booking.status === "cancelled") throw new Error("This lesson is already cancelled");

      // Cancelling a paid lesson is exactly the kind of irreversible,
      // money-adjacent action the Owner Prompt already says never to do
      // without explicit confirmation — previously that was only a prompt
      // instruction, not an enforced rule. The AI can no longer cancel a
      // lesson directly; it files a request and a staff member must
      // approve it (see the approvals edge function for the actual
      // cancellation logic, which runs only on approval).
      const { id: approvalId } = await requestApproval(
        db,
        "cancel_paid_lesson",
        { bookingId: booking.id, title: booking.title, customerId: booking.customer_id, startTime: booking.start_time },
        String(args.reason ?? "No reason given")
      );
      return { pendingApproval: true, approvalId, message: "Cancellation request submitted for staff review — the lesson stays booked until approved." };
    }

    case "lookup_customer": {
      if (boundCustomerId) {
        const { data } = await db.from("customers").select("*").eq("id", boundCustomerId).maybeSingle();
        return data;
      }
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
      const customerId = boundCustomerId ?? String(args.customerId ?? "");
      if (!customerId) throw new Error("customerId is required");

      const {
        learningGoal, experienceLevel, preferredSchedule, practiceFrequency, age, budget,
        preferredTeacherId, parentName, parentPhone, leadSource, notes,
      } = args as Record<string, string | number>;
      const patch: Record<string, unknown> = {};
      if (learningGoal) patch.learning_goal = learningGoal;
      if (experienceLevel) patch.experience_level = experienceLevel;
      if (preferredSchedule) patch.preferred_schedule = preferredSchedule;
      if (practiceFrequency) patch.practice_frequency = practiceFrequency;
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
      const customerId = boundCustomerId ?? String(args.customerId ?? "");
      if (!customerId) throw new Error("customerId is required");

      const { data: customer, error: fetchErr } = await db.from("customers").select("sales_status").eq("id", customerId).single();
      if (fetchErr) throw fetchErr;

      // Atomic conditional update -- .eq("sales_status", ...) guards against
      // a concurrent manual UI change landing between the read above and
      // this write, which previously would've been silently overwritten
      // with a stale from_status recorded in history. Update first, then
      // only log history once the update genuinely matched a row, so a
      // lost race never leaves a phantom history entry for a transition
      // that never actually applied.
      const { data: updated, error: updateErr } = await db
        .from("customers")
        .update({ sales_status: args.status })
        .eq("id", customerId)
        .eq("sales_status", customer.sales_status)
        .select("id")
        .maybeSingle();
      if (updateErr) throw updateErr;
      if (!updated) throw new Error("สถานะลูกค้าเพิ่งถูกเปลี่ยนโดยคนอื่นก่อนหน้านี้เสี้ยววินาที กรุณาลองใหม่อีกครั้ง");

      await db.from("sales_status_history").insert({
        customer_id: customerId,
        from_status: customer.sales_status,
        to_status: args.status,
        note: args.note ?? null,
      });

      return { ok: true };
    }

    case "flag_needs_review": {
      await db.from("conversations").update({ needs_review: true }).eq("id", args.conversationId);
      await db.from("notifications").insert({ type: "ai_needs_review", title: "AI escalated a conversation", body: args.reason });
      return { ok: true };
    }

    case "create_payment_link": {
      const customerId = boundCustomerId ?? String(args.customerId ?? "");
      if (!customerId) throw new Error("customerId is required");
      const result = await createPayment(db, {
        customerId,
        amount: args.amount as number,
        courseId: args.courseId ? String(args.courseId) : null,
        note: args.note ? String(args.note) : null,
      });
      return result;
    }

    case "record_attendance_confirmation": {
      const status = String(args.status ?? "");
      if (status !== "confirmed" && status !== "declined") throw new Error("status must be confirmed or declined");
      const bookingId = args.bookingId ? String(args.bookingId) : null;
      const scheduleId = args.scheduleId ? String(args.scheduleId) : null;
      if (!bookingId && !scheduleId) throw new Error("bookingId or scheduleId is required");

      let lessonLabel = "";
      let lessonTime = "";
      let customerId: string | null = null;
      let googleEventId: string | null = null;

      if (bookingId) {
        const { data: booking, error } = await db
          .from("bookings")
          .select("id, customer_id, title, start_time, google_event_id")
          .eq("id", bookingId)
          .maybeSingle();
        if (error || !booking) throw new Error("ไม่พบการจองที่ระบุ");
        if (boundCustomerId && booking.customer_id !== boundCustomerId) throw new Error("ไม่สามารถยืนยันการจองของคนอื่นได้");
        customerId = booking.customer_id;
        lessonLabel = booking.title;
        lessonTime = formatLessonTime(booking.start_time);
        googleEventId = booking.google_event_id;
        const { error: upErr } = await db
          .from("bookings")
          .update({ attendance_status: status, attendance_confirmed_at: new Date().toISOString() })
          .eq("id", booking.id);
        if (upErr) throw upErr;
      } else {
        const { data: schedule, error } = await db
          .from("attendance_reminder_schedules")
          .select("id, customer_id, day_of_week, time_of_day")
          .eq("id", scheduleId)
          .maybeSingle();
        if (error || !schedule) throw new Error("ไม่พบตารางเรียนที่ระบุ");
        if (boundCustomerId && schedule.customer_id !== boundCustomerId) throw new Error("ไม่สามารถยืนยันการเรียนของคนอื่นได้");
        customerId = schedule.customer_id;
        lessonLabel = "คาบเรียนประจำ";
        lessonTime = schedule.time_of_day.slice(0, 5);
        const { error: upErr } = await db
          .from("attendance_reminder_schedules")
          .update({ attendance_status: status, attendance_confirmed_at: new Date().toISOString() })
          .eq("id", schedule.id);
        if (upErr) throw upErr;
      }

      // Mirror onto the Google Calendar event (best-effort — the calendar
      // may be disconnected; the DB row is the source of truth).
      if (googleEventId) {
        calendar.updateAttendanceInCalendar(googleEventId, status).catch(() => {});
      }

      if (status === "declined" && customerId) {
        await db.from("notifications").insert({
          type: "attendance_declined",
          title: "นักเรียนไม่มาเรียน",
          body: `${lessonLabel} (${lessonTime}) — นักเรียนแจ้งว่าไม่สามารถมาเรียนได้`,
          customer_id: customerId,
        });
        const { data: ownerRow } = await db.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
        if (ownerRow?.value) {
          linePush(ownerRow.value, `⚠️ นักเรียนไม่มาเรียน: ${lessonLabel} (${lessonTime})`).catch(() => {});
        }
      }

      return { ok: true, lessonLabel, lessonTime, status };
    }

    case "mark_payment_paid": {
      if (!callerId) throw new Error("Not authorized: no caller identity for this action");
      await requireOwnerOrAdmin(db, callerId);
      const paymentId = String(args.paymentId ?? "");
      if (!paymentId) throw new Error("paymentId is required");
      const result = await confirmPayment(db, { paymentId, confirmedBy: callerId, note: args.note ? String(args.note) : null });
      return { ok: true, payment: result.payment, transaction: result.transaction };
    }

    case "record_lesson_summary": {
      if (!callerId) throw new Error("Not authorized: no caller identity for this action");
      await requireOwnerOrAdmin(db, callerId);
      const bookingId = String(args.bookingId ?? "");
      const notes = String(args.notes ?? "");
      if (!bookingId) throw new Error("bookingId is required");
      const result = await createLessonSummary(db, { bookingId, rawNotes: notes, createdBy: callerId });
      return { ok: true, lessonNoteId: result.id };
    }

    case "create_referral_link": {
      if (!callerId) throw new Error("Not authorized: no caller identity for this action");
      await requireOwnerOrAdmin(db, callerId);
      const customerId = String(args.customerId ?? "");
      if (!customerId) throw new Error("customerId is required");
      const { data: customer, error: custErr } = await db.from("customers").select("id, name, referral_code").eq("id", customerId).maybeSingle();
      if (custErr || !customer) throw new Error("ไม่พบลูกค้าที่ระบุ");
      let code = customer.referral_code;
      if (!code) {
        code = "TIGA" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase();
        const { error: upErr } = await db.from("customers").update({ referral_code: code }).eq("id", customer.id);
        if (upErr) throw upErr;
        await db.from("referrals").insert({ referrer_customer_id: customer.id, referral_code: code });
      }
      await db.from("notifications").insert({
        type: "referral_created",
        title: "สร้างโค้ดรีเฟอรัลแล้ว",
        body: `${customer.name} — โค้ด ${code}`,
        customer_id: customer.id,
      });
      const shareMessage = `🎁 แนะนำเพื่อนมาเรียนที่ Tiga Studio รับส่วนลดพิเศษ! ใช้โค้ด ${code} ตอนสมัคร แล้วแจ้งให้ทีมงานทราบได้เลยค่ะ`;
      return { referralCode: code, shareMessage };
    }

    case "record_transaction": {
      if (!callerId) throw new Error("Not authorized: no caller identity for this action");
      await requireOwnerOrAdmin(db, callerId);

      const type = String(args.type);
      if (type !== "income" && type !== "expense") throw new Error("type must be income or expense");

      // transactions.category is plain text (no DB constraint — the
      // Accounting UI only ever sends values from its own <select>), so
      // this is the only place a mismatched category from a model's
      // hallucinated tool-call argument gets caught before it silently
      // breaks the category breakdown on the Accounting page.
      const validCategories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      const category = String(args.category ?? "");
      if (!validCategories.includes(category)) {
        throw new Error(`category must be one of: ${validCategories.join(", ")}`);
      }

      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount must be a positive number");

      const paymentMethod = args.paymentMethod ? String(args.paymentMethod) : null;
      if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
        throw new Error(`paymentMethod must be one of: ${PAYMENT_METHODS.join(", ")}`);
      }

      const { data, error } = await db
        .from("transactions")
        .insert({
          type,
          category,
          amount,
          description: args.description ? String(args.description) : null,
          transaction_date: args.transactionDate ? String(args.transactionDate) : new Date().toISOString().slice(0, 10),
          payment_method: paymentMethod,
          customer_id: args.customerId ? String(args.customerId) : null,
          course_id: args.courseId ? String(args.courseId) : null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return { transaction: data };
    }

    case "save_knowledge": {
      const title = String(args.title ?? "");
      const sourceType = String(args.sourceType ?? "");
      const content = String(args.content ?? "");
      if (!title || !sourceType || !content) throw new Error("title, sourceType and content are required");

      let documentId = args.documentId ? String(args.documentId) : null;
      if (documentId) {
        const { error: updateErr } = await db
          .from("knowledge_documents")
          .update({ title, source_type: sourceType, raw_text: content })
          .eq("id", documentId);
        if (updateErr) throw updateErr;
        const { error: delErr } = await db.from("knowledge_chunks").delete().eq("document_id", documentId);
        if (delErr) throw delErr;
      } else {
        const { data, error: insertErr } = await db
          .from("knowledge_documents")
          .insert({ title, source_type: sourceType, raw_text: content, created_by: callerId })
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        documentId = data.id;
      }

      const chunks = chunkText(content);
      const EMBED_BATCH_SIZE = 10;
      const embeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        embeddings.push(...(await Promise.all(batch.map((chunk) => embed(chunk)))));
      }
      const { error: chunkErr } = await db
        .from("knowledge_chunks")
        .insert(chunks.map((chunkContent, i) => ({ document_id: documentId, content: chunkContent, embedding: embeddings[i] })));
      if (chunkErr) throw chunkErr;

      return { ok: true, documentId };
    }

    case "get_business_summary": {
      const period = String(args.period ?? "today");
      const days = period === "today" ? 1 : period === "week" ? 7 : 30;
      const start = new Date();
      if (period === "today") start.setHours(0, 0, 0, 0);
      else start.setTime(Date.now() - days * 24 * 60 * 60 * 1000);
      const startISO = start.toISOString();
      const startDateStr = startISO.slice(0, 10);

      const [txResult, lessonsResult, leadsResult, wonResult] = await Promise.all([
        db.from("transactions").select("type, amount").gte("transaction_date", startDateStr),
        db.from("bookings").select("id", { count: "exact", head: true }).gte("start_time", startISO).neq("status", "cancelled"),
        db.from("customers").select("id", { count: "exact", head: true }).gte("created_at", startISO),
        db.from("sales_status_history").select("id", { count: "exact", head: true }).eq("to_status", "won").gte("created_at", startISO),
      ]);
      if (txResult.error) throw txResult.error;
      if (lessonsResult.error) throw lessonsResult.error;
      if (leadsResult.error) throw leadsResult.error;
      if (wonResult.error) throw wonResult.error;

      const { revenue, profit } = sumTransactions(txResult.data ?? []);
      return {
        period,
        revenue,
        profit,
        lessonsCount: lessonsResult.count ?? 0,
        newLeadsCount: leadsResult.count ?? 0,
        wonCount: wonResult.count ?? 0,
      };
    }

    case "list_customers_needing_attention": {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const dayAfterTomorrow = new Date(todayStart);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const inactiveCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [coursesResult, customersResult, bookingsInRangeResult, pendingResult] = await Promise.all([
        db.from("courses").select("id, remaining_hour, total_hours, customer_id, customers(name, sales_status)").gt("remaining_hour", 0).lte("remaining_hour", 3),
        db.from("customers").select("id, name, last_contact_at, created_at, sales_status").not("sales_status", "in", "(won,lost)"),
        db.from("bookings").select("id, title, start_time, customer_id").neq("status", "cancelled").gte("start_time", todayStart.toISOString()).lt("start_time", dayAfterTomorrow.toISOString()),
        db.from("bookings").select("id, title, start_time").eq("status", "pending").order("start_time", { ascending: true }).limit(5),
      ]);
      if (coursesResult.error) throw coursesResult.error;
      if (customersResult.error) throw customersResult.error;
      if (bookingsInRangeResult.error) throw bookingsInRangeResult.error;
      if (pendingResult.error) throw pendingResult.error;

      const renewals = (coursesResult.data ?? [])
        .filter((c) => {
          const customer = (c as { customers?: { sales_status?: string } | null }).customers;
          return !customer?.sales_status || !RENEWAL_ALREADY_HANDLED_STATUSES.includes(customer.sales_status);
        })
        .map((c) => ({
          customerId: c.customer_id,
          customerName: (c as { customers?: { name?: string } | null }).customers?.name ?? "-",
          remainingHour: c.remaining_hour,
          totalHours: c.total_hours,
        }))
        .sort((a, b) => a.remainingHour - b.remainingHour)
        .slice(0, 5);

      const inactiveLeads = (customersResult.data ?? [])
        .map((c) => ({ id: c.id, name: c.name, lastActivityAt: c.last_contact_at ?? c.created_at }))
        .filter((c) => c.lastActivityAt < inactiveCutoff)
        .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? -1 : 1))
        .slice(0, 5);

      const trialCustomerIds = new Set((customersResult.data ?? []).filter((c) => c.sales_status === "trial_booked").map((c) => c.id));
      const trials = (bookingsInRangeResult.data ?? [])
        .filter((b) => trialCustomerIds.has(b.customer_id))
        .map((b) => ({ bookingTitle: b.title, startTime: b.start_time, customerId: b.customer_id }))
        .slice(0, 5);

      const pendingBookings = (pendingResult.data ?? []).map((b) => ({ id: b.id, title: b.title, startTime: b.start_time }));

      return { renewals, inactiveLeads, trials, pendingBookings };
    }

    case "bulk_update_sales_status": {
      if (!callerId) throw new Error("Not authorized: no caller identity for this action");
      await requireOwnerOrAdmin(db, callerId);

      const rawIds = (call.arguments as Record<string, unknown>).customerIds;
      const customerIds = Array.isArray(rawIds) ? rawIds.map(String) : [];
      if (customerIds.length === 0) throw new Error("customerIds must be a non-empty array");
      if (customerIds.length > 50) throw new Error("Bulk update is limited to 50 customers at a time — narrow the request");

      const toStatus = String(args.toStatus ?? "");
      if (!SALES_STATUSES.includes(toStatus)) throw new Error(`toStatus must be one of: ${SALES_STATUSES.join(", ")}`);

      const note = args.note ? String(args.note) : "Bulk status change requested by owner via AI";
      const { id: approvalId } = await requestApproval(db, "bulk_sales_status_change", { customerIds, toStatus }, note);
      return {
        pendingApproval: true,
        approvalId,
        count: customerIds.length,
        message: `ส่งคำขอเปลี่ยนสถานะลูกค้า ${customerIds.length} คนเป็น "${toStatus}" ให้ตรวจสอบก่อนแล้ว — ยังไม่มีผลจนกว่าจะมีคนอนุมัติ`,
      };
    }

    default:
      throw new Error(`Unknown tool: ${call.name}`);
  }
}
