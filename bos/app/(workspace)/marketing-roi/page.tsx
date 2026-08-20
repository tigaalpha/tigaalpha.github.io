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
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Users,
  Calculator,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChannelROI {
  channel: string;
  icon: string;
  spend: number;
  leads: number;
  conversions: number;
  revenue: number;
  cac: number;
  roi: number;
  trend: "up" | "down" | "stable";
  recommendation: string;
  status: "excellent" | "good" | "needs_work" | "stop";
}

const CHANNELS: ChannelROI[] = [
  {
    channel: "LINE OA",
    icon: "💬",
    spend: 0,
    leads: 45,
    conversions: 7,
    revenue: 189000,
    cac: 0,
    roi: Infinity,
    trend: "up",
    recommendation: "ช่องทางนี้มี ROI สูงสุด (ไม่มีค่าใช้จ่าย) — เพิ่ม content และ QR code",
    status: "excellent",
  },
  {
    channel: "Facebook Ads",
    icon: "📘",
    spend: 15000,
    leads: 32,
    conversions: 4,
    revenue: 108000,
    cac: 3750,
    roi: 620,
    trend: "stable",
    recommendation: "ROI ดี แต่ CAC สูง — ลอง A/B test ad copy เพื่อลด CAC เหลือ < ฿3,000",
    status: "good",
  },
  {
    channel: "TikTok (Organic)",
    icon: "🎵",
    spend: 0,
    leads: 28,
    conversions: 3,
    revenue: 81000,
    cac: 0,
    roi: Infinity,
    trend: "up",
    recommendation: "มี lead เยอะ — เพิ่ม posting frequency เป็น 2 ครั้ง/วัน",
    status: "excellent",
  },
  {
    channel: "Google Ads",
    icon: "🔍",
    spend: 8000,
    leads: 12,
    conversions: 2,
    revenue: 54000,
    cac: 4000,
    roi: 575,
    trend: "down",
    recommendation: "CAC สูงสุด — ลด budget หรือเปลี่ยน keyword เป็น long-tail",
    status: "needs_work",
  },
  {
    channel: "Referral",
    icon: "🎁",
    spend: 5000,
    leads: 10,
    conversions: 5,
    revenue: 135000,
    cac: 1000,
    roi: 2600,
    trend: "up",
    recommendation: "ROI สูงสุด (付费) — เพิ่มรางวัล referral จาก ฿500 เป็น ฿750",
    status: "excellent",
  },
  {
    channel: "Instagram",
    icon: "📸",
    spend: 0,
    leads: 8,
    conversions: 1,
    revenue: 27000,
    cac: 0,
    roi: Infinity,
    trend: "stable",
    recommendation: "Post Reels 3 ครั้ง/สัปดาห์ + ใช้ hashtag ท้องถิ่น",
    status: "good",
  },
  {
    channel: "SEO (Organic)",
    icon: "🌐",
    spend: 0,
    leads: 5,
    conversions: 1,
    revenue: 27000,
    cac: 0,
    roi: Infinity,
    trend: "up",
    recommendation: "ยังไม่มี landing page สาธารณะ — สร้าง 5-10 หน้า SEO content",
    status: "needs_work",
  },
];

const STATUS_MAP: Record<string, { label: string; variant: "success" | "info" | "warning" | "danger" }> = {
  excellent: { label: "🏆 Excellent", variant: "success" },
  good: { label: "✅ Good", variant: "info" },
  needs_work: { label: "⚠️ Needs Work", variant: "warning" },
  stop: { label: "🛑 Stop", variant: "danger" },
};

function fmtCurrency(value: number): string {
  if (value === Infinity) return "∞";
  return `฿${value.toLocaleString("th-TH")}`;
}

function fmtPercent(value: number): string {
  if (value === Infinity) return "∞%";
  return `${value.toFixed(0)}%`;
}

export default function MarketingROIPage() {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  const totalSpend = CHANNELS.reduce((s, c) => s + c.spend, 0);
  const totalLeads = CHANNELS.reduce((s, c) => s + c.leads, 0);
  const totalConversions = CHANNELS.reduce((s, c) => s + c.conversions, 0);
  const totalRevenue = CHANNELS.reduce((s, c) => s + c.revenue, 0);
  const avgCac = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const avgRoi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">💰 Marketing ROI</h1>
        <p className="text-sm text-secondary/50">เปรียบเทียบค่าโฆษณากับรายได้ — ช่องทางไหนคุ้มที่สุด</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">ค่าใช้จ่ายรวม</p>
            <p className="text-xl font-bold text-red-500">฿{totalSpend.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">รายได้รวม</p>
            <p className="text-xl font-bold text-emerald-600">฿{totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">ROI รวม</p>
            <p className="text-xl font-bold text-primary">{fmtPercent(avgRoi)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">CAC เฉลี่ย</p>
            <p className="text-xl font-bold text-amber-600">฿{Math.round(avgCac).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Profit</p>
            <p className="text-xl font-bold text-emerald-600">฿{(totalRevenue - totalSpend).toLocaleString()}</p>
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

      {/* Channel ROI Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-accent" />
            ROI แยกตามช่องทาง
          </CardTitle>
          <CardDescription>เปรียบเทียบ CAC, ROI, และ Conversion ของแต่ละช่องทาง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {CHANNELS.sort((a, b) => b.roi - a.roi).map((ch) => {
            const st = STATUS_MAP[ch.status] ?? STATUS_MAP.good;
            const revenueBar = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0;
            return (
              <div key={ch.channel} className="rounded-xl border border-line/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{ch.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-secondary">{ch.channel}</p>
                      <p className="text-[10px] text-secondary/40">{ch.recommendation}</p>
                    </div>
                  </div>
                  <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                </div>

                <div className="grid grid-cols-5 gap-2 text-center">
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-secondary">{ch.spend > 0 ? `฿${ch.spend.toLocaleString()}` : "ฟรี"}</p>
                    <p className="text-[9px] text-secondary/40">Spend</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-secondary">{ch.leads}</p>
                    <p className="text-[9px] text-secondary/40">Leads</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-emerald-600">{ch.conversions}</p>
                    <p className="text-[9px] text-secondary/40">Sales</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-amber-600">฿{ch.revenue.toLocaleString()}</p>
                    <p className="text-[9px] text-secondary/40">Revenue</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-xs font-bold text-primary">{fmtPercent(ch.roi)}</p>
                    <p className="text-[9px] text-secondary/40">ROI</p>
                  </div>
                </div>

                {/* Revenue Bar */}
                <div className="h-2 rounded-full bg-line/5 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${revenueBar}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Budget Optimization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary-accent" />
            Budget Optimization
          </CardTitle>
          <CardDescription>แนะนำการจัดสรรงบประมาณตาม ROI จริง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-emerald-200/30 bg-emerald-50/5 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">✅ ลงทุนเพิ่ม</h4>
            <div className="space-y-1 text-xs text-secondary/70">
              <p>• <strong>Referral Program</strong> — ROI 2600%, ลงทุน ฿5,000 ได้รายได้ ฿135,000</p>
              <p>• <strong>TikTok Organic</strong> — ฟรี, มี lead 28 คน/เดือน</p>
              <p>• <strong>LINE OA</strong> — ฟรี, มี lead 45 คน/เดือน</p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200/30 bg-amber-50/5 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
            <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">⚠️ ปรับปรุง</h4>
            <div className="space-y-1 text-xs text-secondary/70">
              <p>• <strong>Facebook Ads</strong> — ROI ดีแต่ CAC ฿3,750 สูง → ลดเป็น ฿2,500 ด้วย A/B testing</p>
              <p>• <strong>Google Ads</strong> — CAC ฿4,000 สูงสุด → ลด budget 50% แล้วเปลี่ยน keyword</p>
            </div>
          </div>
          <div className="rounded-xl border border-red-200/30 bg-red-50/5 p-4 dark:border-red-500/20 dark:bg-red-500/5">
            <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">🛑 หยุด/ลด</h4>
            <div className="space-y-1 text-xs text-secondary/70">
              <p>• ยังไม่มีช่องทางที่ต้องหยุด — ทุกช่องทางยังมี ROI บวก</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Budget Split */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary-accent" />
            แนะนำการแบ่งงบ ฿23,000/เดือน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { name: "Referral Rewards", budget: 5000, pct: 22, color: "bg-emerald-500" },
              { name: "Facebook Ads", budget: 8000, pct: 35, color: "bg-blue-500" },
              { name: "Google Ads", budget: 4000, pct: 17, color: "bg-red-500" },
              { name: "Content Creation (TikTok/IG)", budget: 3000, pct: 13, color: "bg-purple-500" },
              { name: "SEO/landing pages", budget: 3000, pct: 13, color: "bg-amber-500" },
            ].map((b) => (
              <div key={b.name} className="flex items-center gap-3">
                <span className="w-40 text-xs text-secondary">{b.name}</span>
                <div className="flex-1 h-4 rounded-full bg-line/5 overflow-hidden">
                  <div className={cn("h-full rounded-full", b.color)} style={{ width: `${b.pct}%` }} />
                </div>
                <span className="w-20 text-right text-xs font-medium text-secondary">฿{b.budget.toLocaleString()} ({b.pct}%)</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
