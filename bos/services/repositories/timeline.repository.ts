import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TimelineEntryType =
  | "booking"
  | "transaction"
  | "message"
  | "sales_status"
  | "notification"
  | "task"
  | "receipt"
  | "automation";

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  timestamp: string;
  title: string;
  detail?: string;
}

const PER_CATEGORY_LIMIT = 25;

// One customer -> every interaction/transaction/course/communication/
// automation event that touched them, newest first. Each category is its
// own small query (this codebase never uses embedded-join selects — see
// automation.repository.ts for why) rather than one giant SQL view, then
// merged and sorted here. Capped per category so one very old, very active
// customer can't make this page fetch thousands of rows.
export class TimelineRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getTimeline(customerId: string): Promise<TimelineEntry[]> {
    const [bookings, transactions, conversations, salesHistory, notifications, tasks, receipts, automationRuns] = await Promise.all([
      this.db
        .from("bookings")
        .select("id, title, status, start_time, lesson_type")
        .eq("customer_id", customerId)
        .order("start_time", { ascending: false })
        .limit(PER_CATEGORY_LIMIT),
      this.db
        .from("transactions")
        .select("id, type, category, amount, transaction_date, description")
        .eq("customer_id", customerId)
        .order("transaction_date", { ascending: false })
        .limit(PER_CATEGORY_LIMIT),
      this.db.from("conversations").select("id").eq("customer_id", customerId),
      this.db
        .from("sales_status_history")
        .select("id, from_status, to_status, note, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(PER_CATEGORY_LIMIT),
      this.db
        .from("notifications")
        .select("id, type, title, body, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(PER_CATEGORY_LIMIT),
      this.db.from("tasks").select("id, title, status, due_at, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(PER_CATEGORY_LIMIT),
      this.db
        .from("receipts")
        .select("id, receipt_number, amount, issued_at")
        .eq("customer_id", customerId)
        .order("issued_at", { ascending: false })
        .limit(PER_CATEGORY_LIMIT),
      this.db
        .from("automation_runs")
        .select("id, status, started_at, entity_type")
        .eq("entity_type", "customer")
        .eq("entity_id", customerId)
        .order("started_at", { ascending: false })
        .limit(PER_CATEGORY_LIMIT),
    ]);

    const conversationIds = (conversations.data ?? []).map((c) => c.id);
    const messages =
      conversationIds.length === 0
        ? { data: [] }
        : await this.db
            .from("messages")
            .select("id, sender, content, created_at")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false })
            .limit(PER_CATEGORY_LIMIT);

    const entries: TimelineEntry[] = [];

    for (const b of bookings.data ?? []) {
      entries.push({
        id: `booking-${b.id}`,
        type: "booking",
        timestamp: b.start_time,
        title: `คาบเรียน: ${b.title}`,
        detail: `${b.lesson_type === "final" ? "คาบสุดท้าย" : "คาบปกติ"} — ${b.status}`,
      });
    }

    for (const t of transactions.data ?? []) {
      entries.push({
        id: `transaction-${t.id}`,
        type: "transaction",
        timestamp: t.transaction_date,
        title: `${t.type === "income" ? "รายรับ" : "รายจ่าย"}: ${t.category}`,
        detail: `฿${t.amount.toLocaleString("th-TH")}${t.description ? ` — ${t.description}` : ""}`,
      });
    }

    for (const m of (messages as { data: { id: string; sender: string; content: string; created_at: string }[] | null }).data ?? []) {
      entries.push({
        id: `message-${m.id}`,
        type: "message",
        timestamp: m.created_at,
        title: m.sender === "customer" ? "ลูกค้าส่งข้อความ" : m.sender === "ai" ? "AI ตอบกลับ" : "พนักงานส่งข้อความ",
        detail: m.content.slice(0, 200),
      });
    }

    for (const h of salesHistory.data ?? []) {
      entries.push({
        id: `sales-${h.id}`,
        type: "sales_status",
        timestamp: h.created_at,
        title: `เปลี่ยนสถานะขาย: ${h.from_status ? `${h.from_status} → ` : ""}${h.to_status}`,
        detail: h.note ?? undefined,
      });
    }

    for (const n of notifications.data ?? []) {
      entries.push({ id: `notification-${n.id}`, type: "notification", timestamp: n.created_at, title: n.title, detail: n.body ?? undefined });
    }

    for (const task of tasks.data ?? []) {
      entries.push({
        id: `task-${task.id}`,
        type: "task",
        timestamp: task.created_at,
        title: `งานติดตาม: ${task.title}`,
        detail: `สถานะ ${task.status}${task.due_at ? ` — กำหนด ${new Date(task.due_at).toLocaleDateString("th-TH")}` : ""}`,
      });
    }

    for (const r of receipts.data ?? []) {
      entries.push({ id: `receipt-${r.id}`, type: "receipt", timestamp: r.issued_at, title: `ใบเสร็จ ${r.receipt_number}`, detail: `฿${r.amount.toLocaleString("th-TH")}` });
    }

    for (const run of automationRuns.data ?? []) {
      entries.push({
        id: `automation-${run.id}`,
        type: "automation",
        timestamp: run.started_at,
        title: `ระบบอัตโนมัติทำงาน (${run.status === "success" ? "สำเร็จ" : run.status === "failed" ? "ล้มเหลว" : "ข้าม"})`,
      });
    }

    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
