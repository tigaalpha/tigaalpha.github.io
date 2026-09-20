"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Users,
  BookOpen,
  Calendar,
  Image,
  Megaphone,
  DollarSign,
  FileText,
  Mic,
  Settings,
  ClipboardList,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT, useLang } from "@/lib/language-context";
import { tfmt } from "@/lib/i18n";

/* ── Plan Step Types ── */

export interface PlanStep {
  step: number;
  action: string;
  feature: string;
  details: string;
  status?: "pending" | "running" | "done" | "error";
  result?: string;
}

interface ExecutionPlanProps {
  steps: PlanStep[];
  onApprove: () => void;
  onReject: () => void;
  executing?: boolean;
  currentStep?: number;
}

/* ── Feature Icons ── */

const FEATURE_ICONS: Record<string, typeof Users> = {
  students: Users,
  bookings: Calendar,
  courses: BookOpen,
  content: FileText,
  images: Image,
  marketing: Megaphone,
  finance: DollarSign,
  voiceover: Mic,
  automation: Settings,
  approvals: ClipboardList,
  default: Zap,
};

function getFeatureIcon(feature: string): typeof Users {
  const lower = feature.toLowerCase();
  for (const [key, icon] of Object.entries(FEATURE_ICONS)) {
    if (key !== "default" && lower.includes(key)) return icon;
  }
  return Zap;
}

function getFeatureColor(feature: string): string {
  const lower = feature.toLowerCase();
  if (lower.includes("student") || lower.includes("lukka")) return "text-blue-500 bg-blue-500/10";
  if (lower.includes("booking") || lower.includes("calendar")) return "text-green-500 bg-green-500/10";
  if (lower.includes("course")) return "text-purple-500 bg-purple-500/10";
  if (lower.includes("content") || lower.includes("script")) return "text-pink-500 bg-pink-500/10";
  if (lower.includes("image")) return "text-orange-500 bg-orange-500/10";
  if (lower.includes("marketing") || lower.includes("campaign")) return "text-cyan-500 bg-cyan-500/10";
  if (lower.includes("finance") || lower.includes("transaction")) return "text-emerald-500 bg-emerald-500/10";
  if (lower.includes("voiceover") || lower.includes("voice")) return "text-amber-500 bg-amber-500/10";
  if (lower.includes("approval")) return "text-red-500 bg-red-500/10";
  return "text-gray-500 bg-gray-500/10";
}

/* ── Parse Plan from AI Text ── */

export function parsePlanFromText(text: string): PlanStep[] | null {
  const planStart = text.indexOf("PLAN_START");
  const planEnd = text.indexOf("PLAN_END");
  if (planStart === -1 || planEnd === -1 || planEnd <= planStart) return null;

  const planSection = text.slice(planStart + "PLAN_START".length, planEnd);
  const stepRegex = /STEP:\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)/g;
  const steps: PlanStep[] = [];
  let match: RegExpExecArray | null;

  while ((match = stepRegex.exec(planSection)) !== null) {
    const m = match;
    steps.push({
      step: parseInt(m[1] ?? "0"),
      action: m[2]?.trim() ?? "",
      feature: m[3]?.trim() ?? "",
      details: m[4]?.trim() ?? "",
      status: "pending",
    });
  }

  return steps.length > 0 ? steps : null;
}

/* ── Step Card ── */

function StepCard({
  step,
  isExecuting,
  isCurrent,
}: {
  step: PlanStep;
  isExecuting: boolean;
  isCurrent: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useT();
  const Icon = getFeatureIcon(step.feature);
  const colorClass = getFeatureColor(step.feature);

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        isCurrent
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : step.status === "done"
          ? "border-green-500/20 bg-green-500/5"
          : step.status === "error"
          ? "border-red-500/20 bg-red-500/5"
          : "border-line/10 bg-card"
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Step number */}
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            step.status === "done"
              ? "bg-green-500 text-white"
              : step.status === "error"
              ? "bg-red-500 text-white"
              : isCurrent
              ? "bg-primary text-white"
              : "bg-line/10 text-secondary/60"
          )}
        >
          {step.status === "done" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : step.status === "error" ? (
            <XCircle className="h-4 w-4" />
          ) : isCurrent && isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            step.step
          )}
        </div>

        {/* Feature icon */}
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", colorClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-secondary">{step.action}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {step.feature}
            </Badge>
            {step.status === "done" && (
              <span className="text-[10px] text-green-600">{t("plan.stepDone")}</span>
            )}
            {step.status === "error" && (
              <span className="text-[10px] text-red-600">{t("plan.stepError")}</span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        {step.details && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-secondary/40 hover:text-secondary/70"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && step.details && (
        <div className="border-t border-line/5 px-3 py-2">
          <p className="text-xs text-secondary/60 whitespace-pre-wrap">{step.details}</p>
          {step.result && (
            <p className="mt-1 text-xs text-green-600 whitespace-pre-wrap">{step.result}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */

export function ExecutionPlan({
  steps,
  onApprove,
  onReject,
  executing = false,
  currentStep,
}: ExecutionPlanProps) {
  const t = useT();
  const { lang } = useLang();
  const [collapsed, setCollapsed] = useState(false);

  const doneCount = steps.filter((s) => s.status === "done").length;
  const errorCount = steps.filter((s) => s.status === "error").length;
  const allDone = doneCount === steps.length;
  const hasErrors = errorCount > 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-secondary">
              {tfmt(lang, "plan.title", { n: steps.length })}
            </span>
            {executing && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 animate-pulse">
                {t("plan.executing")}
              </Badge>
            )}
            {allDone && !hasErrors && (
              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                {t("plan.allDone")}
              </Badge>
            )}
            {hasErrors && (
              <Badge variant="danger" className="text-[10px] px-1.5 py-0">
                {tfmt(lang, "plan.errors", { n: errorCount })}
              </Badge>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-secondary/40 hover:text-secondary/70"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Progress bar */}
        {executing && (
          <div className="h-1.5 bg-line/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
        )}

        {/* Steps */}
        {!collapsed && (
          <div className="space-y-2">
            {steps.map((step) => (
              <StepCard
                key={step.step}
                step={step}
                isExecuting={executing}
                isCurrent={currentStep === step.step}
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        {!executing && !allDone && (
          <div className="flex gap-2 pt-1">
            <Button onClick={onApprove} className="flex-1" size="sm">
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {t("plan.approve")}
            </Button>
            <Button onClick={onReject} variant="outline" size="sm">
              <XCircle className="h-4 w-4 mr-1.5" />
              {t("plan.cancel")}
            </Button>
          </div>
        )}

        {allDone && !executing && (
          <div className="text-center py-1">
            <p className="text-xs text-green-600 font-medium">
              {tfmt(lang, "plan.finished", { a: doneCount, b: steps.length })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
