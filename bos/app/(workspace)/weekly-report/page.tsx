"use client";

import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Target,
  Users,
  DollarSign,
  Sparkles,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Send,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WeeklyMetric {
  label: string;
  current: number;
  previous: number;
  unit: string;
  trend: "up" | "down" | "stable";
}

const METRICS: WeeklyMetric[] = [
  { label: "Lead ใหม่", current: 32, previous: 28, unit: "คน", trend: "up" },
  { label: "Trial Booked", current: 12, previous: 10, unit: "คน", trend: "up" },
  { label: "Trial Completed", current: 8, previous: 7, unit: "คน", trend: "up" },
  { label: "Conversion (Trial→Won)", current: 3, previous: 2, unit: "คน", trend: "up" },
  { label: "Revenue", current: 81000, previous: 54000, unit: "฿", trend: "up" },
  { label: "Ad Spend", current: 8500, previous: 10000, unit: "฿", trend: "down" },
  { label: "ROI", current: 853, previous: 440, unit: "%", trend: "up" },
  { label: "CAC", current: 2833, previous: 3333, unit: "฿", trend: "down" },
];

interface ActionItem {
  priority: "high" | "medium" | "low";
  action: string;
  reason: string;
  expectedImpact: string;
  category: string;
}

const ACTION_ITEMS: ActionItem[] = [
  { priority: "high", action: "เพิ่ม TikTok posting เป็น 2 ครั้ง/วัน", reason: "TikTok มี reach สูงสุด แต่โพสต์แค่ 3 ครั้ง/สัปดาห์", expectedImpact: "+40% reach", category: "Content" },
  { priority: "high", action: "ส่ง LINE broadcast สำหรับ lead ที่ trial แล้ว 3 วัน", reason: "Post-trial conversion rate สูงสุดใน 72 ชั่วโมงแรก", expectedImpact: "+5 conversions", category: "Drip Campaign" },
  { priority: "high", action: "A/B test Facebook ad copy — ลอง 'เรียนฟรี' vs 'ทดลองฟรี'", reason: "Facebook CAC ยังสูง (฿3,750) — ลด 20% ได้ถ้า copy ดีขึ้น", expectedImpact: "-฿750 CAC", category: "Ads" },
  { priority: "medium", action: "สร้าง Landing Page สำหรับ 'เรียนเปียโนเด็ก'", reason: "Keyword มี search volume สูง แต่ยังไม่มีหน้า landing page", expectedImpact: "+20 leads/เดือน", category: "SEO" },
  { priority: "medium", action: "ส่ง referral reward ให้คุณสมศักดิ์ (แนะนำ 8 คน)", reason: "Top referrer ยังไม่ได้รับรางวัล — อาจหยุด referral", expectedImpact: "+3 referrals", category: "Referral" },
  { priority: "medium", action: "อัปเดต Google Business Profile — เพิ่มรูปใหม่ 5 รูป", reason: "Profile ยังไม่มีรูป lesson จริง — คนไม่ click", expectedImpact: "+15% profile views", category: "Google" },
  { priority: "low", action: "เขียน blog 'เปียโน vs กีตาร์' — เสร็จแล้ว publish", reason: "Draft มีอยู่แล้ว แต่ยังไม่ได้ publish", expectedImpact: "+500 views", category: "SEO" },
  { priority: "low", action: "เพิ่ม Instagram Reels 3 คลิป/สัปดาห์", reason: "Instagram reach กำลังลดลง — Reels ช่วยได้", expectedImpact: "+200 reach", category: "Content" },
];

interface WinbackCandidate {
  name: string;
  lastLesson: string;
  daysSince: number;
  courseLeft: number;
  risk: "high" | "medium" | "low";
}

const WINBACK_CANDIDATES: WinbackCandidate[] = [
  { name: "คุณกัญญา", lastLesson: "2025-07-15", daysSince: 36, courseLeft: 12, risk: "high" },
  { name: "คุณพงศ์", lastLesson: "2025-07-28", daysSince: 23, courseLeft: 8, risk: "medium" },
  { name: "คุณนภา", lastLesson: "2025-08-05", daysSince: 15, courseLeft: 15, risk: "low" },
];

const PRIORITY_MAP: Record<string, { label: string; variant: "danger" | "warning" | "outline"; color: string }> = {
  high: { label: "🔴 สูง", variant: "danger", color: "border-red-200/30 bg-red-50/5 dark:border-red-500/20 dark:bg-red-500/5" },
  medium: { label: "🟡 กลาง", variant: "warning", color: "border-amber-200/30 bg-amber-50/5 dark:border-amber-500/20 dark:bg-amber-500/5" },
  low: { label: "🟢 ต่ำ", variant: "outline", color: "border-emerald-200/30 bg-emerald-50/5 dark:border-emerald-500/20 dark:bg-emerald-500/5" },
};

function fmtCurrency(v: number): string { return `฿${v.toLocaleString("th-TH")}`; }

export default function WeeklyReportPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">📊 AI Weekly Marketing Report</h1>
          <p className="text-sm text-secondary/50">สรุปภาพรวมสัปดาห์ + Action Items ที่ AI แนะนำ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-1" />รีเฟรช</Button>
          <Button size="sm" onClick={() => setSent(true)}><Send className="h-4 w-4 mr-1" />{sent ? "ส่งแล้ว!" : "ส่งรายงาน"}</Button>
        </div>
      </div>

      {/* Report Header */}
      <Card className="border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">สัปดาห์ที่ 11-17 สิงหาคม 2025</p>
              <p className="text-xs text-secondary/40">สร้างโดย AI อัตโนมัติ · อัปเดต {new Date().toLocaleDateString("th-TH")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-accent" />
            Key Metrics — สัปดาห์นี้ vs สัปดาห์ก่อน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {METRICS.map((m) => {
              const change = m.previous > 0 ? ((m.current - m.previous) / m.previous * 100).toFixed(1) : "0";
              const isPositive = m.label === "Ad Spend" || m.label === "CAC" ? m.current < m.previous : m.current > m.previous;
              return (
                <div key={m.label} className="rounded-xl border border-line/10 p-3">
                  <p className="text-xs text-secondary/50">{m.label}</p>
                  <p className="text-xl font-bold text-secondary">
                    {m.unit === "฿" ? fmtCurrency(m.current) : `${m.current} ${m.unit}`}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {isPositive ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                    <span className={cn("text-xs", isPositive ? "text-emerald-500" : "text-red-500")}>
                      {Number(change) > 0 ? "+" : ""}{change}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI Summary */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-accent" />
            AI Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-primary/5 p-4 text-sm text-secondary space-y-2">
            <p>📈 <strong>สัปดาห์นี้ดีขึ้นอย่างมีนัยสำคัญ</strong> — Revenue เพิ่ม 50% (฿54K → ฿81K) แม้ Ad Spend ลดลง 15%</p>
            <p>🎯 <strong>Conversion Rate ดีขึ้น</strong> — Trial → Won เพิ่มจาก 2 เป็น 3 คน (+50%)</p>
            <p>💰 <strong>CAC ลดลง</strong> — จาก ฿3,333 เหลือ ฿2,833 (-15%) เพราะ Referral conversion สูง</p>
            <p>⚠️ <strong>จุดที่ต้องระวัง</strong> — Lead ใหม่เพิ่มแค่ 14% (28→32) — ควรเพิ่มช่องทาง lead generation</p>
            <p>🏆 <strong>Highlight</strong> — Referral Program มี ROI สูงสุด (2600%) — ควรขยายโปรแกรมนี้</p>
          </div>
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-accent" />
            Action Items — สิ่งที่ต้องทำสัปดาห์นี้
          </CardTitle>
          <CardDescription>AI แนะนำตามลำดับความสำคัญ — ทำ 3 ข้อแรกก็เห็นผลแล้ว</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ACTION_ITEMS.map((item, i) => {
            const pri = PRIORITY_MAP[item.priority] ?? PRIORITY_MAP.low;
            return (
              <div key={i} className={cn("rounded-xl border p-4", pri.color)}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                    <span className="text-sm font-medium text-secondary">{item.action}</span>
                  </div>
                  <Badge variant={pri.variant} className="text-[9px] shrink-0">{pri.label}</Badge>
                </div>
                <p className="text-xs text-secondary/50 ml-8">💬 {item.reason}</p>
                <div className="flex items-center gap-2 ml-8 mt-1">
                  <Badge variant="outline" className="text-[9px]">{item.category}</Badge>
                  <span className="text-[10px] text-emerald-600">📈 {item.expectedImpact}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Winback Candidates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" />
            Winback Candidates
          </CardTitle>
          <CardDescription>ลูกค้าที่ควรติดต่อกลับ — มีชั่วโมงเรียนเหลืออยู่</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {WINBACK_CANDIDATES.map((c, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-secondary">{c.name}</p>
                <p className="text-[10px] text-secondary/40">เรียนครั้งสุดท้าย: {c.lastLesson} · เหลือ {c.courseLeft} ชั่วโมง</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.risk === "high" ? "danger" : c.risk === "medium" ? "warning" : "outline"} className="text-[9px]">
                  {c.risk === "high" ? "เสี่ยงสุด" : c.risk === "medium" ? "ระวัง" : "ปกติ"}
                </Badge>
                <Button size="sm" variant="ghost">ติดตาม</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Top Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-accent" />
            Content Performance สัปดาห์นี้
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { title: "🎵 เคยสงสัยไหมว่า ทำไมเด็กบางคนเรียนเปียโนแล้วเก่งเร็ว?", platform: "TikTok", views: 12400, likes: 890, shares: 234 },
            { title: "5 เหตุผลที่ควรเริ่มเรียนเปียโนตอนอายุ 6-12 ปี", platform: "Facebook", views: 3200, likes: 156, shares: 45 },
            { title: "นักเรียนของเราเล่น Moonlight Sonata ได้แล้ว!", platform: "Instagram", views: 2800, likes: 234, shares: 67 },
          ].map((content, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-line/10 px-3 py-2">
              <span className="text-lg font-bold text-secondary/30">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-secondary line-clamp-1">{content.title}</p>
                <div className="flex gap-3 text-[10px] text-secondary/40 mt-1">
                  <span>{content.platform}</span>
                  <span>👁 {content.views.toLocaleString()}</span>
                  <span>❤️ {content.likes}</span>
                  <span>🔄 {content.shares}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
