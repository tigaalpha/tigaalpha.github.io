"use client";

import { useState } from "react";
import { FlaskConical, Trophy, BarChart3, Clock, Users, MousePointerClick, TrendingUp, Sparkles, Check, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ABTest {
  id: string;
  name: string;
  platform: string;
  status: "running" | "completed" | "draft";
  startDate: string;
  daysRunning: number;
  variants: { name: string; content: string; impressions: number; clicks: number; ctr: number; conversions: number; winner?: boolean }[];
}

const TESTS: ABTest[] = [
  { id: "1", name: "Ad Copy — เรียนฟรี vs ทดลองฟรี", platform: "Facebook", status: "running", startDate: "2025-08-18", daysRunning: 3,
    variants: [
      { name: "A: 'เรียนเปียโนฟรี!'", content: "🎹 เรียนเปียโนฟรี! ไม่ต้องมีพื้นฐาน ไม่ต้องมีเปียโน ทดลองเรียน 30 นาทีกับครูมืออาชีพ 📲 Line: @tigastudio", impressions: 2400, clicks: 120, ctr: 5.0, conversions: 8 },
      { name: "B: 'ทดลองฟรี 30 นาที'", content: "🎹 จองเรียนทดลองเปียโนฟรี 30 นาที! เลือกเวลาที่สะดวก ไม่มีข้อผูกมัด 📲 Line: @tigastudio", impressions: 2350, clicks: 145, ctr: 6.2, conversions: 12, winner: true },
    ]},
  { id: "2", name: "Video Hook — คำถาม vs ข้อเท็จจริง", platform: "TikTok", status: "completed", startDate: "2025-08-10", daysRunning: 10,
    variants: [
      { name: "A: 'เคยสงสัยไหม?'", content: "🎹 เคยสงสัยไหมว่า ทำไมเด็กบางคนเรียนเปียโนแล้วเก่งเร็ว?", impressions: 12400, clicks: 890, ctr: 7.2, conversions: 15 },
      { name: "B: 'แค่ 3 เดือน!'", content: "🎹 แค่ 3 เดือน! น้องวัย 8 ขวบเล่น Moonlight Sonata ได้แล้ว", impressions: 11800, clicks: 1120, ctr: 9.5, conversions: 22, winner: true },
    ]},
  { id: "3", name: "Landing Page CTA — สี vs ข้อความ", platform: "Google Ads", status: "running", startDate: "2025-08-19", daysRunning: 2,
    variants: [
      { name: "A: 'จองเลย' (ม่วง)", content: "ปุ่มสีม่วง ข้อความ 'จองเรียนทดลองเลย'", impressions: 800, clicks: 48, ctr: 6.0, conversions: 3 },
      { name: "B: 'ทดลองฟรี' (เขียว)", content: "ปุ่มสีเขียว ข้อความ 'ทดลองฟรี ไม่มีค่าใช้จ่าย'", impressions: 820, clicks: 62, ctr: 7.6, conversions: 5, winner: true },
    ]},
];

export default function ABTestAIPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-secondary">🧪 A/B Test AI</h1>
        <p className="text-sm text-secondary/50">AI สร้าง ad copy/content หลายแบบ → ทดสอบอัตโนมัติ → เลือกตัวที่ดีสุด</p></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Tests ทั้งหมด</p><p className="text-2xl font-bold text-secondary">{TESTS.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Running</p><p className="text-2xl font-bold text-amber-600">{TESTS.filter((t) => t.status === "running").length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Completed</p><p className="text-2xl font-bold text-emerald-600">{TESTS.filter((t) => t.status === "completed").length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Avg CTR Lift</p><p className="text-2xl font-bold text-primary">+38%</p></CardContent></Card>
      </div>

      {TESTS.map((test) => (
        <Card key={test.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary-accent" />
              {test.name}
              <Badge variant={test.status === "running" ? "warning" : test.status === "completed" ? "success" : "outline"} className="text-[9px]">
                {test.status === "running" ? `กำลังทดสอบ (${test.daysRunning} วัน)` : test.status === "completed" ? "เสร็จแล้ว" : "Draft"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {test.variants.map((v, i) => (
              <div key={i} className={cn("rounded-xl border p-4", v.winner ? "border-emerald-200/30 bg-emerald-50/5" : "border-line/10")}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-secondary">{v.name}</span>
                    {v.winner && <Badge variant="success" className="text-[9px]">🏆 Winner</Badge>}
                  </div>
                  <span className="text-xs font-bold text-primary">CTR {v.ctr}%</span>
                </div>
                <p className="text-xs text-secondary/50 mb-3 whitespace-pre-wrap">{v.content}</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-line/5 p-2"><p className="text-xs font-bold text-secondary">{v.impressions.toLocaleString()}</p><p className="text-[9px] text-secondary/40">Impressions</p></div>
                  <div className="rounded-lg bg-line/5 p-2"><p className="text-xs font-bold text-secondary">{v.clicks}</p><p className="text-[9px] text-secondary/40">Clicks</p></div>
                  <div className="rounded-lg bg-line/5 p-2"><p className="text-xs font-bold text-primary">{v.ctr}%</p><p className="text-[9px] text-secondary/40">CTR</p></div>
                  <div className="rounded-lg bg-emerald-50/5 p-2"><p className="text-xs font-bold text-emerald-600">{v.conversions}</p><p className="text-[9px] text-secondary/40">Conversions</p></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
