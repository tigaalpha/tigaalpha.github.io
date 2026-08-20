"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingDown,
  Users,
  MessageSquare,
  CalendarCheck,
  CreditCard,
  Trophy,
  AlertTriangle,
  Clock,
  RefreshCw,
  ArrowDown,
  Target,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FunnelStage {
  id: string;
  label: string;
  labelEn: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  count: number;
  value: number;
  avgDays: number;
  dropOff: number;
}

const STAGE_CONFIG = [
  { id: "new_lead", label: "Lead ใหม่", labelEn: "New Lead", icon: Users, color: "text-blue-500", bgColor: "bg-blue-500" },
  { id: "contacted", label: "ติดต่อแล้ว", labelEn: "Contacted", icon: MessageSquare, color: "text-indigo-500", bgColor: "bg-indigo-500" },
  { id: "qualified", label: "ผ่านการคัดกรอง", labelEn: "Qualified", icon: Target, color: "text-purple-500", bgColor: "bg-purple-500" },
  { id: "trial_booked", label: "จองทดลองแล้ว", labelEn: "Trial Booked", icon: CalendarCheck, color: "text-amber-500", bgColor: "bg-amber-500" },
  { id: "trial_completed", label: "ทดลองแล้ว", labelEn: "Trial Done", icon: Zap, color: "text-orange-500", bgColor: "bg-orange-500" },
  { id: "negotiating", label: "กำลังเจรจา", labelEn: "Negotiating", icon: CreditCard, color: "text-rose-500", bgColor: "bg-rose-500" },
  { id: "won", label: "ปิดการขาย", labelEn: "Won", icon: Trophy, color: "text-emerald-500", bgColor: "bg-emerald-500" },
];

const STAGE_HISTORY = [
  { status: "new_lead", label: "Lead ใหม่", count: 127, value: 3429000, avgDays: 0, source: { line_oa: 45, facebook: 32, tiktok: 28, google: 12, referral: 10 } },
  { status: "contacted", label: "ติดต่อแล้ว", count: 89, value: 2403000, avgDays: 1.2, source: { line_oa: 38, facebook: 22, tiktok: 18, google: 7, referral: 4 } },
  { status: "qualified", label: "ผ่านการคัดกรอง", count: 64, value: 1728000, avgDays: 3.5, source: { line_oa: 28, facebook: 16, tiktok: 12, google: 5, referral: 3 } },
  { status: "trial_booked", label: "จองทดลองแล้ว", count: 42, value: 1134000, avgDays: 5.1, source: { line_oa: 20, facebook: 10, tiktok: 7, google: 3, referral: 2 } },
  { status: "trial_completed", label: "ทดลองแล้ว", count: 35, value: 945000, avgDays: 8.3, source: { line_oa: 18, facebook: 8, tiktok: 5, google: 2, referral: 2 } },
  { status: "negotiating", label: "กำลังเจรจา", count: 18, value: 486000, avgDays: 12.1, source: { line_oa: 10, facebook: 4, tiktok: 2, google: 1, referral: 1 } },
  { status: "won", label: "ปิดการขาย", count: 12, value: 324000, avgDays: 15.7, source: { line_oa: 7, facebook: 2, tiktok: 1, google: 1, referral: 1 } },
];

const BOTTLENECKS = [
  { stage: "ติดต่อ → คัดกรอง", dropOff: 28, reason: "Lead จำนวนมากไม่ตอบกลับภายใน 24 ชม.", fix: "เพิ่ม auto-response ใน 5 นาทีแรก" },
  { stage: "จองทดลอง → ทดลองจริง", dropOff: 17, reason: "ลูกค้านัดแล้วไม่มา (no-show)", fix: "ส่ง LINE reminder ก่อน 24h + 2h" },
  { stage: "เจรจา → ปิดขาย", dropOff: 33, reason: "ราคา ฿27,000 สูงสำหรับบางกลุ่ม", fix: "เสนอทางเลือก Online Course ฿990 ก่อน" },
];

const SOURCE_COLORS: Record<string, string> = {
  line_oa: "bg-green-500",
  facebook: "bg-blue-600",
  tiktok: "bg-black",
  google: "bg-red-500",
  referral: "bg-purple-500",
};

const SOURCE_LABELS: Record<string, string> = {
  line_oa: "LINE OA",
  facebook: "Facebook",
  tiktok: "TikTok",
  google: "Google",
  referral: "Referral",
};

function fmtCurrency(value: number): string {
  return `฿${value.toLocaleString("th-TH")}`;
}

export default function FunnelPage() {
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");
  const [data, setData] = useState(STAGE_HISTORY);

  const totalLeads = data[0]?.count ?? 0;
  const totalWon = data[data.length - 1]?.count ?? 0;
  const convRate = totalLeads > 0 ? ((totalWon / totalLeads) * 100).toFixed(1) : "0";
  const totalRevenue = data[data.length - 1]?.value ?? 0;
  const avgDealSize = totalWon > 0 ? Math.round(totalRevenue / totalWon) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">🎯 Sales Funnel</h1>
        <p className="text-sm text-secondary/50">ภาพรวม Conversion Funnel ทั้งหมด — เห็นว่า Lead รั่วตรงไหน</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Lead ทั้งหมด</p>
            <p className="text-2xl font-bold text-secondary">{totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">ปิดการขาย</p>
            <p className="text-2xl font-bold text-emerald-600">{totalWon}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Conversion Rate</p>
            <p className="text-2xl font-bold text-primary">{convRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">รายได้รวม</p>
            <p className="text-2xl font-bold text-amber-600">{fmtCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Period Toggle */}
      <div className="flex gap-2">
        {(["week", "month", "quarter"] as const).map((p) => (
          <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
            {p === "week" ? "7 วัน" : p === "month" ? "30 วัน" : "90 วัน"}
          </Button>
        ))}
      </div>

      {/* Visual Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary-accent" />
            Conversion Funnel
          </CardTitle>
          <CardDescription>แต่ละ stage แสดงจำนวน Lead ที่เหลืออยู่ (ยิ่งแคบ = ยิ่งรั่ว)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {data.map((stage, i) => {
              const pct = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0;
              const dropOff = i > 0 ? ((data[i - 1].count - stage.count) / data[i - 1].count) * 100 : 0;
              const cfg = STAGE_CONFIG[i];
              return (
                <div key={stage.status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {cfg && <cfg.icon className={cn("h-4 w-4", cfg.color)} />}
                      <span className="font-medium text-secondary">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-secondary/60">
                      <span className="font-semibold text-secondary">{stage.count} คน</span>
                      <span>{fmtCurrency(stage.value)}</span>
                      <span>เฉลี่ย {stage.avgDays} วัน</span>
                    </div>
                  </div>
                  <div className="relative h-8 w-full overflow-hidden rounded-lg bg-line/5">
                    <div
                      className={cn("h-full rounded-lg transition-all duration-500", cfg?.bgColor ?? "bg-gray-400")}
                      style={{ width: `${pct}%`, opacity: 0.85 }}
                    />
                    <div className="absolute inset-0 flex items-center px-3 text-xs font-medium text-white drop-shadow">
                      {pct.toFixed(1)}%
                    </div>
                  </div>
                  {i > 0 && dropOff > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-red-400">
                      <TrendingDown className="h-3 w-3" />
                      -{dropOff.toFixed(1)}% drop-off
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Source Breakdown per Stage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary-accent" />
            Lead Sources แยกตาม Stage
          </CardTitle>
          <CardDescription>แหล่งที่มาของ Lead ในแต่ละ stage — เห็นว่า source ไหน convert ดีสุด</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.map((stage) => {
            const total = Object.values(stage.source).reduce((a, b) => a + b, 0);
            return (
              <div key={stage.status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-secondary">{stage.label}</span>
                  <span className="text-xs text-secondary/50">{total} คน</span>
                </div>
                <div className="flex h-6 overflow-hidden rounded-full">
                  {Object.entries(stage.source).map(([src, count]) => {
                    const w = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div
                        key={src}
                        className={cn("h-full transition-all", SOURCE_COLORS[src] ?? "bg-gray-400")}
                        style={{ width: `${w}%` }}
                        title={`${SOURCE_LABELS[src] ?? src}: ${count}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stage.source).map(([src, count]) => (
                    <div key={src} className="flex items-center gap-1 text-[10px] text-secondary/60">
                      <div className={cn("h-2 w-2 rounded-full", SOURCE_COLORS[src] ?? "bg-gray-400")} />
                      {SOURCE_LABELS[src] ?? src}: {count}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Bottleneck Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Bottleneck Analysis
          </CardTitle>
          <CardDescription>จุดที่ Lead หลุดมากที่สุด + สาเหตุ + วิธีแก้</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {BOTTLENECKS.map((b, i) => (
            <div key={i} className="rounded-xl border border-amber-200/30 bg-amber-50/5 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-secondary">{b.stage}</span>
                <Badge variant="warning">-{b.dropOff}%</Badge>
              </div>
              <p className="text-xs text-secondary/60 mb-1">🔍 {b.reason}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">✅ {b.fix}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Lead Time Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-accent" />
            Lead Time Analysis
          </CardTitle>
          <CardDescription>เวลาเฉลี่ยที่ Lead ใช้ในแต่ละ stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.slice(1).map((stage, i) => {
              const prev = data[i];
              const daysInStage = stage.avgDays - prev.avgDays;
              return (
                <div key={stage.status} className="flex items-center gap-3">
                  <span className="w-32 text-xs text-secondary/60">{prev.label} → {stage.label}</span>
                  <div className="flex-1 h-4 rounded-full bg-line/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${Math.min((daysInStage / 5) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-secondary w-16 text-right">{daysInStage.toFixed(1)} วัน</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl bg-line/5 p-3 text-xs text-secondary/60">
            ⏱️ เวลาเฉลี่ยรวมจาก Lead ใหม่ → ปิดการขาย: <strong className="text-secondary">{data[data.length - 1]?.avgDays ?? 0} วัน</strong>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
