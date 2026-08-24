"use client";

import { TrendingUp, Zap, CheckCircle2, Clock, DollarSign, Users, Calendar, FileText } from "lucide-react";
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

/** Time-based smart priorities — changes based on hour of day */
function getSmartPriorities(): Priority[] {
  const hour = new Date().getHours();

  // Morning (6-11): Focus on planning & follow-ups
  if (hour >= 6 && hour < 12) {
    return [
      {
        rank: 1,
        task: "ติดตาม lead ที่ยังไม่ติดต่อกลับ",
        category: "sales",
        impact: "สูงมาก",
        difficulty: "กลาง",
        reason: "เช้าเป็นเวลาที่ดีที่สุดในการ follow up — คนพร้อมรับสาย",
        actionText: "มี lead คนไหนที่ควรติดตามตอนนี้บ้าง",
        icon: "💰",
      },
      {
        rank: 2,
        task: "วางแผน content สัปดาห์นี้",
        category: "marketing",
        impact: "สูง",
        difficulty: "ง่าย",
        reason: "วางแผนเช้า = มีเวลาสร้างตลอดวัน",
        actionText: "สร้าง Content ใหม่",
        icon: "📝",
      },
      {
        rank: 3,
        task: "ดูคาบเรียนวันนี้และเตรียมตัว",
        category: "calendar",
        impact: "กลาง",
        difficulty: "ง่าย",
        reason: "เตรียมตัวก่อนสอน = สอนได้ดีขึ้น",
        actionText: "ดูคาบเรียนวันนี้มีอะไรบ้าง",
        icon: "📅",
      },
    ];
  }

  // Afternoon (12-17): Focus on execution & students
  if (hour >= 12 && hour < 17) {
    return [
      {
        rank: 1,
        task: "ยืนยันคาบเรียนช่วงเย็น",
        category: "calendar",
        impact: "สูงมาก",
        difficulty: "ง่าย",
        reason: "นักเรียนอาจลืม — ยืนยันก่อน 1 ชม. ลด cancel ได้",
        actionText: "ดูคาบเรียนวันนี้มีอะไรบ้าง",
        icon: "📅",
      },
      {
        rank: 2,
        task: "สร้าง content ใหม่ 1 ชิ้น",
        category: "marketing",
        impact: "สูง",
        difficulty: "ง่าย",
        reason: "โพสต์บ่ายแก่ๆ คนเข้าถึงสูง",
        actionText: "สร้าง Content ใหม่",
        icon: "✍️",
      },
      {
        rank: 3,
        task: "ตรวจสอบ lead ที่รอการตอบ",
        category: "sales",
        impact: "สูง",
        difficulty: "กลาง",
        reason: "ตอบเร็ว = ปิดการขายเร็ว",
        actionText: "มี lead คนไหนที่ควรติดตามตอนนี้บ้าง",
        icon: "💰",
      },
    ];
  }

  // Evening (17-22): Focus on review & marketing
  if (hour >= 17 && hour < 22) {
    return [
      {
        rank: 1,
        task: "สรุปคาบเรียนวันนี้",
        category: "operational",
        impact: "สูง",
        difficulty: "ง่าย",
        reason: "บันทึกทันทีหลังสอน — ข้อมูลไม่ตกหล่น",
        actionText: "สรุปภาพรวมธุรกิจวันนี้ให้หน่อย",
        icon: "✅",
      },
      {
        rank: 2,
        task: "วางแผน content พรุ่งนี้",
        category: "marketing",
        impact: "สูง",
        difficulty: "ง่าย",
        reason: "วางแผนตอนกลางคืน = พร้อมลุยเช้า",
        actionText: "สร้าง Content ใหม่",
        icon: "📝",
      },
      {
        rank: 3,
        task: "ดูสรุปการเงินสัปดาห์นี้",
        category: "finance",
        impact: "กลาง",
        difficulty: "ง่าย",
        reason: "รู้ตัวเลข = ตัดสินใจได้ดีกว่า",
        actionText: "ดูสรุปการเงินเดือนนี้หน่อย",
        icon: "📊",
      },
    ];
  }

  // Late night / early morning (22-6): General tasks
  return [
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
      actionText: "มี lead คนไหนที่ควรติดตามตอนนี้บ้าง",
      icon: "💰",
    },
    {
      rank: 3,
      task: "ดูสรุปการเงินเดือนนี้",
      category: "finance",
      impact: "กลาง",
      difficulty: "ง่าย",
      reason: "รู้ตัวเลข = ตัดสินใจได้ดีกว่า",
      actionText: "ดูสรุปการเงินเดือนนี้หน่อย",
      icon: "📊",
    },
  ];
}

export function DailyPrioritiesCard({ onAction }: DailyPrioritiesCardProps) {
  // Render immediately — no loading, no Supabase
  const priorities = getSmartPriorities();

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
        <span className="ml-auto max-w-[40%] truncate text-[10px] text-secondary/40">
          เรียงตามคุณค่า
        </span>
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
