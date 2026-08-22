"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Zap, CheckCircle2, Clock, DollarSign, Loader2, Users, Calendar, FileText } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { cn } from "@/lib/utils";

interface Priority {
  rank: number;
  task: string;
  category: string;
  impact: string;
  difficulty: string;
  reason: string;
  actionText: string;
  icon: string;
}

interface DailyPrioritiesCardProps {
  onAction: (text: string) => void;
}

const CATEGORY_ICONS: Record<string, typeof TrendingUp> = {
  operational: CheckCircle2,
  sales: DollarSign,
  marketing: Zap,
  finance: TrendingUp,
  content: FileText,
  student: Users,
  calendar: Calendar,
};

const IMPACT_COLORS: Record<string, string> = {
  "สูงมาก": "text-red-400 bg-red-500/10",
  "สูง": "text-amber-400 bg-amber-500/10",
  "กลาง": "text-blue-400 bg-blue-500/10",
  "ต่ำ": "text-green-400 bg-green-500/10",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  "ง่าย": "text-green-400 bg-green-500/10",
  "กลาง": "text-amber-400 bg-amber-500/10",
  "ยาก": "text-red-400 bg-red-500/10",
};

/** Safe query helper — returns data or empty array, never throws */
async function safeQuery(
  db: ReturnType<typeof createClient>,
  table: string,
  select = "*",
  filters?: { col: string; op: string; val: unknown }[],
  opts?: { limit?: number; order?: { col: string; ascending?: boolean } }
): Promise<Record<string, unknown>[]> {
  try {
    let q = db.from(table).select(select);
    if (filters) {
      for (const f of filters) {
        if (f.op === "eq") q = q.eq(f.col, f.val as string);
        else if (f.op === "gt") q = q.gt(f.col, f.val as string);
        else if (f.op === "gte") q = q.gte(f.col, f.val as string);
        else if (f.op === "lte") q = q.lte(f.col, f.val as string);
        else if (f.op === "in") q = q.in(f.col, f.val as string[]);
        else if (f.op === "is" && f.val === null) q = q.is(f.col, null);
      }
    }
    if (opts?.order) q = q.order(opts.order.col, { ascending: opts.order.ascending ?? false });
    if (opts?.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) return [];
    return (data as Record<string, unknown>[]) ?? [];
  } catch {
    return [];
  }
}

function getTodayRange() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return {
    start: `${yyyy}-${mm}-${dd}T00:00:00`,
    end: `${yyyy}-${mm}-${dd}T23:59:59`,
  };
}

function daysSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 86400000;
}

const FALLBACK_PRIORITIES: Priority[] = [
  {
    rank: 1,
    task: "สร้าง content ใหม่ 1 ชิ้นสำหรับสัปดาห์นี้",
    category: "marketing",
    impact: "กลาง",
    difficulty: "ง่าย",
    reason: "content สม่ำเสมอ = lead สม่ำเสมอ",
    actionText: "สร้าง Content ใหม่",
    icon: "✍️",
  },
  {
    rank: 2,
    task: "ตรวจสอบ lead ที่ยังไม่ติดต่อกลับ",
    category: "sales",
    impact: "สูง",
    difficulty: "กลาง",
    reason: "lead ที่เงียบไปมีโอกาสสูงที่จะหายไป",
    actionText: "ดู Sales Pipeline",
    icon: "💰",
  },
  {
    rank: 3,
    task: "ดูสรุปการเงินเดือนนี้",
    category: "finance",
    impact: "กลาง",
    difficulty: "ง่าย",
    reason: "รู้ตัวเลข = ตัดสินใจได้ดีกว่า",
    actionText: "ดูการเงินเดือนนี้",
    icon: "📊",
  },
];

export function DailyPrioritiesCard({ onAction }: DailyPrioritiesCardProps) {
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setLoading(false); }, 3000);

    async function fetchPriorities() {
      const db = createClient();
      const today = getTodayRange();

      // Fire all queries independently — each one fails silently
      const [approvals, leads, bookings, students, payments, content, messages] = await Promise.all([
        safeQuery(db, "approvals", "id, action_type", [{ col: "status", op: "eq", val: "pending" }], { limit: 20 }),
        safeQuery(db, "sales_pipeline", "id, customer_name, status, updated_at", [{ col: "status", op: "in", val: ["new_lead", "contacted", "interested", "trial_booked", "negotiation"] }], { limit: 20, order: { col: "updated_at", ascending: false } }),
        safeQuery(db, "bookings", "id, start_time, status", [{ col: "start_time", op: "gte", val: today.start }, { col: "start_time", op: "lte", val: today.end }], { limit: 20 }),
        safeQuery(db, "students", "id, name, hours_remaining", undefined, { limit: 100 }),
        safeQuery(db, "payments", "id, amount", undefined, { limit: 50 }),
        safeQuery(db, "content_history", "id, title, platform", [{ col: "scheduled_date", op: "is", val: null }], { limit: 10, order: { col: "created_at", ascending: false } }),
        safeQuery(db, "conversations", "id, unread_count", [{ col: "unread_count", op: "gt", val: 0 }], { limit: 20 }),
      ]);

      if (cancelled) return;
      clearTimeout(timer);

      // Compute stats
      const pendingCount = approvals.length;
      const leadCount = leads.length;
      const lessonCount = bookings.length;
      const studentCount = students.length;
      const contentCount = content.length;
      const unreadMsgCount = messages.length;

      const lowHoursStudents = students
        .filter((s) => {
          const h = Number(s.hours_remaining ?? 0);
          return h > 0 && h <= 3;
        })
        .map((s) => String(s.name ?? ""));

      const coldLeads = leads.filter((l) => {
        if (!l.updated_at) return false;
        return daysSince(l.updated_at as string) >= 3;
      });

      // Summary line
      const parts: string[] = [];
      if (lessonCount > 0) parts.push(`${lessonCount} คาบวันนี้`);
      if (leadCount > 0) parts.push(`${leadCount} lead`);
      if (pendingCount > 0) parts.push(`${pendingCount} รออนุมัติ`);
      if (unreadMsgCount > 0) parts.push(`${unreadMsgCount} ข้อความ`);
      if (lowHoursStudents.length > 0) parts.push(`${lowHoursStudents.length} คนใกล้หมดชั่วโมง`);
      setSummary(parts.join(" · ") || "ข้อมูลปกติ ไม่มีอะไรเร่งด่วน");

      // Build priority list — sorted by BUSINESS VALUE (high → low, easy → hard)
      const result: Priority[] = [];

      // 1. LEADS — highest value
      if (leadCount > 0) {
        const coldCount = coldLeads.length;
        const names = leads.slice(0, 3).map((l) => String(l.customer_name ?? "")).join(", ");
        result.push({
          rank: 1,
          task: coldCount > 0
            ? `ติดตาม lead ${coldCount} คนที่เงียบไป 3+ วัน: ${names}${leadCount > 3 ? "..." : ""}`
            : `ติดตาม lead ${leadCount} คน: ${names}${leadCount > 3 ? "..." : ""}`,
          category: "sales",
          impact: "สูงมาก",
          difficulty: "กลาง",
          reason: coldCount > 0 ? "lead ที่เงียบไปยิ่งนานยิ่งเสีย" : "lead ที่ยังไม่ปิด — ยิ่งติดตามเร็วยิ่งดี",
          actionText: "ดู Sales Pipeline ทั้งหมด",
          icon: "💰",
        });
      }

      // 2. STUDENTS NEARLY OUT OF HOURS
      if (lowHoursStudents.length > 0) {
        result.push({
          rank: result.length + 1,
          task: `ต่ออายุนักเรียน ${lowHoursStudents.length} คน: ${lowHoursStudents.slice(0, 3).join(", ")}${lowHoursStudents.length > 3 ? "..." : ""}`,
          category: "student",
          impact: "สูงมาก",
          difficulty: "ง่าย",
          reason: "นักเรียนใกล้หมดชั่วโมง — ถ้าไม่ต่ออายุจะเสียลูกค้า",
          actionText: "ดูนักเรียนทั้งหมด",
          icon: "👥",
        });
      }

      // 3. PENDING APPROVALS
      if (pendingCount > 0) {
        result.push({
          rank: result.length + 1,
          task: `อนุมัติ ${pendingCount} รายการที่รออนุมัติ`,
          category: "operational",
          impact: "สูง",
          difficulty: "ง่าย",
          reason: "งานค้างที่รอการตัดสินใจ — ทำเสร็จใน 1 นาที",
          actionText: "ดูรายการรออนุมัติ",
          icon: "✅",
        });
      }

      // 4. UNREAD MESSAGES
      if (unreadMsgCount > 0) {
        result.push({
          rank: result.length + 1,
          task: `ตอบข้อความ ${unreadMsgCount} รายการที่ยังไม่อ่าน`,
          category: "operational",
          impact: "สูง",
          difficulty: "ง่าย",
          reason: "ลูกค้ารอคำตอบ — ยิ่งเร็วยิ่งประทับใจ",
          actionText: "ดูข้อความทั้งหมด",
          icon: "💬",
        });
      }

      // 5. TODAY'S LESSONS
      if (lessonCount > 0) {
        result.push({
          rank: result.length + 1,
          task: `วันนี้มี ${lessonCount} คาบเรียน`,
          category: "calendar",
          impact: "กลาง",
          difficulty: "ง่าย",
          reason: "ยืนยันการมาเรียนหลังสอนเสร็จทุกคาบ",
          actionText: "ดูคาบเรียนวันนี้",
          icon: "📅",
        });
      }

      // 6. UNSCHEDULED CONTENT
      if (contentCount > 0) {
        result.push({
          rank: result.length + 1,
          task: `วางแผนโพสต์ content ${contentCount} ชิ้น`,
          category: "marketing",
          impact: "กลาง",
          difficulty: "ง่าย",
          reason: "content ที่สร้างแล้วยังไม่ได้โพสต์ — เสียโอกาส",
          actionText: "สร้าง Content Calendar",
          icon: "📝",
        });
      }

      // Fill up to 3 if needed
      while (result.length < 3) {
        const idx = result.length;
        if (idx === 0) {
          result.push({ rank: 1, task: "สร้าง content ใหม่ 1 ชิ้นสำหรับสัปดาห์นี้", category: "marketing", impact: "กลาง", difficulty: "ง่าย", reason: "content สม่ำเสมอ = lead สม่ำเสมอ", actionText: "สร้าง Content ใหม่", icon: "✍️" });
        } else if (idx === 1) {
          result.push({ rank: 2, task: "ตรวจสอบ lead ที่ยังไม่ติดต่อกลับ", category: "sales", impact: "สูง", difficulty: "กลาง", reason: "lead ที่เงียบไปมีโอกาสสูงที่จะหายไป", actionText: "ดู Sales Pipeline", icon: "💰" });
        } else {
          result.push({ rank: 3, task: "ดูสรุปการเงินเดือนนี้", category: "finance", impact: "กลาง", difficulty: "ง่าย", reason: "รู้ตัวเลข = ตัดสินใจได้ดีกว่า", actionText: "ดูการเงินเดือนนี้", icon: "📊" });
        }
      }

      setPriorities(result.slice(0, 3));
      setLoading(false);
    }

    fetchPriorities();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-line/10 bg-line/5 p-3">
        <div className="flex items-center gap-2 text-xs text-secondary/60">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>กำลังวิเคราะห์ข้อมูล...</span>
        </div>
      </div>
    );
  }

  // ALWAYS show the card — use fallback if needed
  const items = priorities.length > 0 ? priorities : FALLBACK_PRIORITIES;

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-line/5">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line/10 px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
          <TrendingUp className="h-3 w-3 text-primary-accent" />
        </div>
        <span className="text-xs font-semibold text-secondary">
          🎯 งานสำคัญวันนี้
        </span>
        {summary && (
          <span className="ml-auto max-w-[40%] truncate text-[10px] text-secondary/40">
            {summary}
          </span>
        )}
      </div>

      {/* Priority Items */}
      <div className="divide-y divide-line/5">
        {items.map((p) => {
          const PIcon = CATEGORY_ICONS[p.category] || Zap;
          return (
            <button
              key={p.rank}
              onClick={() => onAction(p.actionText)}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-line/5 active:bg-line/10"
            >
              {/* Icon + Rank */}
              <div className="flex shrink-0 flex-col items-center gap-0.5">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-sm",
                    p.rank === 1
                      ? "bg-amber-500/20"
                      : p.rank === 2
                        ? "bg-blue-500/20"
                        : "bg-green-500/20"
                  )}
                >
                  {p.icon}
                </div>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-secondary leading-tight">
                  {p.task}
                </p>
                <p className="mt-0.5 text-[10px] text-secondary/50 leading-tight">
                  {p.reason}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                      IMPACT_COLORS[p.impact] || "text-secondary/60 bg-line/10"
                    )}
                  >
                    {p.impact === "สูงมาก" || p.impact === "สูง" ? (
                      <TrendingUp className="mr-0.5 h-2 w-2" />
                    ) : (
                      <Clock className="mr-0.5 h-2 w-2" />
                    )}
                    คุณค่า: {p.impact}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                      DIFFICULTY_COLORS[p.difficulty] || "text-secondary/60 bg-line/10"
                    )}
                  >
                    {p.difficulty === "ง่าย" ? "⚡" : p.difficulty === "ยาก" ? "🔥" : "💪"}
                    {" "}{p.difficulty}
                  </span>
                </div>
              </div>

              {/* Action Arrow */}
              <span className="shrink-0 self-center text-[10px] text-primary-accent/60">
                →
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
