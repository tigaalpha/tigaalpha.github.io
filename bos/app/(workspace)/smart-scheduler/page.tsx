"use client";

import { Calendar, Clock, Users, AlertTriangle, TrendingUp, Zap, Check, ArrowRight, Sparkles, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NoShowRisk {
  name: string;
  risk: number;
  reason: string;
  suggestedAction: string;
}

const NO_SHOW_RISKS: NoShowRisk[] = [
  { name: "คุณกมล", risk: 85, reason: "ไม่มา 2 ครั้งล่าสุด, มักไม่มาจันทร์เช้า", suggestedAction: "ย้ายไปพุธเย็น + ส่ง reminder ก่อน 24h" },
  { name: "คุณพงศ์", risk: 60, reason: "เคยเลื่อน 1 ครั้ง, ตารางแน่น", suggestedAction: "ส่ง LINE reminder ก่อน 2h" },
  { name: "คุณจินดา", risk: 30, reason: "มาสม่ำเสมอ แต่ช่วงนี้งานยุ่ง", suggestedAction: "ถามว่ายังสะดวกอยู่ไหม" },
];

interface SlotSuggestion {
  time: string;
  teacher: string;
  available: number;
  suggestedFor: string;
  reason: string;
}

const SLOT_SUGGESTIONS: SlotSuggestion[] = [
  { time: "จันทร์ 10:00", teacher: "ครูอาม", available: 2, suggestedFor: "Lead ใหม่", reason: "ช่วงเวลานี้ lead ตอบรับดีที่สุด" },
  { time: "พุธ 14:00", teacher: "ครูนา", available: 1, suggestedFor: "คุณกมล (ย้าย)", reason: "ลด no-show risk จาก 85% เหลือ 20%" },
  { time: "ศุกร์ 18:00", teacher: "ครูอาม", available: 3, suggestedFor: "วัยทำงาน", reason: "หลังเลิกงาน — peak time" },
  { time: "เสาร์ 10:00", teacher: "ครูนา", available: 2, suggestedFor: "เด็ก/คุณแม่", reason: "วันหยุด — คุณแม่พาลูกมา" },
];

interface TeacherLoad {
  name: string;
  lessonsPerWeek: number;
  maxCapacity: number;
  utilization: number;
  burnoutRisk: "low" | "medium" | "high";
}

const TEACHERS: TeacherLoad[] = [
  { name: "ครูอาม", lessonsPerWeek: 18, maxCapacity: 25, utilization: 72, burnoutRisk: "low" },
  { name: "ครูนา", lessonsPerWeek: 22, maxCapacity: 25, utilization: 88, burnoutRisk: "medium" },
];

export default function SmartSchedulerPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-secondary">📅 Smart Scheduler</h1>
        <p className="text-sm text-secondary/50">AI จัดตารางอัจฉริยะ — ลด no-show, เพิ่ม utilization, ป้องกัน burnout</p></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">No-Show Rate</p><p className="text-2xl font-bold text-amber-600">8%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Empty Slots</p><p className="text-2xl font-bold text-secondary">8</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Utilization</p><p className="text-2xl font-bold text-primary">78%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">AI Suggestions</p><p className="text-2xl font-bold text-emerald-600">{SLOT_SUGGESTIONS.length + NO_SHOW_RISKS.length}</p></CardContent></Card>
      </div>

      {/* No-Show Risk */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />No-Show Risk Prediction</CardTitle><CardDescription>AI ทำนายว่าใครจะไม่มา — พร้อม action แนะนำ</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {NO_SHOW_RISKS.sort((a, b) => b.risk - a.risk).map((risk) => (
            <div key={risk.name} className={cn("rounded-xl border p-3", risk.risk >= 70 ? "border-red-200/30 bg-red-50/5" : risk.risk >= 50 ? "border-amber-200/30 bg-amber-50/5" : "border-line/10")}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-secondary">{risk.name}</span>
                <Badge variant={risk.risk >= 70 ? "danger" : risk.risk >= 50 ? "warning" : "outline"} className="text-[9px]">{risk.risk}% risk</Badge>
              </div>
              <p className="text-[10px] text-secondary/40 mb-1">💬 {risk.reason}</p>
              <p className="text-[10px] text-emerald-600">💡 {risk.suggestedAction}</p>
            </div>
          ))}
        </CardContent></Card>

      {/* Empty Slot Suggestions */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary-accent" />AI Slot Suggestions</CardTitle><CardDescription>แนะนำว่าช่วงว่างควรเสนอให้ใคร</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {SLOT_SUGGESTIONS.map((slot, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-line/10 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clock className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary">{slot.time} · {slot.teacher}</p>
                <p className="text-[10px] text-secondary/40">เสนอให้: {slot.suggestedFor} — {slot.reason}</p>
              </div>
              <Badge variant="outline" className="text-[9px]">{slot.available} ที่ว่าง</Badge>
            </div>
          ))}
        </CardContent></Card>

      {/* Teacher Load */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary-accent" />Teacher Workload</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {TEACHERS.map((t) => (
            <div key={t.name} className="rounded-xl border border-line/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-secondary">{t.name}</span>
                <Badge variant={t.burnoutRisk === "high" ? "danger" : t.burnoutRisk === "medium" ? "warning" : "success"} className="text-[9px]">
                  {t.burnoutRisk === "high" ? "⚠️ Burnout Risk" : t.burnoutRisk === "medium" ? "⚡ Moderate" : "✅ Good"}
                </Badge>
              </div>
              <div className="h-3 rounded-full bg-line/5 overflow-hidden">
                <div className={cn("h-full rounded-full", t.utilization >= 85 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${t.utilization}%` }} />
              </div>
              <p className="text-[10px] text-secondary/40 mt-1">{t.lessonsPerWeek}/{t.maxCapacity} บทเรียน/สัปดาห์ ({t.utilization}%)</p>
            </div>
          ))}
        </CardContent></Card>
    </div>
  );
}
