"use client";

import { useState } from "react";
import { Brain, Users, TrendingUp, Target, Zap, AlertTriangle, Check, ArrowUpRight, ArrowDownRight, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LeadScore {
  name: string;
  score: number;
  trend: "up" | "down" | "stable";
  source: string;
  daysInPipeline: number;
  predictedAction: string;
  confidence: number;
  factors: { label: string; impact: number }[];
  recommendedAction: string;
}

const LEADS: LeadScore[] = [
  { name: "คุณพิชัย", score: 92, trend: "up", source: "Facebook", daysInPipeline: 3, predictedAction: "ซื้อภายใน 3 วัน", confidence: 92, factors: [{ label: "ตอบ LINE ไว", impact: 25 }, { label: "ถามราคา 2 ครั้ง", impact: 20 }, { label: "ดูเว็บ 5 หน้า", impact: 15 }, { label: "อายุ 35 (target)", impact: 12 }], recommendedAction: "ส่งข้อความส่วนลด 10% ตอนนี้" },
  { name: "คุณสุภาพร", score: 78, trend: "up", source: "TikTok", daysInPipeline: 5, predictedAction: "ซื้อภายใน 7 วัน", confidence: 78, factors: [{ label: "ทำ Quiz เสร็จ", impact: 22 }, { label: "เปิด LINE ทุกวัน", impact: 18 }, { label: "ดูรีวิว 3 คลิป", impact: 12 }], recommendedAction: "ส่งรีวิวนักเรียน相似 profile" },
  { name: "คุณจินดา", score: 65, trend: "stable", source: "Google", daysInPipeline: 8, predictedAction: "ตัดสินใจภายใน 14 วัน", confidence: 65, factors: [{ label: "ค้นหาจาก Google", impact: 20 }, { label: "ถามเรื่อง schedule", impact: 15 }, { label: "เปรียบเทียบ 3 ที่", impact: 10 }], recommendedAction: "ส่งเปรียบเทียบราคา + จุดเด่น" },
  { name: "คุณนภา", score: 45, trend: "down", source: "LINE", daysInPipeline: 12, predictedAction: "อาจไม่ซื้อ", confidence: 55, factors: [{ label: "ไม่ตอบ 5 วัน", impact: -20 }, { label: "เปิด LINE น้อยลง", impact: -15 }, { label: "ถามราคาครั้งเดียว", impact: 5 }], recommendedAction: "ส่ง content สร้างแรงบันดาลใจ" },
  { name: "คุณรัตนา", score: 88, trend: "up", source: "Referral", daysInPipeline: 2, predictedAction: "ซื้อภายใน 2 วัน", confidence: 88, factors: [{ label: "มาจาก Referral", impact: 25 }, { label: "ถามรายละเอียดทันที", impact: 20 }, { label: "มีเป้าหมายชัด", impact: 18 }], recommendedAction: "จอง trial ให้เลย" },
];

const SCORE_COLOR = (score: number) => score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-500";
const SCORE_BG = (score: number) => score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
const SCORE_VARIANT = (score: number): "success" | "warning" | "danger" => score >= 80 ? "success" : score >= 60 ? "warning" : "danger";

export default function PredictiveScoringPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const avgScore = Math.round(LEADS.reduce((s, l) => s + l.score, 0) / LEADS.length);
  const highScore = LEADS.filter((l) => l.score >= 80).length;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-secondary">🔮 Predictive Lead Scoring</h1>
        <p className="text-sm text-secondary/50">AI ทำนายว่า lead คนไหนจะซื้อ — พร้อมปัจจัยและ action แนะนำ</p></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Lead ทั้งหมด</p><p className="text-2xl font-bold text-secondary">{LEADS.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">คะแนนเฉลี่ย</p><p className={cn("text-2xl font-bold", SCORE_COLOR(avgScore))}>{avgScore}/100</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">High Score (80+)</p><p className="text-2xl font-bold text-emerald-600">{highScore}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Predicted Conversion</p><p className="text-2xl font-bold text-primary">3 คน</p></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary-accent" />AI Lead Scores</CardTitle><CardDescription>เรียงตามคะแนนสูงสุด — คลิกดูปัจจัยและ action แนะนำ</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {LEADS.sort((a, b) => b.score - a.score).map((lead) => (
            <div key={lead.name} className="rounded-xl border border-line/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="relative"><div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg", SCORE_BG(lead.score))}>{lead.score}</div></div>
                  <div><p className="text-sm font-medium text-secondary">{lead.name}</p>
                    <p className="text-[10px] text-secondary/40">{lead.source} · {lead.daysInPipeline} วัน · {lead.predictedAction}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  {lead.trend === "up" && <ArrowUpRight className="h-4 w-4 text-emerald-500" />}
                  {lead.trend === "down" && <ArrowDownRight className="h-4 w-4 text-red-500" />}
                  <Badge variant={SCORE_VARIANT(lead.score)} className="text-[9px]">{lead.confidence}% confidence</Badge>
                </div>
              </div>
              <div className="h-2 rounded-full bg-line/5 overflow-hidden mb-2">
                <div className={cn("h-full rounded-full", SCORE_BG(lead.score))} style={{ width: `${lead.score}%` }} />
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {lead.factors.map((f, i) => (
                  <Badge key={i} variant="outline" className="text-[9px]">{f.label} ({f.impact > 0 ? "+" : ""}{f.impact})</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600">💡 {lead.recommendedAction}</span>
                <Button size="sm" variant="ghost">ดำเนินการ</Button>
              </div>
            </div>
          ))}
        </CardContent></Card>
    </div>
  );
}
