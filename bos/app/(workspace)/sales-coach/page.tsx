"use client";

import { useState } from "react";
import { GraduationCap, Target, TrendingUp, Check, AlertTriangle, MessageSquare, BarChart3, Sparkles, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CoachingTip {
  category: string;
  tip: string;
  impact: string;
  example: string;
}

const TIPS: CoachingTip[] = [
  { category: "Opening", tip: "ถามเป้าหมายก่อนเสนอราคา", impact: "+15% conversion", example: "✅ 'น้องอยากเรียนเปียโนเพราะอะไรคะ?' → เสนอคอร์สที่ตรงเป้า\n❌ 'คอร์ส 40 ชั่วโมง ราคา ฿27,000 ค่ะ'" },
  { category: "Objection", tip: "Validate → Isolate → Reframe", impact: "+20% closing", example: "✅ 'เข้าใจค่ะ ฿27,000 ดูเยอะ — แต่ถ้าเทียบ ฿675/ชม. กับ result ที่ได้...'\n❌ 'ไม่แพงเลยค่ะ ที่อื่นยังแพงกว่า'" },
  { category: "Closing", tip: "เสนอ specific next step", impact: "+25% booking", example: "✅ 'วันเสาร์ 10:00 มีว่างอยู่ค่ะ — จองให้เลยไหม?'\n❌ 'ลองมาดูนะคะ'" },
  { category: "Follow-up", tip: "ส่ง within 24h หลัง trial", impact: "+30% conversion", example: "✅ ส่ง LINE: 'เป็นยังไงบ้างคะ? ชอบไหม? 🎹'\n❌ รอ 3-4 วัน ค่อย follow up" },
];

interface SkillScore {
  skill: string;
  score: number;
  previousScore: number;
  trend: "up" | "down" | "stable";
}

const SKILLS: SkillScore[] = [
  { skill: "Opening (ถามเป้าหมาย)", score: 85, previousScore: 70, trend: "up" },
  { skill: "Objection Handling", score: 72, previousScore: 65, trend: "up" },
  { skill: "Closing (ปิดการขาย)", score: 78, previousScore: 80, trend: "down" },
  { skill: "Follow-up Timing", score: 90, previousScore: 75, trend: "up" },
  { skill: "Product Knowledge", score: 95, previousScore: 95, trend: "stable" },
  { skill: "Empathy / Listening", score: 88, previousScore: 82, trend: "up" },
];

const OBJECTIONS = [
  { objection: "แพงไป", correctResponse: "เข้าใจค่ะ — แต่เทียบกับ ฿675/ชม. ไม่แพงเลยนะคะ แถมได้ skill ตลอดชีวิต", wrongResponse: "ไม่แพงค่ะ ที่อื่นยังแพงกว่า", score: 85 },
  { objection: "ต้องถามสามีก่อน", correctResponse: "ได้ค่ะ ส่งข้อมูลสรุปให้คุณสามีดูเลยไหม? จะได้ตัดสินใจง่ายขึ้น", wrongResponse: "ได้ค่ะ ไว้ค่อยมาใหม่นะคะ", score: 70 },
  { objection: "เปรียบเทียบกับที่อื่น", correctResponse: "เปรียบเทียบได้เลยค่ะ — จุดเด่นของเราคือครูตัวต่อตัว + track ชั่วโมงชัดเจน", wrongResponse: "ของเราดีกว่าค่ะ", score: 60 },
];

export default function SalesCoachPage() {
  const avgSkill = Math.round(SKILLS.reduce((s, sk) => s + sk.score, 0) / SKILLS.length);
  const overallTrend = SKILLS.filter((s) => s.trend === "up").length > SKILLS.filter((s) => s.trend === "down").length ? "up" : "down";

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-secondary">🎓 AI Sales Coach</h1>
        <p className="text-sm text-secondary/50">AI วิเคราะห์เทคนิคขาย + ฝึกจัดการข้อโต้แย้ง + ให้คะแนนทักษะ</p></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Skill Score</p><p className={cn("text-2xl font-bold", overallTrend === "up" ? "text-emerald-600" : "text-red-500")}>{avgSkill}/100</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Tips ที่ทำได้ดี</p><p className="text-2xl font-bold text-emerald-600">{SKILLS.filter((s) => s.trend === "up").length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">ต้องปรับปรุง</p><p className="text-2xl font-bold text-amber-600">{SKILLS.filter((s) => s.trend === "down").length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Practice Score</p><p className="text-2xl font-bold text-primary">72/100</p></CardContent></Card>
      </div>

      {/* Skill Radar */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary-accent" />ทักษะขายแยกตามหัวข้อ</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {SKILLS.map((skill) => (
            <div key={skill.skill} className="flex items-center gap-3">
              <span className="w-40 text-xs text-secondary">{skill.skill}</span>
              <div className="flex-1 h-4 rounded-full bg-line/5 overflow-hidden">
                <div className={cn("h-full rounded-full", skill.score >= 80 ? "bg-emerald-500" : skill.score >= 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${skill.score}%` }} />
              </div>
              <span className="w-8 text-right text-xs font-bold text-secondary">{skill.score}</span>
              {skill.trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
              {skill.trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
            </div>
          ))}
        </CardContent></Card>

      {/* Coaching Tips */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary-accent" />Coaching Tips — สิ่งที่ควรทำ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {TIPS.map((tip, i) => (
            <div key={i} className="rounded-xl border border-emerald-200/30 bg-emerald-50/5 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="success" className="text-[9px]">{tip.category}</Badge>
                <span className="text-xs text-emerald-600">{tip.impact}</span>
              </div>
              <p className="text-sm font-medium text-secondary mb-2">{tip.tip}</p>
              <pre className="text-[10px] text-secondary/50 whitespace-pre-wrap">{tip.example}</pre>
            </div>
          ))}
        </CardContent></Card>

      {/* Objection Practice */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary-accent" />ฝึกจัดการข้อโต้แย้ง</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {OBJECTIONS.map((obj, i) => (
            <div key={i} className="rounded-xl border border-line/10 p-4 space-y-2">
              <p className="text-sm font-medium text-secondary">💬 "{obj.objection}"</p>
              <div className="rounded-lg bg-emerald-50/5 p-2"><p className="text-[10px] text-emerald-600">✅ ถูกต้อง: {obj.correctResponse}</p></div>
              <div className="rounded-lg bg-red-50/5 p-2"><p className="text-[10px] text-red-500">❌ ไม่ควร: {obj.wrongResponse}</p></div>
              <Badge variant="outline" className="text-[9px]">Score: {obj.score}/100</Badge>
            </div>
          ))}
        </CardContent></Card>
    </div>
  );
}
