"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Zap, CheckCircle2, Clock, AlertTriangle, DollarSign, Calendar, Loader2 } from "lucide-react";
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
}

interface DailyPrioritiesCardProps {
  onAction: (text: string) => void;
}

const CATEGORY_ICONS: Record<string, typeof TrendingUp> = {
  operational: CheckCircle2,
  sales: DollarSign,
  marketing: Zap,
  finance: TrendingUp,
  content: Zap,
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
  const [summary, setSummary] = useState<{
    pendingApprovals: number;
    activeLeads: number;
    todayLessons: number;
    unscheduledContent: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPriorities() {
      try {
        const db = createClient();

        const today = new Date().toISOString().slice(0, 10);

        const [approvalsRes, leadsRes, lessonsRes, contentRes] = await Promise.all([
          db.from("approvals").select("id").eq("status", "pending").limit(10),
          db
            .from("sales_pipeline")
            .select("id, customer_name")
            .in("status", ["new_lead", "contacted", "interested", "trial_booked"])
            .order("updated_at", { ascending: false })
            .limit(10),
          db
            .from("bookings")
            .select("id")
            .gte("start_time", today + "T00:00:00")
            .lte("start_time", today + "T23:59:59")
            .eq("status", "confirmed"),
          db.from("content_history").select("id").is("scheduled_date", null).limit(5),
        ]);

        if (cancelled) return;

        const pendingCount = (approvalsRes.data ?? []).length;
        const leadCount = (leadsRes.data ?? []).length;
        const lessonCount = (lessonsRes.data ?? []).length;
        const contentCount = (contentRes.data ?? []).length;

        setSummary({
          pendingApprovals: pendingCount,
          activeLeads: leadCount,
          todayLessons: lessonCount,
          unscheduledContent: contentCount,
        });

        const result: Priority[] = [];

        if (pendingCount > 0) {
          result.push({
            rank: result.length + 1,
            task: `อนุมัติ ${pendingCount} รายการที่รออนุมัติ`,
            category: "operational",
            impact: "สูง",
            difficulty: "ง่าย",
            reason: "งานค้างที่รอการตัดสินใจ — ยิ่งเร็วยิ่งดี",
            actionText: "ดูรายการรออนุมัติ",
          });
        }

        if (leadCount > 0) {
          const names = (leadsRes.data ?? [])
            .slice(0, 3)
            .map((l: Record<string, string>) => l.customer_name)
            .join(", ");
          result.push({
            rank: result.length + 1,
            task: `ติดตาม lead ${leadCount} คน: ${names}${leadCount > 3 ? "..." : ""}`,
            category: "sales",
            impact: "สูงมาก",
            difficulty: "กลาง",
            reason: "lead ที่ยังไม่ปิด — ยิ่งติดตามเร็วยิ่งมีโอกาส converting สูง",
            actionText: "ดู Sales Pipeline",
          });
        }

        if (contentCount > 0) {
          result.push({
            rank: result.length + 1,
            task: `วางแผนโพสต์ content ${contentCount} ชิ้นที่สร้างแล้ว`,
            category: "marketing",
            impact: "กลาง",
            difficulty: "ง่าย",
            reason: "content ที่สร้างแล้วแต่ยังไม่ได้โพสต์ — เสียโอกาส",
            actionText: "สร้าง Content Calendar",
          });
        }

        if (result.length < 3) {
          result.push({
            rank: result.length + 1,
            task: "สร้าง content ใหม่ 1 ชิ้นสำหรับสัปดาห์นี้",
            category: "marketing",
            impact: "กลาง",
            difficulty: "ง่าย",
            reason: "content สม่ำเสมอ = lead สม่ำเสมอ",
            actionText: "สร้าง Content",
          });
        }

        if (result.length < 3) {
          result.push({
            rank: result.length + 1,
            task: "ตรวจสอบสรุปการเงินเดือนนี้",
            category: "finance",
            impact: "กลาง",
            difficulty: "ง่าย",
            reason: "รู้ตัวเลข = ตัดสินใจได้ดีกว่า",
            actionText: "ดูการเงิน",
          });
        }

        setPriorities(result.slice(0, 3));
      } catch {
        // Silent fail — card simply won't show
      }
    }

    fetchPriorities();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-line/10 bg-line/5 p-3">
        <div className="flex items-center gap-2 text-xs text-secondary/60">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>กำลังวิเคราะห์งานวันนี้...</span>
        </div>
      </div>
    );
  }

  if (priorities.length === 0) return null;

  const Icon = (priorities[0]?.category ? CATEGORY_ICONS[priorities[0].category] : null) || Zap;

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-line/5">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line/10 px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
          <Icon className="h-3 w-3 text-primary-accent" />
        </div>
        <span className="text-xs font-semibold text-secondary">
          🎯 3 งานสำคัญวันนี้
        </span>
        {summary && (
          <span className="ml-auto text-[10px] text-secondary/40">
            {summary.todayLessons} คาบ · {summary.activeLeads} lead · {summary.pendingApprovals} รออนุมัติ
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
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-line/5"
            >
              {/* Rank Badge */}
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  p.rank === 1
                    ? "bg-amber-500/20 text-amber-400"
                    : p.rank === 2
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-green-500/20 text-green-400"
                )}
              >
                {p.rank}
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
              <span className="shrink-0 text-[10px] text-primary-accent/60">
                →
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
