import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricTone = "purple" | "blue" | "green" | "orange";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: MetricTone;
  /** Small caption under the value (e.g. "↑ 12% from last month"). */
  subtext?: string;
  /** Green when true, red/orange when false. */
  subtextPositive?: boolean;
  href?: string;
}

const TONE_STYLE: Record<MetricTone, { icon: string; stroke: string; points: string }> = {
  purple: {
    icon: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    stroke: "#a855f7",
    points: "0,30 14,26 28,28 42,20 56,23 70,14 84,17 98,9 112,12 120,5",
  },
  blue: {
    icon: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    stroke: "#3b82f6",
    points: "0,28 14,30 28,22 42,25 56,16 70,19 84,10 98,14 112,7 120,9",
  },
  green: {
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    stroke: "#22c55e",
    points: "0,32 14,24 28,27 42,18 56,21 70,12 84,15 98,8 112,10 120,4",
  },
  orange: {
    icon: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    stroke: "#f97316",
    points: "0,26 14,29 28,24 42,27 56,20 70,23 84,16 98,19 112,11 120,14",
  },
};

export function MetricCard({ label, value, icon: Icon, tone = "purple", subtext, subtextPositive = true, href }: MetricCardProps) {
  const style = TONE_STYLE[tone];

  const content = (
    <div className="group rounded-2xl border border-line/10 bg-card p-5 transition-all duration-150 hover:border-line/15 hover:bg-line/[0.03] dark:border-white/5 dark:hover:border-white/10 dark:hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-secondary/45">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-secondary dark:text-white">{value}</p>
          {subtext ? (
            <p className={cn("mt-1 text-xs font-medium", subtextPositive ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400")}>{subtext}</p>
          ) : null}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", style.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <svg viewBox="0 0 120 36" className="mt-3 h-9 w-full" aria-hidden>
        <polyline
          points={style.points}
          fill="none"
          stroke={style.stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 5px ${style.stroke})` }}
        />
      </svg>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
