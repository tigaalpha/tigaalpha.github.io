import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  hint?: string;
  href?: string;
}

const TONE_BG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-primary/10 text-primary-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

const TONE_HOVER_BORDER: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "hover:border-primary/30",
  success: "hover:border-success/30",
  warning: "hover:border-warning/30",
  danger: "hover:border-danger/30",
};

export function StatCard({ label, value, icon: Icon, tone = "default", hint, href }: StatCardProps) {
  const content = (
    <CardContent className="flex items-start justify-between gap-4 p-5">
      <div>
        <p className="text-xs font-medium text-secondary/50">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-secondary">{value}</p>
        {hint ? <p className="mt-1 text-xs text-secondary/40">{hint}</p> : null}
      </div>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE_BG[tone])}>
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className={cn("transition-colors", TONE_HOVER_BORDER[tone])}>{content}</Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}
