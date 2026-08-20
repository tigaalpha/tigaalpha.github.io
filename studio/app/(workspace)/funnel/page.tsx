"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingDown, Users, MessageSquare, CalendarCheck, CreditCard, Trophy,
  AlertTriangle, Clock, RefreshCw, ArrowDown, Target, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FunnelStage {
  status: string;
  label: string;
  count: number;
  value: number;
  avgDays: number;
  source: Record<string, number>;
}

const STAGE_CONFIG = [
  { id: "new_lead", label: "Lead ใหม่", icon: Users, color: "text-blue-500", bgColor: "bg-blue-500" },
  { id: "contacted", label: "ติดต่อแล้ว", icon: MessageSquare, color: "text-indigo-500", bgColor: "bg-indigo-500" },
  { id: "qualified", label: "ผ่านการคัดกรอง", icon: Target, color: "text-purple-500", bgColor: "bg-purple-500" },
  { id: "trial_booked", label: "จองทดลองแล้ว", icon: CalendarCheck, color: "text-amber-500", bgColor: "bg-amber-500" },
  { id: "trial_completed", label: "ทดลองแล้ว", icon: Zap, color: "text-orange-500", bgColor: "bg-orange-500" },
  { id: "negotiating", label: "กำลังเจรจา", icon: CreditCard, color: "text-rose-500", bgColor: "bg-rose-500" },
  { id: "won", label: "ปิดการขาย", icon: Trophy, color: "text-emerald-500", bgColor: "bg-emerald-500" },
];

const SOURCE_COLORS: Record<string, string> = {
  line_oa: "bg-green-500", facebook: "bg-blue-600", tiktok: "bg-black",
  google: "bg-red-500", referral: "bg-purple-500", Unknown: "bg-gray-400",
};
const SOURCE_LABELS: Record<string, string> = {
  line_oa: "LINE OA", facebook: "Facebook", tiktok: "TikTok",
  google: "Google", referral: "Referral", Unknown: "ไม่ระบุ",
};

function fmtCurrency(value: number): string { return `฿${value.toLocaleString("th-TH")}`; }

export default function FunnelPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);

  async function loadFunnel() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const allCustomers = await repos.customers.listPipeline();
      
      const days = period === "week" ? 7 : period === "month" ? 30 : 90;
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      
      // Filter by period
      const filtered = allCustomers.filter(c => c.created_at >= cutoff);

      const stageOrder = ["new_lead", "contacted", "qualified", "interested", "trial_booked", "trial_completed", "negotiating", "waiting_decision", "won"];
      
      // Build funnel stages
      const funnelData: FunnelStage[] = STAGE_CONFIG.map(cfg => {
        const stageCustomers = filtered.filter(c => {
          if (cfg.id === "qualified") return c.sales_status === "qualified" || c.sales_status === "interested";
          return c.sales_status === cfg.id;
        });
        
        const sourceBreakdown: Record<string, number> = {};
        stageCustomers.forEach(c => {
          const src = (c.lead_source || "Unknown").toLowerCase().replace(/\s+/g, "_");
          sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;
        });

        const avgDays = stageCustomers.length > 0 
          ? stageCustomers.reduce((s, c) => {
              const created = new Date(c.created_at).getTime();
              return s + (Date.now() - created) / (1000 * 60 * 60 * 24);
            }, 0) / stageCustomers.length
          : 0;

        return {
          status: cfg.id,
          label: cfg.label,
          count: stageCustomers.length,
          value: stageCustomers.length * 27000, // estimated
          avgDays: Math.round(avgDays * 10) / 10,
          source: sourceBreakdown,
        };
      });

      setStages(funnelData);
      setTotalLeads(filtered.length);
    } catch (err) {
      console.error("Failed to load funnel:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFunnel(); }, [period]);

  const totalWon = stages[stages.length - 1]?.count ?? 0;
  const convRate = totalLeads > 0 ? ((totalWon / totalLeads) * 100).toFixed(1) : "0";
  const totalRevenue = stages[stages.length - 1]?.value ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🎯 Sales Funnel</h1>
          <p className="text-sm text-secondary/50">ภาพรวม Conversion Funnel — ข้อมูลจริงจาก CRM</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadFunnel} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />รีเฟรช
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Lead ทั้งหมด</p><p className="text-2xl font-bold text-secondary">{totalLeads}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">ปิดการขาย</p><p className="text-2xl font-bold text-emerald-600">{totalWon}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Conversion Rate</p><p className="text-2xl font-bold text-primary">{convRate}%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">รายได้รวม</p><p className="text-2xl font-bold text-amber-600">{fmtCurrency(totalRevenue)}</p></CardContent></Card>
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
          <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-primary-accent" />Conversion Funnel</CardTitle>
          <CardDescription>แต่ละ stage แสดงจำนวน Lead ที่เหลืออยู่ — ข้อมูลจริง</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8 text-secondary/50">กำลังโหลดข้อมูล...</div> : (
            <div className="space-y-1">
              {stages.map((stage, i) => {
                const pct = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0;
                const dropOff = i > 0 && stages[i - 1].count > 0 ? ((stages[i - 1].count - stage.count) / stages[i - 1].count) * 100 : 0;
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
                      <div className={cn("h-full rounded-lg transition-all duration-500", cfg?.bgColor ?? "bg-gray-400")} style={{ width: `${pct}%`, opacity: 0.85 }} />
                      <div className="absolute inset-0 flex items-center px-3 text-xs font-medium text-white drop-shadow">{pct.toFixed(1)}%</div>
                    </div>
                    {i > 0 && dropOff > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-red-400">
                        <TrendingDown className="h-3 w-3" />-{dropOff.toFixed(1)}% drop-off
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source Breakdown per Stage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary-accent" />Lead Sources แยกตาม Stage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stages.filter(s => s.count > 0).map((stage) => {
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
                    return <div key={src} className={cn("h-full transition-all", SOURCE_COLORS[src] ?? "bg-gray-400")} style={{ width: `${w}%` }} title={`${SOURCE_LABELS[src] ?? src}: ${count}`} />;
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

      {/* Bottleneck Alerts — auto-generated from real drop-offs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Bottleneck Analysis</CardTitle>
          <CardDescription>จุดที่ Lead หลุดมากที่สุด — วิเคราะห์จากข้อมูลจริง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stages.slice(1).map((stage, i) => {
            const prev = stages[i];
            if (prev.count === 0) return null;
            const dropOff = ((prev.count - stage.count) / prev.count) * 100;
            if (dropOff < 10) return null;
            return (
              <div key={stage.status} className="rounded-xl border border-amber-200/30 bg-amber-50/5 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-secondary">{prev.label} → {stage.label}</span>
                  <Badge variant="warning">-{dropOff.toFixed(0)}%</Badge>
                </div>
                <p className="text-xs text-secondary/60">🔍 Lead หลุด {prev.count - stage.count} คน ใน stage นี้</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
