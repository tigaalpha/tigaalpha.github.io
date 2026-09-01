"use client";

import { useEffect, useState, useMemo } from "react";
import { Brain, Users, TrendingUp, Target, Zap, AlertTriangle, Check, ArrowUpRight, ArrowDownRight, Star, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface LeadScore {
  id: string;
  name: string;
  score: number;
  trend: "up" | "down" | "stable";
  source: string;
  daysInPipeline: number;
  predictedAction: string;
  confidence: number;
  factors: { label: string; impact: number }[];
  recommendedAction: string;
  salesStatus: string;
  lastContactAt: string | null;
  createdAt: string;
}

const SCORE_COLOR = (score: number) => score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-500";
const SCORE_BG = (score: number) => score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
const SCORE_VARIANT = (score: number): "success" | "warning" | "danger" => score >= 80 ? "success" : score >= 60 ? "warning" : "danger";

function calculateLeadScore(lead: any): LeadScore {
  const now = new Date();
  const createdAt = new Date(lead.created_at);
  const lastContact = lead.last_contact_at ? new Date(lead.last_contact_at) : createdAt;
  const daysInPipeline = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceContact = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
  
  let score = 50; // Base score
  const factors: { label: string; impact: number }[] = [];
  
  // Source quality factor
  const sourceScores: Record<string, number> = {
    referral: 25,
    line_oa: 20,
    facebook: 15,
    google: 12,
    tiktok: 10,
    instagram: 8,
    landing_page: 5,
    quiz: 15,
  };
  const sourceScore = sourceScores[lead.lead_source?.toLowerCase()] || 5;
  score += sourceScore;
  if (sourceScore > 10) factors.push({ label: `แหล่งที่มาดี (${lead.lead_source})`, impact: sourceScore });
  
  // Recency factor
  if (daysSinceContact <= 1) { score += 20; factors.push({ label: "ติดต่อล่าสุด", impact: 20 }); }
  else if (daysSinceContact <= 3) { score += 10; factors.push({ label: "ติดต่อภายใน 3 วัน", impact: 10 }); }
  else if (daysSinceContact <= 7) { score += 5; }
  else { score -= 15; factors.push({ label: `ไม่ติดต่อ ${daysSinceContact} วัน`, impact: -15 }); }
  
  // Pipeline duration factor
  if (daysInPipeline <= 3) { score += 15; factors.push({ label: "lead ใหม่ (3 วัน)", impact: 15 }); }
  else if (daysInPipeline <= 7) { score += 10; }
  else if (daysInPipeline <= 14) { score += 5; }
  else { score -= 10; factors.push({ label: `ในระบบ ${daysInPipeline} วัน`, impact: -10 }); }
  
  // Sales status factor
  const statusScores: Record<string, number> = {
    hot: 25,
    warm: 15,
    trial: 20,
    proposal: 10,
    cold: -10,
    lost: -30,
    won: 0,
  };
  const statusScore = statusScores[lead.sales_status] || 0;
  score += statusScore;
  if (statusScore !== 0) factors.push({ label: `สถานะ: ${lead.sales_status}`, impact: statusScore });
  
  // Phone number factor (more complete data = more serious)
  if (lead.phone) { score += 5; factors.push({ label: "มีเบอร์โทร", impact: 5 }); }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Determine predicted action and confidence
  let predictedAction = "ติดตามต่อ";
  let recommendedAction = "ส่งข้อความทักทาย";
  const confidence = Math.min(95, Math.max(30, score));
  
  if (score >= 80) {
    predictedAction = "ซื้อภายใน 3 วัน";
    recommendedAction = "จอง trial ให้เลย";
  } else if (score >= 60) {
    predictedAction = "ซื้อภายใน 7 วัน";
    recommendedAction = "ส่งรีวิวนักเรียน";
  } else if (score >= 40) {
    predictedAction = "ตัดสินใจภายใน 14 วัน";
    recommendedAction = "ส่งเปรียบเทียบราคา";
  } else {
    predictedAction = "อาจไม่ซื้อ";
    recommendedAction = "ส่ง content สร้างแรงบันดาลใจ";
  }
  
  // Trend based on recency
  const trend = daysSinceContact <= 2 ? "up" : daysSinceContact >= 7 ? "down" : "stable";
  
  return {
    id: lead.id,
    name: lead.name || "ไม่ระบุชื่อ",
    score,
    trend,
    source: lead.lead_source || "Unknown",
    daysInPipeline,
    predictedAction,
    confidence,
    factors,
    recommendedAction,
    salesStatus: lead.sales_status || "new",
    lastContactAt: lead.last_contact_at,
    createdAt: lead.created_at,
  };
}

export default function PredictiveScoringPage() {
  const [leads, setLeads] = useState<LeadScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");

  async function loadLeads() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const customers = await repos.customers.listPipeline();
      const scoredLeads = customers
        .filter(c => c.sales_status !== "won" && c.sales_status !== "lost")
        .map(calculateLeadScore)
        .sort((a, b) => b.score - a.score);
      setLeads(scoredLeads);
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLeads(); }, []);

  const filteredLeads = useMemo(() => {
    if (filter === "all") return leads;
    if (filter === "high") return leads.filter(l => l.score >= 80);
    if (filter === "medium") return leads.filter(l => l.score >= 50 && l.score < 80);
    return leads.filter(l => l.score < 50);
  }, [leads, filter]);

  const avgScore = leads.length > 0 ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0;
  const highScore = leads.filter(l => l.score >= 80).length;
  const predictedConversions = leads.filter(l => l.score >= 70).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🔮 Predictive Lead Scoring</h1>
          <p className="text-sm text-secondary/50">AI ทำนายว่า lead คนไหนจะซื้อ — ข้อมูลจริงจาก CRM</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadLeads} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Lead ทั้งหมด</p><p className="text-2xl font-bold text-secondary">{leads.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">คะแนนเฉลี่ย</p><p className={cn("text-2xl font-bold", SCORE_COLOR(avgScore))}>{avgScore}/100</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">High Score (80+)</p><p className="text-2xl font-bold text-emerald-600">{highScore}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Predicted Conversion</p><p className="text-2xl font-bold text-primary">{predictedConversions} คน</p></CardContent></Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {(["all", "high", "medium", "low"] as const).map(f => (
          <Button key={f} variant={filter === f ? "primary" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "all" ? "ทั้งหมด" : f === "high" ? "🔥 High (80+)" : f === "medium" ? "⚡ Medium (50-79)" : "❄️ Low (<50)"}
          </Button>
        ))}
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary-accent" />AI Lead Scores</CardTitle><CardDescription>เรียงตามคะแนนสูงสุด — ข้อมูลจริงจาก Supabase CRM</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-secondary/50">กำลังโหลดข้อมูล...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-8 text-secondary/50">ไม่มี lead ในระบบ</div>
          ) : (
            filteredLeads.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-line/10 p-4">
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
                  <Badge variant="outline" className="text-[9px]">{lead.salesStatus}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent></Card>
    </div>
  );
}
