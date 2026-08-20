"use client";

import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Coins,
  Users,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChannelAttribution {
  channel: string;
  icon: string;
  color: string;
  spend: number;
  revenue: number;
  leads: number;
  conversions: number;
  cac: number;
  ltv: number;
  roi: number;
  paybackDays: number;
  trend: "up" | "down" | "stable";
  health: "excellent" | "good" | "needs_work" | "stop";
}

const CHANNELS: ChannelAttribution[] = [
  {
    channel: "LINE OA",
    icon: "💬",
    color: "bg-green-500",
    spend: 0,
    revenue: 189000,
    leads: 45,
    conversions: 7,
    cac: 0,
    ltv: 27000,
    roi: Infinity,
    paybackDays: 0,
    trend: "up",
    health: "excellent",
  },
  {
    channel: "Facebook Ads",
    icon: "📘",
    color: "bg-blue-600",
    spend: 15000,
    revenue: 108000,
    leads: 32,
    conversions: 4,
    cac: 3750,
    ltv: 27000,
    roi: 620,
    paybackDays: 42,
    trend: "stable",
    health: "good",
  },
  {
    channel: "TikTok (Organic)",
    icon: "🎵",
    color: "bg-black",
    spend: 0,
    revenue: 81000,
    leads: 28,
    conversions: 3,
    cac: 0,
    ltv: 27000,
    roi: Infinity,
    paybackDays: 0,
    trend: "up",
    health: "excellent",
  },
  {
    channel: "Google Ads",
    icon: "🔍",
    color: "bg-red-500",
    spend: 8000,
    revenue: 54000,
    leads: 12,
    conversions: 2,
    cac: 4000,
    ltv: 27000,
    roi: 575,
    paybackDays: 45,
    trend: "down",
    health: "needs_work",
  },
  {
    channel: "Referral",
    icon: "🎁",
    color: "bg-purple-500",
    spend: 5000,
    revenue: 135000,
    leads: 10,
    conversions: 5,
    cac: 1000,
    ltv: 27000,
    roi: 2600,
    paybackDays: 11,
    trend: "up",
    health: "excellent",
  },
  {
    channel: "Instagram",
    icon: "📸",
    color: "bg-pink-500",
    spend: 0,
    revenue: 27000,
    leads: 8,
    conversions: 1,
    cac: 0,
    ltv: 27000,
    roi: Infinity,
    paybackDays: 0,
    trend: "stable",
    health: "good",
  },
  {
    channel: "SEO",
    icon: "🌐",
    color: "bg-amber-500",
    spend: 0,
    revenue: 27000,
    leads: 5,
    conversions: 1,
    cac: 0,
    ltv: 27000,
    roi: Infinity,
    paybackDays: 0,
    trend: "up",
    health: "good",
  },
];

const HEALTH_MAP: Record<string, { label: string; variant: "success" | "info" | "warning" | "danger" }> = {
  excellent: { label: "🏆 Excellent", variant: "success" },
  good: { label: "✅ Good", variant: "info" },
  needs_work: { label: "⚠️ Needs Work", variant: "warning" },
  stop: { label: "🛑 Stop", variant: "danger" },
};

function fmtCurrency(v: number): string { return `฿${v.toLocaleString("th-TH")}`; }

export default function RevenueAttributionPage() {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  const totalSpend = CHANNELS.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = CHANNELS.reduce((s, c) => s + c.revenue, 0);
  const totalConversions = CHANNELS.reduce((s, c) => s + c.conversions, 0);
  const avgCac = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const avgLtv = 27000;
  const ltvCacRatio = avgCac > 0 ? (avgLtv / avgCac).toFixed(1) : "∞";
  const profit = totalRevenue - totalSpend;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">💰 Revenue Attribution</h1>
        <p className="text-sm text-secondary/50">เชื่อม Ad Spend ↔ Revenue จริง — รู้ว่าเงินโฆษณาไปไหนคุ้มสุด</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">ค่าใช้จ่ายรวม</p>
            <p className="text-xl font-bold text-red-500">{fmtCurrency(totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">รายได้รวม</p>
            <p className="text-xl font-bold text-emerald-600">{fmtCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Profit</p>
            <p className={cn("text-xl font-bold", profit >= 0 ? "text-emerald-600" : "text-red-500")}>{fmtCurrency(profit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">CAC เฉลี่ย</p>
            <p className="text-xl font-bold text-amber-600">{fmtCurrency(Math.round(avgCac))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">LTV</p>
            <p className="text-xl font-bold text-primary">{fmtCurrency(avgLtv)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">LTV:CAC Ratio</p>
            <p className="text-xl font-bold text-emerald-600">{ltvCacRatio}x</p>
          </CardContent>
        </Card>
      </div>

      {/* Period Toggle */}
      <div className="flex gap-2">
        {(["month", "quarter", "year"] as const).map((p) => (
          <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
            {p === "month" ? "เดือนนี้" : p === "quarter" ? "ไตรมาสนี้" : "ปีนี้"}
          </Button>
        ))}
      </div>

      {/* Channel Attribution Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-accent" />
            Revenue Attribution แยกตาม Channel
          </CardTitle>
          <CardDescription>เปรียบเทียบ Spend, Revenue, CAC, LTV, ROI ของแต่ละช่องทาง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {CHANNELS.sort((a, b) => b.roi - a.roi).map((ch) => {
            const health = HEALTH_MAP[ch.health] ?? HEALTH_MAP.good;
            return (
              <div key={ch.channel} className="rounded-xl border border-line/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{ch.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-secondary">{ch.channel}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {ch.trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
                        {ch.trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                        <span className="text-[10px] text-secondary/40">
                          {ch.trend === "up" ? "กำลังเติบโต" : ch.trend === "down" ? "กำลังลดลง" : "คงที่"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={health.variant} className="text-[10px]">{health.label}</Badge>
                </div>

                <div className="grid grid-cols-6 gap-2 text-center">
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-red-500">{ch.spend > 0 ? fmtCurrency(ch.spend) : "ฟรี"}</p>
                    <p className="text-[9px] text-secondary/40">Spend</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-emerald-600">{fmtCurrency(ch.revenue)}</p>
                    <p className="text-[9px] text-secondary/40">Revenue</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-secondary">{ch.leads}</p>
                    <p className="text-[9px] text-secondary/40">Leads</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-primary">{ch.conversions}</p>
                    <p className="text-[9px] text-secondary/40">Sales</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-amber-600">{ch.cac > 0 ? fmtCurrency(ch.cac) : "฿0"}</p>
                    <p className="text-[9px] text-secondary/40">CAC</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-primary">{ch.roi === Infinity ? "∞" : `${ch.roi}%`}</p>
                    <p className="text-[9px] text-secondary/40">ROI</p>
                  </div>
                </div>

                {/* Revenue Bar */}
                <div className="h-2 rounded-full bg-line/5 overflow-hidden">
                  <div className={cn("h-full rounded-full", ch.color)} style={{ width: `${totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0}%`, opacity: 0.7 }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Payback Period */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary-accent" />
            Payback Period
          </CardTitle>
          <CardDescription>ระยะเวลาคืนทุนของแต่ละช่องทาง (กี่วันกว่าจะได้เงินค่าโฆษณาคืน)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {CHANNELS.filter((c) => c.spend > 0).sort((a, b) => a.paybackDays - b.paybackDays).map((ch) => (
              <div key={ch.channel} className="flex items-center gap-3">
                <span className="w-32 text-xs text-secondary">{ch.icon} {ch.channel}</span>
                <div className="flex-1 h-4 rounded-full bg-line/5 overflow-hidden">
                  <div className={cn("h-full rounded-full", ch.color)} style={{ width: `${Math.min((ch.paybackDays / 60) * 100, 100)}%` }} />
                </div>
                <span className="w-16 text-right text-xs font-medium text-secondary">{ch.paybackDays} วัน</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-emerald-50/5 p-3 text-xs text-emerald-700 dark:text-emerald-400">
            💡 Referral คืนทุนเร็วสุด (11 วัน) — ลงทุน ฿1,000 ได้ลูกค้ามูลค่า ฿27,000
          </div>
        </CardContent>
      </Card>

      {/* Revenue Waterfall */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-accent" />
            Revenue Waterfall
          </CardTitle>
          <CardDescription>รายได้สะสมจากทุกช่องทาง</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {CHANNELS.sort((a, b) => b.revenue - a.revenue).map((ch) => {
              const pct = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={ch.channel} className="flex items-center gap-3">
                  <span className="w-32 text-xs text-secondary">{ch.icon} {ch.channel}</span>
                  <div className="flex-1 h-6 rounded-full bg-line/5 overflow-hidden">
                    <div className={cn("h-full rounded-full flex items-center px-2", ch.color)} style={{ width: `${pct}%`, opacity: 0.8 }}>
                      <span className="text-[10px] font-bold text-white drop-shadow">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <span className="w-20 text-right text-xs font-medium text-secondary">{fmtCurrency(ch.revenue)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-accent" />
            แนะนำการจัดสรรงบ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-emerald-200/30 bg-emerald-50/5 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">✅ เพิ่มลงทุน</h4>
            <div className="space-y-1 text-xs text-secondary/70">
              <p>• <strong>Referral</strong> — CAC ฿1,000, ROI 2600%, Payback 11 วัน → เพิ่มรางวัลจาก ฿500 เป็น ฿750</p>
              <p>• <strong>TikTok Organic</strong> — ฟรี, reach สูงสุด → เพิ่ม posting frequency</p>
              <p>• <strong>SEO</strong> — ฟรี, long-term traffic → สร้าง 10 landing pages</p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200/30 bg-amber-50/5 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
            <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">⚠️ ปรับปรุง</h4>
            <div className="space-y-1 text-xs text-secondary/70">
              <p>• <strong>Facebook Ads</strong> — CAC ฿3,750 สูง → A/B test ad copy เพื่อลด CAC</p>
              <p>• <strong>Google Ads</strong> — CAC ฿4,000 สูงสุด → เปลี่ยน keyword เป็น long-tail</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
