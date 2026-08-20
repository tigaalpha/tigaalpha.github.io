"use client";

import { useState } from "react";
import { Heart, Frown, Meh, Angry, TrendingUp, TrendingDown, AlertTriangle, MessageSquare, BarChart3, Clock, Users, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SENTIMENT_DATA = {
  positive: { count: 89, pct: 70, icon: "😊", color: "bg-emerald-500", label: "Positive" },
  neutral: { count: 25, pct: 20, icon: "😐", color: "bg-gray-400", label: "Neutral" },
  negative: { count: 10, pct: 8, icon: "😟", color: "bg-amber-500", label: "Negative" },
  angry: { count: 3, pct: 2, icon: "😡", color: "bg-red-500", label: "Angry" },
};

interface Alert {
  conversation: string;
  sentiment: string;
  icon: string;
  message: string;
  time: string;
  urgency: "high" | "medium" | "low";
}

const ALERTS: Alert[] = [
  { conversation: "คุณนภา", sentiment: "😡", icon: "😡", message: "โกรธมาก — บอกว่า 'รอมา 3 ชม. ไม่มีใครตอบ'", time: "5 นาทีที่แล้ว", urgency: "high" },
  { conversation: "คุณกมล", sentiment: "😟", icon: "😟", message: "ลังเล — บอกว่า 'แพงไปไหม'", time: "15 นาทีที่แล้ว", urgency: "medium" },
  { conversation: "คุณรัตนา", sentiment: "😟", icon: "😟", message: "ถามเปรียบเทียบ — 'ที่อื่นถูกกว่า'", time: "30 นาทีที่แล้ว", urgency: "medium" },
];

interface Conversation {
  name: string;
  lastMessage: string;
  sentiment: "positive" | "neutral" | "negative" | "angry";
  score: number;
  channel: string;
  time: string;
}

const CONVERSATIONS: Conversation[] = [
  { name: "คุณพิชัย", lastMessage: "ขอบคุณครับ จะลองจองดู!", sentiment: "positive", score: 92, channel: "LINE", time: "2 นาที" },
  { name: "คุณสุภาพร", lastMessage: "สนใจคอร์สวิดีโอค่ะ", sentiment: "positive", score: 78, channel: "LINE", time: "10 นาที" },
  { name: "คุณจินดา", lastMessage: "ขอเวลาตัดสินใจก่อนนะคะ", sentiment: "neutral", score: 65, channel: "Web", time: "20 นาที" },
  { name: "คุณนภา", lastMessage: "ทำไมไม่มีใครตอบเลย!", sentiment: "angry", score: 25, channel: "LINE", time: "5 นาที" },
  { name: "คุณรัตนา", lastMessage: "ราคาแพงไปไหมคะ", sentiment: "negative", score: 45, channel: "Web", time: "30 นาที" },
  { name: "คุณกมล", lastMessage: "เรียนสนุกมากครับ!", sentiment: "positive", score: 95, channel: "LINE", time: "1 ชม." },
];

const SENTIMENT_CONFIG: Record<string, { bg: string; text: string }> = {
  positive: { bg: "bg-emerald-500/10", text: "text-emerald-600" },
  neutral: { bg: "bg-gray-500/10", text: "text-gray-600" },
  negative: { bg: "bg-amber-500/10", text: "text-amber-600" },
  angry: { bg: "bg-red-500/10", text: "text-red-600" },
};

export default function SentimentDashboardPage() {
  const total = Object.values(SENTIMENT_DATA).reduce((s, v) => s + v.count, 0);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-secondary">📊 Sentiment Dashboard</h1>
        <p className="text-sm text-secondary/50">AI วิเคราะห์อารมณ์ลูกค้าแบบ realtime — เห็นก่อนที่จะเสียลูกค้า</p></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(SENTIMENT_DATA).map(([key, data]) => (
          <Card key={key}><CardContent className="pt-4">
            <div className="flex items-center gap-2"><span className="text-xl">{data.icon}</span><p className="text-xs text-secondary/50">{data.label}</p></div>
            <p className="text-2xl font-bold text-secondary">{data.count}</p>
            <p className="text-xs text-secondary/30">{data.pct}%</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Pie Chart Visual */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary-accent" />Sentiment Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-8 rounded-full overflow-hidden">
            {Object.entries(SENTIMENT_DATA).map(([key, data]) => (
              <div key={key} className={cn("h-full", data.color)} style={{ width: `${data.pct}%` }} title={`${data.label}: ${data.count}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(SENTIMENT_DATA).map(([key, data]) => (
              <div key={key} className="flex items-center gap-1.5"><div className={cn("h-3 w-3 rounded-full", data.color)} /><span className="text-xs text-secondary/60">{data.icon} {data.label}: {data.count} ({data.pct}%)</span></div>
            ))}
          </div>
        </CardContent></Card>

      {/* Trend */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-500" />Weekly Trend</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-emerald-50/5 p-3"><p className="text-xs text-emerald-600">📈 Positive ขึ้น 5% จากสัปดาห์ก่อน</p></div>
            <div className="rounded-xl bg-red-50/5 p-3"><p className="text-xs text-red-500">📉 Angry ขึ้น 1% — 3 conversations ต้องดูแล</p></div>
          </div>
        </CardContent></Card>

      {/* Alerts */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />⚠️ Alerts — Conversations ที่ต้องดูแลตอนนี้</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ALERTS.map((alert, i) => (
            <div key={i} className={cn("flex items-center justify-between rounded-xl border p-3", alert.urgency === "high" ? "border-red-200/30 bg-red-50/5" : "border-amber-200/30 bg-amber-50/5")}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{alert.icon}</span>
                <div><p className="text-sm font-medium text-secondary">{alert.conversation}</p><p className="text-xs text-secondary/40">{alert.message}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-secondary/30">{alert.time}</span>
                <Badge variant={alert.urgency === "high" ? "danger" : "warning"} className="text-[9px]">{alert.urgency === "high" ? "เร่งด่วน" : "ปานกลาง"}</Badge>
              </div>
            </div>
          ))}
        </CardContent></Card>

      {/* Conversations */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary-accent" />Conversations — Realtime Sentiment</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {CONVERSATIONS.sort((a, b) => a.score - b.score).map((conv, i) => {
            const cfg = SENTIMENT_CONFIG[conv.sentiment];
            return (
              <div key={i} className={cn("flex items-center gap-3 rounded-lg border border-line/5 px-3 py-2", cfg.bg)}>
                <span className="text-lg">{SENTIMENT_DATA[conv.sentiment]?.icon ?? "😐"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-secondary">{conv.name}</p>
                  <p className="text-[10px] text-secondary/40 truncate">"{conv.lastMessage}"</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-sm font-bold", cfg.text)}>{conv.score}</p>
                  <p className="text-[9px] text-secondary/30">{conv.channel} · {conv.time}</p>
                </div>
              </div>
            );
          })}
        </CardContent></Card>
    </div>
  );
}
