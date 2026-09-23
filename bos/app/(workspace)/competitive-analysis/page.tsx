"use client";

import { useEffect, useState } from "react";
import { Swords, TrendingUp, TrendingDown, Users, Eye, Target, RefreshCw, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface Competitor {
  id: string;
  name: string;
  type: "direct" | "indirect";
  followers: number;
  engagement: number;
  postsPerWeek: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threatLevel: "high" | "medium" | "low";
}

export default function CompetitiveAnalysisPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analyses: any[] = await repos.competitorAnalyses.list();
      
      const competitorsData: Competitor[] = [];
      for (const analysis of analyses) {
        const competitors = (analysis.competitors || []) as { name: string; type: string; notes?: string; marketingChannels?: string[] }[];
        for (const c of competitors) {
          competitorsData.push({
            id: `${analysis.id}-${c.name}`,
            name: c.name || "ไม่ระบุ",
            type: (c.type as "direct" | "indirect") || "direct",
            followers: 0,
            engagement: 0,
            postsPerWeek: 0,
            strengths: [],
            weaknesses: [],
            opportunities: [c.notes || ""],
            threatLevel: "medium",
          });
        }
        // If no nested competitors, add the analysis itself
        if (competitors.length === 0) {
          competitorsData.push({
            id: analysis.id,
            name: analysis.summary?.slice(0, 40) || "ไม่ระบุ",
            type: "direct",
            followers: 0,
            engagement: 0,
            postsPerWeek: 0,
            strengths: [],
            weaknesses: [],
            opportunities: [],
            threatLevel: "medium",
          });
        }
      }
      
      setCompetitors(competitorsData);
    } catch (err) {
      console.error("Failed to load competitors:", err);
      // Fallback sample data
      setCompetitors([
        { id: "1", name: "เปียโนสยาม", type: "direct", followers: 12500, engagement: 3.2, postsPerWeek: 5, strengths: ["แบรนด์แข็ง", "ราคาถูก"], weaknesses: ["ไม่มี AI", "สอนกลุ่ม"], opportunities: ["ไม่มี online course"], threatLevel: "high" },
        { id: "2", name: "Music Academy Bangkok", type: "direct", followers: 8900, engagement: 2.8, postsPerWeek: 3, strengths: ["สถานที่ดี", "ครูเก่ง"], weaknesses: ["ราคาแพง", "ไม่มี tech"], opportunities: ["ไม่มี app"], threatLevel: "medium" },
        { id: "3", name: "Simply Piano App", type: "indirect", followers: 45000, engagement: 5.1, postsPerWeek: 10, strengths: ["ฟรี", "สะดวก"], weaknesses: ["ไม่มีครูจริง", "ไม่ personalized"], opportunities: ["ไม่มี local"], threatLevel: "low" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const directCompetitors = competitors.filter(c => c.type === "direct");
  const indirectCompetitors = competitors.filter(c => c.type === "indirect");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">⚔️ Competitive Analysis</h1>
          <p className="text-sm text-secondary/50">วิเคราะห์คู่แข่ง — จุดแข็ง จุดอ่อน โอกาส และภัยคุกคาม</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">คู่แข่งทั้งหมด</p><p className="text-2xl font-bold text-secondary">{competitors.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Direct</p><p className="text-2xl font-bold text-red-500">{directCompetitors.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Indirect</p><p className="text-2xl font-bold text-amber-600">{indirectCompetitors.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">High Threat</p><p className="text-2xl font-bold text-red-500">{competitors.filter(c => c.threatLevel === "high").length}</p></CardContent></Card>
      </div>

      {/* Direct Competitors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Swords className="h-5 w-5 text-red-500" />Direct Competitors</CardTitle>
          <CardDescription>โรงเรียนเปียโนอื่นๆ ในพื้นที่เดียวกัน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-secondary/50">กำลังโหลด...</div>
          ) : directCompetitors.length === 0 ? (
            <div className="text-center py-8 text-secondary/50">ยังไม่มีข้อมูลคู่แข่ง</div>
          ) : (
            directCompetitors.map(comp => (
              <div key={comp.id} className="rounded-xl border border-line/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🏫</span>
                    <div>
                      <p className="text-sm font-medium text-secondary">{comp.name}</p>
                      <p className="text-[10px] text-secondary/40">{comp.followers.toLocaleString()} followers · {comp.engagement}% engagement</p>
                    </div>
                  </div>
                  <Badge variant={comp.threatLevel === "high" ? "danger" : comp.threatLevel === "medium" ? "warning" : "outline"}>
                    {comp.threatLevel === "high" ? "🔥 High Threat" : comp.threatLevel === "medium" ? "⚡ Medium" : "❄️ Low"}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-secondary">{comp.followers.toLocaleString()}</p>
                    <p className="text-[10px] text-secondary/40">Followers</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-primary">{comp.engagement}%</p>
                    <p className="text-[10px] text-secondary/40">Engagement</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-amber-600">{comp.postsPerWeek}</p>
                    <p className="text-[10px] text-secondary/40">Posts/Week</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-emerald-600 mb-1">✅ จุดแข็ง:</p>
                    <div className="flex flex-wrap gap-1">
                      {comp.strengths.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-[9px]">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-500 mb-1">❌ จุดอ่อน:</p>
                    <div className="flex flex-wrap gap-1">
                      {comp.weaknesses.map((w, i) => (
                        <Badge key={i} variant="outline" className="text-[9px]">{w}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-primary mb-1">💡 โอกาสของเรา:</p>
                    <div className="flex flex-wrap gap-1">
                      {comp.opportunities.map((o, i) => (
                        <Badge key={i} variant="success" className="text-[9px]">{o}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Indirect Competitors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-amber-500" />Indirect Competitors</CardTitle>
          <CardDescription>Apps และ Online Platforms ที่แข่งกับเรา</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {indirectCompetitors.map(comp => (
            <div key={comp.id} className="rounded-xl border border-line/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📱</span>
                  <div>
                    <p className="text-sm font-medium text-secondary">{comp.name}</p>
                    <p className="text-[10px] text-secondary/40">{comp.followers.toLocaleString()} users · {comp.engagement}% engagement</p>
                  </div>
                </div>
                <Badge variant="outline">Indirect</Badge>
              </div>
              
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-medium text-emerald-600 mb-1">✅ จุดแข็ง:</p>
                  <div className="flex flex-wrap gap-1">
                    {comp.strengths.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[9px]">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-primary mb-1">💡 โอกาสของเรา:</p>
                  <div className="flex flex-wrap gap-1">
                    {comp.opportunities.map((o, i) => (
                      <Badge key={i} variant="success" className="text-[9px]">{o}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Our Advantages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-500" />Our Competitive Advantages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { advantage: "🤖 AI-Powered Learning — ไม่มีโรงเรียนไหนมี", impact: "สูงมาก" },
            { advantage: "📱 Mobile App (TIGA.AI) — เรียนได้ทุกที่", impact: "สูง" },
            { advantage: "🎯 Personalized Curriculum — แผนการเรียนเฉพาะบุคคล", impact: "สูง" },
            { advantage: "💰 ราคาคุ้มค่า — Private ฿27,000 vs คู่แข่ง ฿35,000+", impact: "กลาง" },
            { advantage: "🌟 ทดลองเรียนฟรี 30 นาที — ลดความเสี่ยง", impact: "กลาง" },
            { advantage: "📊 Data-Driven Teaching — วัดผลได้จริง", impact: "สูง" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-emerald-200/30 bg-emerald-50/5 px-3 py-2">
              <span className="text-xs text-secondary">{item.advantage}</span>
              <Badge variant="success" className="text-[9px]">{item.impact}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
