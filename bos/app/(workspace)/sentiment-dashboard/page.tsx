"use client";

import { useEffect, useState, useMemo } from "react";
import { Heart, Frown, Meh, Angry, TrendingUp, TrendingDown, AlertTriangle, MessageSquare, BarChart3, Clock, Users, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface SentimentData {
  positive: { count: number; pct: number; icon: string; color: string; label: string };
  neutral: { count: number; pct: number; icon: string; color: string; label: string };
  negative: { count: number; pct: number; icon: string; color: string; label: string };
  angry: { count: number; pct: number; icon: string; color: string; label: string };
}

interface ConversationSentiment {
  id: string;
  name: string;
  lastMessage: string;
  sentiment: "positive" | "neutral" | "negative" | "angry";
  score: number;
  channel: string;
  time: string;
  needsReview: boolean;
}

interface Alert {
  id: string;
  name: string;
  sentiment: string;
  icon: string;
  message: string;
  time: string;
  urgency: "high" | "medium" | "low";
}

const SENTIMENT_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  positive: { bg: "bg-emerald-500/10", text: "text-emerald-600", icon: "😊" },
  neutral: { bg: "bg-gray-500/10", text: "text-gray-600", icon: "😐" },
  negative: { bg: "bg-amber-500/10", text: "text-amber-600", icon: "😟" },
  angry: { bg: "bg-red-500/10", text: "text-red-600", icon: "😡" },
};

function analyzeSentiment(text: string): { sentiment: "positive" | "neutral" | "negative" | "angry"; score: number } {
  const lower = text.toLowerCase();
  
  // Positive indicators
  const positiveWords = ["ขอบคุณ", "ดีมาก", "สนุก", "ชอบ", "รัก", "สุดยอด", "เยี่ยม", "happy", "great", "love", "good", "thank"];
  const negativeWords = ["แพง", "ไม่ดี", "ผิดหวัง", "รอนาน", "ไม่ชอบ", "โกรธ", "bad", "expensive", "wait", "angry"];
  const angryWords = ["โกรธ", "ทนไม่ได้", "แย่มาก", "ไม่ยอมรับ", "furious", "unacceptable", "terrible"];
  
  let positiveCount = 0;
  let negativeCount = 0;
  let angryCount = 0;
  
  positiveWords.forEach(w => { if (lower.includes(w)) positiveCount++; });
  negativeWords.forEach(w => { if (lower.includes(w)) negativeCount++; });
  angryWords.forEach(w => { if (lower.includes(w)) angryCount++; });
  
  if (angryCount > 0) return { sentiment: "angry", score: 25 };
  if (negativeCount > positiveCount) return { sentiment: "negative", score: 40 };
  if (positiveCount > negativeCount) return { sentiment: "positive", score: 85 };
  return { sentiment: "neutral", score: 60 };
}

export default function SentimentDashboardPage() {
  const [conversations, setConversations] = useState<ConversationSentiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const convos = await repos.conversations.listAllWithCustomers();
      
      const analyzed: ConversationSentiment[] = [];
      const alertList: Alert[] = [];
      
      for (const conv of convos.slice(0, 50)) {
        // Get last message for sentiment analysis
        const messages = await repos.conversations.listMessages(conv.id, 5);
        const lastMsg = messages[messages.length - 1];
        const lastMessage = lastMsg?.content || "ไม่มีข้อความ";
        
        const { sentiment, score } = analyzeSentiment(lastMessage);
        
        const convData: ConversationSentiment = {
          id: conv.id,
          name: conv.customerName || "ลูกค้าไม่ระบุ",
          lastMessage: lastMessage.slice(0, 80),
          sentiment,
          score,
          channel: conv.channel || "unknown",
          time: getTimeAgo(conv.updated_at),
          needsReview: conv.needs_review || false,
        };
        
        analyzed.push(convData);
        
        // Create alerts for negative/angry conversations
        if ((sentiment === "angry" || sentiment === "negative") && conv.needs_review) {
          alertList.push({
            id: conv.id,
            name: conv.customerName || "ลูกค้า",
            sentiment,
            icon: (SENTIMENT_CONFIG as any)[sentiment]?.icon ?? "👤",
            message: lastMessage.slice(0, 60),
            time: getTimeAgo(conv.updated_at),
            urgency: sentiment === "angry" ? "high" : "medium",
          });
        }
      }
      
      setConversations(analyzed);
      setAlerts(alertList);
    } catch (err) {
      console.error("Failed to load sentiment data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const sentimentData = useMemo(() => {
    const total = conversations.length || 1;
    const counts = { positive: 0, neutral: 0, negative: 0, angry: 0 };
    conversations.forEach(c => counts[c.sentiment]++);
    
    return {
      positive: { count: counts.positive, pct: Math.round((counts.positive / total) * 100), icon: "😊", color: "bg-emerald-500", label: "Positive" },
      neutral: { count: counts.neutral, pct: Math.round((counts.neutral / total) * 100), icon: "😐", color: "bg-gray-400", label: "Neutral" },
      negative: { count: counts.negative, pct: Math.round((counts.negative / total) * 100), icon: "😟", color: "bg-amber-500", label: "Negative" },
      angry: { count: counts.angry, pct: Math.round((counts.angry / total) * 100), icon: "😡", color: "bg-red-500", label: "Angry" },
    };
  }, [conversations]);

  const totalConversations = conversations.length;
  const reviewNeeded = conversations.filter(c => c.needsReview).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">📊 Sentiment Dashboard</h1>
          <p className="text-sm text-secondary/50">AI วิเคราะห์อารมณ์ลูกค้าแบบ realtime — ข้อมูลจริงจาก conversations</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(sentimentData).map(([key, data]) => (
          <Card key={key}><CardContent className="pt-4">
            <div className="flex items-center gap-2"><span className="text-xl">{data.icon}</span><p className="text-xs text-secondary/50">{data.label}</p></div>
            <p className="text-2xl font-bold text-secondary">{data.count}</p>
            <p className="text-xs text-secondary/30">{data.pct}%</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Conversations ทั้งหมด</p>
          <p className="text-2xl font-bold text-secondary">{totalConversations}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">ต้องดูแล</p>
          <p className="text-2xl font-bold text-amber-600">{reviewNeeded}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Resolution Rate</p>
          <p className="text-2xl font-bold text-emerald-600">{totalConversations > 0 ? Math.round(((totalConversations - reviewNeeded) / totalConversations) * 100) : 100}%</p>
        </CardContent></Card>
      </div>

      {/* Pie Chart Visual */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary-accent" />Sentiment Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-8 rounded-full overflow-hidden">
            {Object.entries(sentimentData).map(([key, data]) => (
              <div key={key} className={cn("h-full", data.color)} style={{ width: `${data.pct}%` }} title={`${data.label}: ${data.count}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(sentimentData).map(([key, data]) => (
              <div key={key} className="flex items-center gap-1.5"><div className={cn("h-3 w-3 rounded-full", data.color)} /><span className="text-xs text-secondary/60">{data.icon} {data.label}: {data.count} ({data.pct}%)</span></div>
            ))}
          </div>
        </CardContent></Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />⚠️ Alerts — Conversations ที่ต้องดูแลตอนนี้</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className={cn("flex items-center justify-between rounded-xl border p-3", alert.urgency === "high" ? "border-red-200/30 bg-red-50/5" : "border-amber-200/30 bg-amber-50/5")}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{alert.icon}</span>
                  <div><p className="text-sm font-medium text-secondary">{alert.name}</p><p className="text-xs text-secondary/40">{alert.message}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-secondary/30">{alert.time}</span>
                  <Badge variant={alert.urgency === "high" ? "danger" : "warning"} className="text-[9px]">{alert.urgency === "high" ? "เร่งด่วน" : "ปานกลาง"}</Badge>
                </div>
              </div>
            ))}
          </CardContent></Card>
      )}

      {/* Conversations */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary-accent" />Conversations — Realtime Sentiment</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {loading ? (
            <div className="text-center py-8 text-secondary/50">กำลังโหลด...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-secondary/50">ไม่มี conversation</div>
          ) : (
            conversations.sort((a, b) => a.score - b.score).map((conv) => {
              const cfg = (SENTIMENT_CONFIG as any)[conv.sentiment] ?? { bg: "bg-secondary/10", icon: "👤", text: "text-secondary" };
              return (
                <div key={conv.id} className={cn("flex items-center gap-3 rounded-lg border border-line/5 px-3 py-2", cfg.bg)}>
                  <span className="text-lg">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-secondary">{conv.name}</p>
                    <p className="text-[10px] text-secondary/40 truncate">&quot;{conv.lastMessage}&quot;</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-bold", cfg.text)}>{conv.score}</p>
                    <p className="text-[9px] text-secondary/30">{conv.channel} · {conv.time}</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent></Card>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return "เมื่อตะกี้";
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชม. ที่แล้ว`;
  return `${diffDays} วันที่แล้ว`;
}
