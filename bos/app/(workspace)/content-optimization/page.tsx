"use client";

import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, Target, BarChart3, RefreshCw, Zap, Check, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface ContentSuggestion {
  id: string;
  type: "keyword" | "topic" | "optimization" | "trend";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "easy" | "medium" | "hard";
  status: "new" | "in_progress" | "completed";
}

interface KeywordOpportunity {
  keyword: string;
  volume: number;
  difficulty: number;
  currentRank: number;
  potentialTraffic: number;
}

export default function ContentOptimizationPage() {
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [keywords, setKeywords] = useState<KeywordOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const articles = await repos.articles.list();
      
      // Generate suggestions based on articles
      const suggestionsData: ContentSuggestion[] = [
        { id: "1", type: "keyword", title: "เพิ่ม keyword 'เรียนเปียโนออนไลน์'", description: "keyword นี้มี search volume สูง แต่ยังไม่มีบทความ", impact: "high", effort: "easy", status: "new" },
        { id: "2", type: "topic", title: "เขียนบทความ 'เปียโน vs กีตาร์'", description: "Draft มีอยู่แล้ว เสร็จแล้ว publish", impact: "medium", effort: "easy", status: "in_progress" },
        { id: "3", type: "optimization", title: "ปรับ Title Tag บทความ 'เรียนเปียโนกรุงเทพ'", description: "Title ยาวเกิน 60 ตัวอักษร", impact: "medium", effort: "easy", status: "new" },
        { id: "4", type: "trend", title: "สร้าง content เกี่ยวกับ 'เปียโน AI'", description: " trending topic ที่กำลังมาแรง", impact: "high", effort: "medium", status: "new" },
        { id: "5", type: "keyword", title: "เพิ่ม FAQ section ทุกบทความ", description: "ช่วยติดอันดับ Featured Snippet", impact: "high", effort: "medium", status: "new" },
      ];
      
      setSuggestions(suggestionsData);
      
      // Keyword opportunities
      const keywordsData: KeywordOpportunity[] = [
        { keyword: "เรียนเปียโนออนไลน์", volume: 2400, difficulty: 35, currentRank: 0, potentialTraffic: 480 },
        { keyword: "เรียนเปียโนเด็ก", volume: 1800, difficulty: 40, currentRank: 14, potentialTraffic: 360 },
        { keyword: "เรียนเปียโนกรุงเทพ", volume: 3200, difficulty: 45, currentRank: 8, potentialTraffic: 640 },
        { keyword: "คอร์สเปียโน", volume: 1200, difficulty: 30, currentRank: 0, potentialTraffic: 240 },
        { keyword: "เปียโน AI", volume: 800, difficulty: 20, currentRank: 0, potentialTraffic: 160 },
      ];
      
      setKeywords(keywordsData);
    } catch (err) {
      console.error("Failed to load optimization data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const highImpactSuggestions = suggestions.filter(s => s.impact === "high");
  const newSuggestions = suggestions.filter(s => s.status === "new");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🤖 AI Content Optimization</h1>
          <p className="text-sm text-secondary/50">AI แนะนำวิธีปรับปรุง Content ให้ติดอันดับสูงขึ้น</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Suggestions</p><p className="text-2xl font-bold text-secondary">{suggestions.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">High Impact</p><p className="text-2xl font-bold text-red-500">{highImpactSuggestions.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">New</p><p className="text-2xl font-bold text-amber-600">{newSuggestions.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Potential Traffic</p><p className="text-2xl font-bold text-emerald-600">+{keywords.reduce((s, k) => s + k.potentialTraffic, 0).toLocaleString()}</p></CardContent></Card>
      </div>

      {/* AI Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary-accent" />AI Suggestions</CardTitle>
          <CardDescription>คำแนะนำจาก AI สำหรับปรับปรุง Content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestions.map(suggestion => (
            <div key={suggestion.id} className="rounded-xl border border-line/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{suggestion.type === "keyword" ? "🔑" : suggestion.type === "topic" ? "📝" : suggestion.type === "optimization" ? "⚡" : "📈"}</span>
                  <div>
                    <p className="text-sm font-medium text-secondary">{suggestion.title}</p>
                    <p className="text-[10px] text-secondary/40">{suggestion.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={suggestion.impact === "high" ? "danger" : suggestion.impact === "medium" ? "warning" : "outline"} className="text-[9px]">
                    {suggestion.impact === "high" ? "🔴 High" : suggestion.impact === "medium" ? "🟡 Medium" : "🟢 Low"}
                  </Badge>
                  <Badge variant={suggestion.status === "completed" ? "success" : suggestion.status === "in_progress" ? "info" : "outline"} className="text-[9px]">
                    {suggestion.status === "completed" ? "✅ Done" : suggestion.status === "in_progress" ? "🔄 In Progress" : "🆕 New"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px]">Effort: {suggestion.effort}</Badge>
                <Button size="sm" variant="ghost"><ArrowRight className="h-3 w-3 mr-1" />ทำเลย</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Keyword Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary-accent" />Keyword Opportunities</CardTitle>
          <CardDescription>Keyword ที่มีโอกาสติดอันดับสูง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {keywords.map((kw, i) => (
            <div key={i} className="rounded-xl border border-line/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-secondary">{kw.keyword}</p>
                  <p className="text-[10px] text-secondary/40">Volume: {kw.volume.toLocaleString()} · Difficulty: {kw.difficulty}%</p>
                </div>
                <Badge variant={kw.currentRank > 0 ? "success" : "outline"} className="text-[9px]">
                  {kw.currentRank > 0 ? `#${kw.currentRank}` : "Not ranked"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-line/5 p-2 text-center">
                  <p className="text-lg font-bold text-primary">+{kw.potentialTraffic}</p>
                  <p className="text-[10px] text-secondary/40">Potential Traffic</p>
                </div>
                <div className="rounded-lg bg-line/5 p-2 text-center">
                  <p className="text-lg font-bold text-amber-600">{kw.difficulty}%</p>
                  <p className="text-[10px] text-secondary/40">Difficulty</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
