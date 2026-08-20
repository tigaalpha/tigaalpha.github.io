"use client";

import { UserCheck, Sparkles, MessageSquare, Target, Users, TrendingUp, Zap, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PersonProfile {
  name: string;
  segment: string;
  age: number;
  goal: string;
  channel: string;
  personality: string;
  bestTime: string;
  personalizedMessage: string;
  conversionLikelihood: number;
}

const PROFILES: PersonProfile[] = [
  { name: "คุณแม่วรรณ", segment: "คุณแม่ลูกเล็ก", age: 34, goal: "พัฒนาการลูก", channel: "LINE", personality: "เน้นครอบครัว", bestTime: "20:00-21:00", personalizedMessage: "สวัสดีค่ะคุณแม่วรรณ 🎹 น้องทiantianชอบเพลง Frozen มากเลยนะคะ — เรียนเปียโนก็จะเล่นเพลงที่ชอบได้เลยค่ะ! ลองจองทดลองฟรี 30 นาทีนะคะ 💕", conversionLikelihood: 85 },
  { name: "คุณต้น_Working", segment: "วัยทำงาน", age: 28, goal: "ผ่อนคลาย", channel: "Web", personality: "เน้น work-life balance", bestTime: "18:00-19:00", personalizedMessage: "ทำงานเหนื่อยไหมคะ 🎵 เล่นเปียโนเป็นวิธีผ่อนคลายที่ดีมากเลยค่ะ — เรียนแค่สัปดาห์ละ 1 ชั่วโมงก็พอ ลองจองทดลองดูนะคะ", conversionLikelihood: 72 },
  { name: "น้องบีม_Student", segment: "นักเรียน", age: 16, goal: "สอบ + ทุน", channel: "TikTok", personality: "เน้นเป้าหมาย", bestTime: "15:00-16:00", personalizedMessage: "อยากสอบเปียโน拿到ทุนไหม 🎓 TIGA มีแผนเตรียมสอบ Trinity + ABRSM ช่วยได้ค่ะ! เริ่มจากการทดลองฟรี 30 นาที 📲", conversionLikelihood: 68 },
  { name: "คุณสมชาย_Senior", segment: "วัยเกษียณ", age: 62, goal: "งานอดิเรก", channel: "LINE", personality: "เน้นสุขภาพจิต", bestTime: "10:00-11:00", personalizedMessage: "คุณสมชายคะ 🎹 เล่นเปียโนช่วยบำรุงสมองได้ดีมากเลยนะคะ — มีนักเรียนอายุ 60+ หลายคนเรียนแล้วมีความสุขมากค่ะ ลองมาดูนะคะ", conversionLikelihood: 55 },
];

const SEGMENT_COLORS: Record<string, string> = {
  "คุณแม่ลูกเล็ก": "bg-pink-500",
  "วัยทำงาน": "bg-blue-500",
  "นักเรียน": "bg-emerald-500",
  "วัยเกษียณ": "bg-amber-500",
};

export default function PersonalizationEnginePage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-secondary">💬 Personalization Engine</h1>
        <p className="text-sm text-secondary/50">AI ปรับข้อความตามบุคคล — ไม่เท่ากันทุกคน แต่โดนใจแต่ละคน</p></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Segments</p><p className="text-2xl font-bold text-secondary">4</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Personalized Msgs</p><p className="text-2xl font-bold text-primary">{PROFILES.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Avg Conv. Likelihood</p><p className="text-2xl font-bold text-emerald-600">70%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">vs Generic</p><p className="text-2xl font-bold text-amber-600">+45%</p></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary-accent" />AI Personalized Messages</CardTitle><CardDescription>แต่ละคนได้ข้อความต่างกัน — ตาม age, goal, personality, channel</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {PROFILES.map((p) => (
            <div key={p.name} className="rounded-xl border border-line/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold", SEGMENT_COLORS[p.segment] ?? "bg-gray-400")}>{p.name.charAt(0)}</div>
                  <div><p className="text-sm font-medium text-secondary">{p.name}</p>
                    <p className="text-[10px] text-secondary/40">{p.segment} · อายุ {p.age} · {p.goal} · {p.channel}</p></div>
                </div>
                <Badge variant={p.conversionLikelihood >= 80 ? "success" : p.conversionLikelihood >= 60 ? "info" : "outline"} className="text-[9px]">{p.conversionLikelihood}% conv.</Badge>
              </div>
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                <p className="text-xs text-secondary/40 mb-1">📝 ข้อความที่ AI ปรับเฉพาะ:</p>
                <p className="text-sm text-secondary">{p.personalizedMessage}</p>
              </div>
              <div className="flex gap-2 text-[10px] text-secondary/40">
                <span>⏰ เวลาที่ดีสุด: {p.bestTime}</span>
                <span>·</span>
                <span>🧠 Style: {p.personality}</span>
              </div>
            </div>
          ))}
        </CardContent></Card>
    </div>
  );
}
