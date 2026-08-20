"use client";

import { useState } from "react";
import {
  Target,
  Users,
  Trophy,
  BarChart3,
  TrendingUp,
  ExternalLink,
  Copy,
  Check,
  Eye,
  MousePointerClick,
  UserPlus,
  Calendar,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QuizResult {
  level: string;
  label: string;
  color: string;
  bgColor: string;
  count: number;
  percentage: number;
  recommendedCourse: string;
  conversionRate: number;
}

const QUIZ_RESULTS: QuizResult[] = [
  { level: "beginner", label: "🌱 Beginner", color: "text-emerald-500", bgColor: "bg-emerald-500", count: 142, percentage: 53.2, recommendedCourse: "Piano Mindset (฿990)", conversionRate: 8.5 },
  { level: "elementary", label: "🎵 Elementary", color: "text-blue-500", bgColor: "bg-blue-500", count: 68, percentage: 25.5, recommendedCourse: "0 to HERO (฿1,490)", conversionRate: 12.3 },
  { level: "intermediate", label: "🎹 Intermediate", color: "text-purple-500", bgColor: "bg-purple-500", count: 38, percentage: 14.2, recommendedCourse: "Private Course (฿27,000)", conversionRate: 18.4 },
  { level: "advanced", label: "🎼 Advanced", color: "text-amber-500", bgColor: "bg-amber-500", count: 19, percentage: 7.1, recommendedCourse: "Private Course + Jazz", conversionRate: 26.3 },
];

interface QuizFunnel {
  step: string;
  count: number;
  dropOff: number;
}

const QUIZ_FUNNEL: QuizFunnel[] = [
  { step: "เปิด Quiz", count: 890, dropOff: 0 },
  { step: "เริ่มทำ", count: 720, dropOff: 19.1 },
  { step: "ทำเสร็จ", count: 267, dropOff: 62.9 },
  { step: "กรอกชื่อ+เบอร์", count: 245, dropOff: 8.2 },
  { step: "สมัคร/จอง", count: 35, dropOff: 85.7 },
];

interface QuizLead {
  name: string;
  phone: string;
  level: string;
  date: string;
  source: string;
  status: "new" | "contacted" | "converted";
}

const RECENT_LEADS: QuizLead[] = [
  { name: "คุณกมล", phone: "081-xxx-xxx", level: "Beginner", date: "2025-08-20", source: "Facebook", status: "converted" },
  { name: "คุณสุภาพร", phone: "092-xxx-xxx", level: "Elementary", date: "2025-08-19", source: "TikTok", status: "contacted" },
  { name: "คุณพิชัย", phone: "085-xxx-xxx", level: "Beginner", date: "2025-08-19", source: "LINE", status: "new" },
  { name: "คุณจินดา", phone: "098-xxx-xxx", level: "Intermediate", date: "2025-08-18", source: "Google", status: "contacted" },
  { name: "คุณนภา", phone: "086-xxx-xxx", level: "Beginner", date: "2025-08-18", source: "Referral", status: "converted" },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  new: { label: "ใหม่", variant: "warning" },
  contacted: { label: "ติดต่อแล้ว", variant: "outline" },
  converted: { label: "สมัครแล้ว", variant: "success" },
};

export default function LeadQuizPage() {
  const totalTaken = QUIZ_RESULTS.reduce((s, r) => s + r.count, 0);
  const totalLeads = 245;
  const totalConversions = 35;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">🎵 Lead Magnet: Piano Level Quiz</h1>
        <p className="text-sm text-secondary/50">"ทดสอบระดับเปียโนของคุณ" — Quiz ที่ capture Lead เข้า CRM อัตโนมัติ</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">ทำ Quiz ทั้งหมด</p>
            <p className="text-2xl font-bold text-secondary">{totalTaken}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Lead ที่กรอกข้อมูล</p>
            <p className="text-2xl font-bold text-primary">{totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">สมัครจริง</p>
            <p className="text-2xl font-bold text-emerald-600">{totalConversions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Conversion Rate</p>
            <p className="text-2xl font-bold text-amber-600">{totalTaken > 0 ? ((totalConversions / totalTaken) * 100).toFixed(1) : 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Quiz Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary-accent" />
            Quiz Funnel
          </CardTitle>
          <CardDescription>ขั้นตอนของ Quiz — เห็นว่าคนหลุดตรงไหนมากที่สุด</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {QUIZ_FUNNEL.map((step, i) => {
            const pct = QUIZ_FUNNEL[0].count > 0 ? (step.count / QUIZ_FUNNEL[0].count) * 100 : 0;
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                    <span className="font-medium text-secondary">{step.step}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-secondary/60">
                    <span className="font-semibold text-secondary">{step.count}</span>
                    <span>{pct.toFixed(1)}%</span>
                    {step.dropOff > 0 && <span className="text-red-400">-{step.dropOff}%</span>}
                  </div>
                </div>
                <div className="relative h-6 w-full overflow-hidden rounded-lg bg-line/5">
                  <div className="h-full rounded-lg bg-primary/60" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <div className="mt-2 rounded-xl bg-amber-50/5 p-3 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ <strong>Bottleneck:</strong> คนทำ Quiz เสร็จ แต่ไม่กรอกข้อมูล — ลองเสนอสิ่งจูงใจเพิ่ม เช่น "กรอกเบอร์ รับส่วนลด 20%"
          </div>
        </CardContent>
      </Card>

      {/* Quiz Results by Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary-accent" />
            ผลลัพธ์ Quiz แยกตาม Level
          </CardTitle>
          <CardDescription>แต่ละระดับแนะนำคอร์สต่างกัน — conversion rate ต่างกัน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {QUIZ_RESULTS.map((result) => (
            <div key={result.level} className="rounded-xl border border-line/10 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{result.label.split(" ")[0]}</span>
                  <span className="text-sm font-medium text-secondary">{result.label.split(" ").slice(1).join(" ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{result.count} คน ({result.percentage}%)</Badge>
                  <Badge variant={result.conversionRate > 15 ? "success" : result.conversionRate > 10 ? "info" : "outline"} className="text-[10px]">
                    Conv {result.conversionRate}%
                  </Badge>
                </div>
              </div>
              <div className="h-3 rounded-full bg-line/5 overflow-hidden">
                <div className={cn("h-full rounded-full", result.bgColor)} style={{ width: `${result.percentage}%`, opacity: 0.7 }} />
              </div>
              <p className="text-xs text-secondary/40">แนะนำ: <span className="font-medium text-secondary">{result.recommendedCourse}</span></p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Quiz Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-accent" />
            Lead ล่าสุดจาก Quiz
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {RECENT_LEADS.map((lead, i) => {
            const st = STATUS_MAP[lead.status] ?? STATUS_MAP.new;
            return (
              <div key={i} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-secondary">{lead.name}</p>
                    <Badge variant="outline" className="text-[9px]">{lead.level}</Badge>
                    <Badge variant={st.variant} className="text-[9px]">{st.label}</Badge>
                  </div>
                  <p className="text-[10px] text-secondary/30">{lead.date} · {lead.source}</p>
                </div>
                <Button size="sm" variant="ghost">ติดตาม</Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Share Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary-accent" />
            Share Quiz Links
          </CardTitle>
          <CardDescription>แชร์ Quiz ไปทุกช่องทาง — พร้อม UTM tracking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { channel: "Facebook", url: "https://tigaalpha.github.io/studio/quiz?utm_source=facebook&utm_medium=social", color: "bg-blue-600" },
            { channel: "TikTok", url: "https://tigaalpha.github.io/studio/quiz?utm_source=tiktok&utm_medium=social", color: "bg-black" },
            { channel: "LINE", url: "https://tigaalpha.github.io/studio/quiz?utm_source=line&utm_medium=organic", color: "bg-green-500" },
            { channel: "Instagram", url: "https://tigaalpha.github.io/studio/quiz?utm_source=instagram&utm_medium=social", color: "bg-pink-500" },
            { channel: "Google Ads", url: "https://tigaalpha.github.io/studio/quiz?utm_source=google&utm_medium=cpc", color: "bg-red-500" },
          ].map((link) => (
            <div key={link.channel} className="flex items-center gap-2 rounded-lg border border-line/10 px-3 py-2">
              <div className={cn("h-3 w-3 rounded-full", link.color)} />
              <span className="w-24 text-xs font-medium text-secondary">{link.channel}</span>
              <span className="flex-1 truncate text-[10px] text-secondary/40">{link.url}</span>
              <CopyButton value={link.url} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
