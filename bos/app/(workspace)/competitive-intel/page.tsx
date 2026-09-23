"use client";

import { Radar, Eye, TrendingUp, TrendingDown, AlertTriangle, Check, ExternalLink, Clock, Target, Sparkles, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Competitor {
  name: string;
  platform: string;
  followers: number;
  rating: number;
  reviewCount: number;
  pricing: string;
  recentActivity: string;
  threat: "high" | "medium" | "low";
  ourAdvantage: string;
}

const COMPETITORS: Competitor[] = [
  { name: "Piano Academy Bangkok", platform: "Facebook", followers: 3200, rating: 4.6, reviewCount: 128, pricing: "฿25,000/40 ชม.", recentActivity: "เปิดคอร์สใหม่ 'Jazz Piano for Beginners'", threat: "high", ourAdvantage: "ครู native speaker + AI tutor 24/7" },
  { name: "Synthesia Music School", platform: "Instagram", followers: 2100, rating: 4.3, reviewCount: 89, pricing: "฿22,000/40 ชม.", recentActivity: "โพสต์ Reels นักเรียนเล่นเปียโน — 3K views", threat: "medium", ourAdvantage: "Track ชั่วโมงชัดเจน + ระบบ CRM" },
  { name: "Happy Keys Studio", platform: "LINE", followers: 1500, rating: 4.8, reviewCount: 67, pricing: "฿30,000/40 ชม.", recentActivity: "ขอ review จากนักเรียน — ได้ 15 รีวิวใหม่", threat: "medium", ourAdvantage: "ราคาเป็นธรรม + แพ็กเกจหลากหลาย" },
];

interface IntelAlert {
  date: string;
  competitor: string;
  type: "pricing" | "content" | "review" | "feature";
  alert: string;
  action: string;
}

const ALERTS: IntelAlert[] = [
  { date: "2025-08-19", competitor: "Piano Academy", type: "feature", alert: "เปิดคอร์ส Jazz ใหม่ — เราไม่มี", action: "พิจารณาเพิ่ม Jazz module ในคอร์ส" },
  { date: "2025-08-17", competitor: "Happy Keys", type: "review", alert: "ได้ review ใหม่ 15 รีวิว — rating ขึ้นเป็น 4.8", action: "ขอ review จากนักเรียนปัจจุบันมากขึ้น" },
  { date: "2025-08-15", competitor: "Synthesia", type: "content", alert: "Reels ได้ 3K views — content style ได้ผล", action: "ลองทำ Reels style คล้ายกัน" },
  { date: "2025-08-12", competitor: "Piano Academy", type: "pricing", alert: "ลดราคาจาก ฿27,000 เหลือ ฿25,000", action: "ไม่ลดราคา — เน้น value instead" },
];

const TYPE_MAP: Record<string, { label: string; variant: "danger" | "warning" | "info" | "outline" | "success" }> = {
  pricing: { label: "💰 Pricing", variant: "warning" },
  content: { label: "📝 Content", variant: "info" },
  review: { label: "⭐ Review", variant: "success" },
  feature: { label: "🆕 Feature", variant: "danger" },
};

export default function CompetitiveIntelPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-secondary">🏆 Competitive Intelligence</h1>
        <p className="text-sm text-secondary/50">AI สอดแนมคู่แข่งอัตโนมัติ — รู้ก่อน ชนะก่อน</p></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">คู่แข่งที่ติดตาม</p><p className="text-2xl font-bold text-secondary">{COMPETITORS.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Alerts สัปดาห์นี้</p><p className="text-2xl font-bold text-amber-600">{ALERTS.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Threat Level</p><p className="text-2xl font-bold text-red-500">Medium</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Our Advantage</p><p className="text-2xl font-bold text-emerald-600">3</p></CardContent></Card>
      </div>

      {/* Competitors */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary-accent" />Competitor Profiles</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {COMPETITORS.sort((a, b) => b.rating - a.rating).map((c) => (
            <div key={c.name} className="rounded-xl border border-line/10 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-secondary">{c.name}</p>
                  <p className="text-[10px] text-secondary/40">{c.platform} · {c.followers.toLocaleString()} followers · ⭐ {c.rating} ({c.reviewCount} reviews)</p></div>
                <Badge variant={c.threat === "high" ? "danger" : c.threat === "medium" ? "warning" : "outline"} className="text-[9px]">
                  {c.threat === "high" ? "🔴 High Threat" : c.threat === "medium" ? "🟡 Medium" : "🟢 Low"}
                </Badge>
              </div>
              <p className="text-xs text-secondary/50">💰 {c.pricing}</p>
              <p className="text-xs text-secondary/50">📋 {c.recentActivity}</p>
              <div className="rounded-lg bg-emerald-50/5 p-2"><p className="text-[10px] text-emerald-600">✅ จุดเด่นของเรา: {c.ourAdvantage}</p></div>
            </div>
          ))}
        </CardContent></Card>

      {/* Alerts */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Intel Alerts</CardTitle><CardDescription>AI ตรวจจับการเปลี่ยนแปลงของคู่แข่ง</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {ALERTS.map((alert, i) => {
            const typeCfg = TYPE_MAP[alert.type] ?? { label: alert.type, variant: "outline" as const };
            return (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-line/10 p-3">
                <Badge variant={typeCfg.variant} className="text-[9px] shrink-0">{typeCfg.label}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-secondary">{alert.competitor} — {alert.date}</p>
                  <p className="text-[10px] text-secondary/40">{alert.alert}</p>
                  <p className="text-[10px] text-emerald-600 mt-1">💡 {alert.action}</p>
                </div>
              </div>
            );
          })}
        </CardContent></Card>
    </div>
  );
}
