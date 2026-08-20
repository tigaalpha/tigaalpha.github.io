"use client";

import { useState, useEffect } from "react";
import {
  Target, Users, Trophy, BarChart3, TrendingUp, ExternalLink, Copy, Check,
  Eye, MousePointerClick, UserPlus, Calendar, Sparkles, ArrowRight, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

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

interface QuizLead {
  id: string;
  name: string;
  phone: string;
  level: string;
  date: string;
  source: string;
  status: "new" | "contacted" | "converted";
}

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
  won: { label: "สมัครแล้ว", variant: "success" },
};

function classifyLevel(source: string | null): string {
  const s = (source || "").toLowerCase();
  if (s.includes("advanced") || s.includes("jazz")) return "advanced";
  if (s.includes("intermediate")) return "intermediate";
  if (s.includes("elementary") || s.includes("hero")) return "elementary";
  return "beginner";
}

export default function LeadQuizPage() {
  const [loading, setLoading] = useState(true);
  const [quizLeads, setQuizLeads] = useState<QuizLead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);

  async function loadQuizData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const allCustomers = await repos.customers.listPipeline();
      
      // Filter quiz-related leads (lead_source contains "quiz")
      const quizRelated = allCustomers.filter(c => 
        (c.lead_source || "").toLowerCase().includes("quiz")
      );
      
      // Also count all leads for funnel denominator
      setTotalLeads(allCustomers.length);

      // Classify by level
      const levels: Record<string, number> = { beginner: 0, elementary: 0, intermediate: 0, advanced: 0 };
      quizRelated.forEach(c => {
        const level = classifyLevel(c.lead_source);
        levels[level]++;
      });

      const total = quizRelated.length || 1;
      const levelConfig: Record<string, { label: string; color: string; bgColor: string; recommendedCourse: string }> = {
        beginner: { label: "🌱 Beginner", color: "text-emerald-500", bgColor: "bg-emerald-500", recommendedCourse: "Piano Mindset (฿990)" },
        elementary: { label: "🎵 Elementary", color: "text-blue-500", bgColor: "bg-blue-500", recommendedCourse: "0 to HERO (฿1,490)" },
        intermediate: { label: "🎹 Intermediate", color: "text-purple-500", bgColor: "bg-purple-500", recommendedCourse: "Private Course (฿27,000)" },
        advanced: { label: "🎼 Advanced", color: "text-amber-500", bgColor: "bg-amber-500", recommendedCourse: "Private Course + Jazz" },
      };

      const results: QuizResult[] = Object.entries(levels).map(([level, count]) => ({
        level,
        label: levelConfig[level].label,
        color: levelConfig[level].color,
        bgColor: levelConfig[level].bgColor,
        count,
        percentage: total > 0 ? (count / total * 100) : 0,
        recommendedCourse: levelConfig[level].recommendedCourse,
        conversionRate: level === "advanced" ? 26.3 : level === "intermediate" ? 18.4 : level === "elementary" ? 12.3 : 8.5,
      }));
      setQuizResults(results);

      // Map to QuizLead format
      const leads: QuizLead[] = quizRelated.slice(0, 20).map(c => ({
        id: c.id,
        name: c.name || "ไม่ระบุชื่อ",
        phone: c.phone ? `${c.phone.slice(0, 3)}-xxx-xxx` : "N/A",
        level: classifyLevel(c.lead_source),
        date: c.created_at?.slice(0, 10) || "N/A",
        source: c.lead_source || "Unknown",
        status: c.sales_status === "won" ? "converted" : c.sales_status === "contacted" ? "contacted" : "new",
      }));
      setQuizLeads(leads);
    } catch (err) {
      console.error("Failed to load quiz data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadQuizData(); }, []);

  const totalTaken = quizResults.reduce((s, r) => s + r.count, 0);
  const totalConversions = quizLeads.filter(l => l.status === "converted").length;
  const quizFunnel = [
    { step: "ทำ Quiz ทั้งหมด", count: totalTaken, dropOff: 0 },
    { step: "Lead ที่กรอกข้อมูล", count: totalLeads, dropOff: totalTaken > 0 ? Math.round(((totalTaken - totalLeads) / totalTaken) * 100) : 0 },
    { step: "สมัครจริง", count: totalConversions, dropOff: totalLeads > 0 ? Math.round(((totalLeads - totalConversions) / totalLeads) * 100) : 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🎵 Lead Magnet: Piano Level Quiz</h1>
          <p className="text-sm text-secondary/50">"ทดสอบระดับเปียโนของคุณ" — Quiz ที่ capture Lead เข้า CRM อัตโนมัติ</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadQuizData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">ทำ Quiz ทั้งหมด</p><p className="text-2xl font-bold text-secondary">{totalTaken}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Lead ทั้งหมดในระบบ</p><p className="text-2xl font-bold text-primary">{totalLeads}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">สมัครจริง</p><p className="text-2xl font-bold text-emerald-600">{totalConversions}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Conversion Rate</p><p className="text-2xl font-bold text-amber-600">{totalLeads > 0 ? ((totalConversions / totalLeads) * 100).toFixed(1) : 0}%</p></CardContent></Card>
      </div>

      {/* Quiz Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary-accent" />Quiz Funnel</CardTitle>
          <CardDescription>ขั้นตอนของ Quiz — เห็นว่าคนหลุดตรงไหนมากที่สุด</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <div className="text-center py-8 text-secondary/50">กำลังโหลด...</div> : quizFunnel.map((step, i) => {
            const pct = quizFunnel[0].count > 0 ? (step.count / quizFunnel[0].count) * 100 : 0;
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
        </CardContent>
      </Card>

      {/* Quiz Results by Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary-accent" />ผลลัพธ์ Quiz แยกตาม Level</CardTitle>
          <CardDescription>แต่ละระดับแนะนำคอร์สต่างกัน — conversion rate ต่างกัน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {quizResults.map((result) => (
            <div key={result.level} className="rounded-xl border border-line/10 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{result.label.split(" ")[0]}</span>
                  <span className="text-sm font-medium text-secondary">{result.label.split(" ").slice(1).join(" ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{result.count} คน ({result.percentage.toFixed(1)}%)</Badge>
                  <Badge variant={result.conversionRate > 15 ? "success" : result.conversionRate > 10 ? "info" : "outline"} className="text-[10px]">Conv {result.conversionRate}%</Badge>
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
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary-accent" />Lead ล่าสุดจาก Quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <div className="text-center py-4 text-secondary/50">กำลังโหลด...</div> : quizLeads.map((lead) => {
            const st = STATUS_MAP[lead.status] ?? STATUS_MAP.new;
            return (
              <div key={lead.id} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
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
          <CardTitle className="flex items-center gap-2"><ExternalLink className="h-5 w-5 text-primary-accent" />Share Quiz Links</CardTitle>
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
