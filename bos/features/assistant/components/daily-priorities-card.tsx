"use client";

import { TrendingUp, Zap, CheckCircle2, Clock, DollarSign, Users, Calendar, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT, useLang } from "@/lib/language-context";
import { tfmt, type Lang } from "@/lib/i18n";

interface Priority {
  rank: number;
  task: { th: string; en: string };
  category: string;
  impact: "veryHigh" | "high" | "mid" | "low";
  difficulty: "easy" | "mid" | "hard";
  reason: { th: string; en: string };
  /** Command payload sent to the AI backend — kept Thai; backend prompts are Thai-oriented. */
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

const IMPACT_STYLE: Record<Priority["impact"], { cls: string; key: "prio.impactVeryHigh" | "prio.impactHigh" | "prio.impactMid" | "prio.impactLow" }> = {
  veryHigh: { cls: "text-red-400 bg-red-500/10", key: "prio.impactVeryHigh" },
  high: { cls: "text-amber-400 bg-amber-500/10", key: "prio.impactHigh" },
  mid: { cls: "text-blue-400 bg-blue-500/10", key: "prio.impactMid" },
  low: { cls: "text-green-400 bg-green-500/10", key: "prio.impactLow" },
};

const DIFFICULTY_STYLE: Record<Priority["difficulty"], { cls: string; key: "prio.diffEasy" | "prio.diffMid" | "prio.diffHard"; icon: string }> = {
  easy: { cls: "text-green-400 bg-green-500/10", key: "prio.diffEasy", icon: "⚡" },
  mid: { cls: "text-amber-400 bg-amber-500/10", key: "prio.diffMid", icon: "💪" },
  hard: { cls: "text-red-400 bg-red-500/10", key: "prio.diffHard", icon: "🔥" },
};

/** Time-based smart priorities — changes based on hour of day */
function getSmartPriorities(): Priority[] {
  const hour = new Date().getHours();

  // Morning (6-11): Focus on planning & follow-ups
  if (hour >= 6 && hour < 12) {
    return [
      {
        rank: 1,
        task: { th: "ติดตาม lead ที่ยังไม่ติดต่อกลับ", en: "Follow up with uncontacted leads" },
        category: "sales",
        impact: "veryHigh",
        difficulty: "mid",
        reason: { th: "เช้าเป็นเวลาที่ดีที่สุดในการ follow up — คนพร้อมรับสาย", en: "Mornings are best for follow-ups — people pick up" },
        actionText: "มี lead คนไหนที่ควรติดตามตอนนี้บ้าง",
        icon: "💰",
      },
      {
        rank: 2,
        task: { th: "วางแผน content สัปดาห์นี้", en: "Plan this week's content" },
        category: "marketing",
        impact: "high",
        difficulty: "easy",
        reason: { th: "วางแผนเช้า = มีเวลาสร้างตลอดวัน", en: "Plan early = all day to create" },
        actionText: "สร้าง Content ใหม่",
        icon: "📝",
      },
      {
        rank: 3,
        task: { th: "ดูคาบเรียนวันนี้และเตรียมตัว", en: "Review today's lessons and prep" },
        category: "calendar",
        impact: "mid",
        difficulty: "easy",
        reason: { th: "เตรียมตัวก่อนสอน = สอนได้ดีขึ้น", en: "Prepping before class = better teaching" },
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
        task: { th: "ยืนยันคาบเรียนช่วงเย็น", en: "Confirm this evening's lessons" },
        category: "calendar",
        impact: "veryHigh",
        difficulty: "easy",
        reason: { th: "นักเรียนอาจลืม — ยืนยันก่อน 1 ชม. ลด cancel ได้", en: "Students forget — confirming 1h ahead cuts cancellations" },
        actionText: "ดูคาบเรียนวันนี้มีอะไรบ้าง",
        icon: "📅",
      },
      {
        rank: 2,
        task: { th: "สร้าง content ใหม่ 1 ชิ้น", en: "Create one new content piece" },
        category: "marketing",
        impact: "high",
        difficulty: "easy",
        reason: { th: "โพสต์บ่ายแก่ๆ คนเข้าถึงสูง", en: "Afternoon posts reach the most people" },
        actionText: "สร้าง Content ใหม่",
        icon: "✍️",
      },
      {
        rank: 3,
        task: { th: "ตรวจสอบ lead ที่รอการตอบ", en: "Check leads awaiting a reply" },
        category: "sales",
        impact: "high",
        difficulty: "mid",
        reason: { th: "ตอบเร็ว = ปิดการขายเร็ว", en: "Fast replies close sales faster" },
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
        task: { th: "สรุปคาบเรียนวันนี้", en: "Summarize today's lessons" },
        category: "operational",
        impact: "high",
        difficulty: "easy",
        reason: { th: "บันทึกทันทีหลังสอน — ข้อมูลไม่ตกหล่น", en: "Log right after class — nothing slips" },
        actionText: "สรุปภาพรวมธุรกิจวันนี้ให้หน่อย",
        icon: "✅",
      },
      {
        rank: 2,
        task: { th: "วางแผน content พรุ่งนี้", en: "Plan tomorrow's content" },
        category: "marketing",
        impact: "high",
        difficulty: "easy",
        reason: { th: "วางแผนตอนกลางคืน = พร้อมลุยเช้า", en: "Plan at night = ready to go in the morning" },
        actionText: "สร้าง Content ใหม่",
        icon: "📝",
      },
      {
        rank: 3,
        task: { th: "ดูสรุปการเงินสัปดาห์นี้", en: "Review this week's finances" },
        category: "finance",
        impact: "mid",
        difficulty: "easy",
        reason: { th: "รู้ตัวเลข = ตัดสินใจได้ดีกว่า", en: "Know the numbers = decide better" },
        actionText: "ดูสรุปการเงินเดือนนี้หน่อย",
        icon: "📊",
      },
    ];
  }

  // Late night / early morning (22-6): General tasks
  return [
    {
      rank: 1,
      task: { th: "สร้าง content ใหม่ 1 ชิ้นสำหรับสัปดาห์นี้", en: "Create one new piece for this week" },
      category: "marketing",
      impact: "mid",
      difficulty: "easy",
      reason: { th: "content สม่ำเสมอ = lead สม่ำเสมอ", en: "Consistent content = consistent leads" },
      actionText: "สร้าง Content ใหม่",
      icon: "✍️",
    },
    {
      rank: 2,
      task: { th: "ตรวจสอบ lead ที่ยังไม่ติดต่อกลับ", en: "Check uncontacted leads" },
      category: "sales",
      impact: "high",
      difficulty: "mid",
      reason: { th: "lead ที่เงียบไปมีโอกาสสูงที่จะหายไป", en: "Quiet leads are likely to slip away" },
      actionText: "มี lead คนไหนที่ควรติดตามตอนนี้บ้าง",
      icon: "💰",
    },
    {
      rank: 3,
      task: { th: "ดูสรุปการเงินเดือนนี้", en: "Review this month's finances" },
      category: "finance",
      impact: "mid",
      difficulty: "easy",
      reason: { th: "รู้ตัวเลข = ตัดสินใจได้ดีกว่า", en: "Know the numbers = decide better" },
      actionText: "ดูสรุปการเงินเดือนนี้หน่อย",
      icon: "📊",
    },
  ];
}

function pick(text: { th: string; en: string }, lang: Lang): string {
  return text[lang] ?? text.en;
}

export function DailyPrioritiesCard({ onAction }: DailyPrioritiesCardProps) {
  const t = useT();
  const { lang } = useLang();
  // Render immediately — no loading, no Supabase
  const priorities = getSmartPriorities();

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-line/5">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line/10 px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
          <TrendingUp className="h-3 w-3 text-primary-accent" />
        </div>
        <span className="text-xs font-semibold text-secondary">{t("prio.title")}</span>
        <span className="ml-auto max-w-[40%] truncate text-[10px] text-secondary/40">{t("prio.byValue")}</span>
      </div>

      {/* Priority Items */}
      <div className="divide-y divide-line/5">
        {priorities.map((p) => {
          const PIcon = CATEGORY_ICONS[p.category] || Zap;
          const impact = IMPACT_STYLE[p.impact];
          const difficulty = DIFFICULTY_STYLE[p.difficulty];
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
                    p.rank === 1 ? "bg-amber-500/20" : p.rank === 2 ? "bg-blue-500/20" : "bg-green-500/20"
                  )}
                >
                  {p.icon}
                </div>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-secondary leading-tight">{pick(p.task, lang)}</p>
                <p className="mt-0.5 text-[10px] text-secondary/50 leading-tight">{pick(p.reason, lang)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium", impact.cls)}>
                    {p.impact === "veryHigh" || p.impact === "high" ? (
                      <TrendingUp className="mr-0.5 h-2 w-2" />
                    ) : (
                      <Clock className="mr-0.5 h-2 w-2" />
                    )}
                    {tfmt(lang, "prio.impactLabel", { v: t(impact.key) })}
                  </span>
                  <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium", difficulty.cls)}>
                    {difficulty.icon} {t(difficulty.key)}
                  </span>
                </div>
              </div>

              {/* Action Arrow */}
              <span className="shrink-0 self-center text-[10px] text-primary-accent/60">→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
