"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Zap, CheckCircle2, Clock, DollarSign, Loader2, AlertTriangle, Users, Calendar, FileText } from "lucide-react";
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

export function DailyPrioritiesCard({ onAction }: DailyPrioritiesCardProps) {
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function fetchPriorities() {
      try {
        const db = createClient();
        const today = new Date().toISOString().slice(0, 10);
        const todayStart = today + "T00:00:00";
        const todayEnd = today + "T23:59:59";
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

        // Fetch ALL relevant data in parallel
        const [
          approvalsRes,
          leadsRes,
          lessonsRes,
          contentRes,
          studentsRes,
          revenueRes,
          bookingsRes,
          messagesRes,
        ] = await Promise.all([
          // Pending approvals
          db.from("approvals").select("id, action_type, action_payload").eq("status", "pending").limit(20),
          // Active leads in pipeline
          db.from("sales_pipeline").select("id, customer_name, status, updated_at, value")
            .in("status", ["new_lead", "contacted", "interested", "trial_booked", "negotiation"])
            .order("updated_at", { ascending: false }).limit(20),
          // Today's lessons
          db.from("bookings").select("id, start_time, status")
            .gte("start_time", todayStart).lte("start_time", todayEnd) as any,
          // Unposted content
          db.from("content_history").select("id, title, platform, created_at")
            .is("scheduled_date", null).order("created_at", { ascending: false }).limit(10),
          // Total students
          db.from("students").select("id, name, hours_remaining").limit(100),
          // Revenue this month
          db.from("payments").select("id, amount")
            .limit(50) as any,
          // Upcoming bookings this week
          db.from("bookings").select("id, start_time, status")
            .gte("start_time", todayStart).lte("start_time", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) + "T23:59:59") as any,
          // Unread messages
          db.from("conversations").select("id, last_message, last_message_at, unread_count")
            .gt("unread_count", 0).limit(20),
        ]);

        if (cancelled) return;

        const pendingCount = (approvalsRes.data ?? []).length;
        const leadCount = (leadsRes.data ?? []).length;
        const lessonCount = (lessonsRes.data ?? []).length;
        const contentCount = (contentRes.data ?? []).length;
        const studentCount = (studentsRes.data ?? []).length;
        const weekBookingsCount = (bookingsRes.data ?? []).length;
        const unreadMsgCount = (messagesRes.data ?? []).length;          const totalRevenue = (revenueRes.data ?? []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

        // Students with low hours
        const lowHoursStudents = (studentsRes.data ?? [])
          .filter((s: Record<string, unknown>) => Number(s.hours_remaining) <= 3 && Number(s.hours_remaining) > 0)
          .map((s: Record<string, string>) => s.name);

        // Leads that went cold (not updated in 3+ days)
        const coldLeads = (leadsRes.data ?? []).filter((l: Record<string, unknown>) => {
          if (!l.updated_at) return false;
          const daysSince = (Date.now() - new Date(l.updated_at as string).getTime()) / 86400000;
          return daysSince >= 3;
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

        // 1. LEADS — highest value (direct revenue)
        if (leadCount > 0) {
          const coldCount = coldLeads.length;
          const names = (leadsRes.data ?? [])
            .slice(0, 3)
            .map((l: Record<string, string>) => l.customer_name)
            .join(", ");
          result.push({
            rank: result.length + 1,
            task: coldCount > 0
              ? `ติดตาม lead ${coldCount} คนที่เงียบไป 3+ วัน: ${names}${leadCount > 3 ? "..." : ""}`
              : `ติดตาม lead ${leadCount} คน: ${names}${leadCount > 3 ? "..." : ""}`,
            category: "sales",
            impact: "สูงมาก",
            difficulty: "กลาง",
            reason: coldCount > 0
              ? "lead ที่เงียบไปยิ่งนานยิ่งเสีย — ยิ่งติดตามเร็วยิ่งมีโอกาส converting สูง"
              : "lead ที่ยังไม่ปิด — ยิ่งติดตามเร็วยิ่งดี",
            actionText: "ดู Sales Pipeline ทั้งหมด",
            icon: "💰",
          });
        }

        // 2. STUDENTS NEARLY OUT OF HOURS — retention risk
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

        // 3. PENDING APPROVALS — quick win
        if (pendingCount > 0) {
          const types = (approvalsRes.data ?? [])
            .slice(0, 3)
            .map((a: Record<string, string>) => a.action_type || "action")
            .join(", ");
          result.push({
            rank: result.length + 1,
            task: `อนุมัติ ${pendingCount} รายการ (${types})`,
            category: "operational",
            impact: "สูง",
            difficulty: "ง่าย",
            reason: "งานค้างที่รอการตัดสินใจ — ทำเสร็จใน 1 นาที แต่ค้างมาหลายวัน",
            actionText: "ดูรายการรออนุมัติ",
            icon: "✅",
          });
        }

        // 4. UNREAD MESSAGES — response speed matters
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

        // 5. TODAY'S LESSONS — check attendance
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

        // 6. UNSCHEDULED CONTENT — marketing opportunity
        if (contentCount > 0) {
          const titles = (contentRes.data ?? [])
            .slice(0, 3)
            .map((c: Record<string, string>) => c.title || c.platform)
            .filter(Boolean)
            .join(", ");
          result.push({
            rank: result.length + 1,
            task: `วางแผนโพสต์ content ${contentCount} ชิ้น (${titles}${contentCount > 3 ? "..." : ""})`,
            category: "marketing",
            impact: "กลาง",
            difficulty: "ง่าย",
            reason: "content ที่สร้างแล้วยังไม่ได้โพสต์ — เสียโอกาส",
            actionText: "สร้าง Content Calendar",
            icon: "📝",
          });
        }

        // 7. REVENUE CHECK — always valuable
        if (totalRevenue === 0 && lessonCount > 0) {
          result.push({
            rank: result.length + 1,
            task: "บันทึกรายรับวันนี้ — ยังไม่มีการบันทึกในระบบ",
            category: "finance",
            impact: "สูง",
            difficulty: "ง่าย",
            reason: "มีคาบเรียนแต่ไม่มีรายรับบันทึก — ต้องตรวจสอบ",
            actionText: "บันทึกรายรับ",
            icon: "💰",
          });
        }

        // Fill up to 3 if needed
        if (result.length < 3) {
          result.push({
            rank: result.length + 1,
            task: "สร้าง content ใหม่ 1 ชิ้นสำหรับสัปดาห์นี้",
            category: "marketing",
            impact: "กลาง",
            difficulty: "ง่าย",
            reason: "content สม่ำเสมอ = lead สม่ำเสมอ",
            actionText: "สร้าง Content ใหม่",
            icon: "✍️",
          });
        }

        if (result.length < 3) {
          result.push({
            rank: result.length + 1,
            task: "วางแผนสร้าง content สำหรับ 7 วันข้างหน้า",
            category: "content",
            impact: "กลาง",
            difficulty: "กลาง",
            reason: "มีแผน = ไม่ต้องนึกทุกวัน = สม่ำเสมอ",
            actionText: "วางแผน Content สัปดาห์นี้",
            icon: "📋",
          });
        }

        setPriorities(result.slice(0, 3));
      } catch {
        // Silent fail — show fallback priorities
        setPriorities([
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
        ]);
      }
      setLoading(false);
    }

    fetchPriorities();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-line/10 bg-line/5 p-3">
        <div className="flex items-center gap-2 text-xs text-secondary/60">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>กำลังวิเคราะห์ข้อมูลทั้งระบบ...</span>
        </div>
      </div>
    );
  }

  if (priorities.length === 0) return null;

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
        {priorities.map((p) => {
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
