"use client";

import { useEffect, useState, useMemo } from "react";
import { GraduationCap, MessageSquare, TrendingUp, Target, Star, RefreshCw, BookOpen, Award, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface SalesInteraction {
  id: string;
  customerName: string;
  channel: string;
  lastMessage: string;
  salesStage: string;
  sentiment: "positive" | "neutral" | "negative";
  responseQuality: number;
  recommendedAction: string;
  coachingTip: string;
}

function analyzeResponseQuality(message: string): { quality: number; tip: string } {
  const lower = message.toLowerCase();
  
  // Good signals
  const goodSignals = ["ขอบคุณ", "สนใจ", "จอง", "ทดลอง", "ตัดสินใจ", "โอน", "จ่าย", "สมัคร"];
  const badSignals = ["แพง", "ไม่ดี", "ผิดหวัง", "รอ", "ช้า", "ไม่ตอบ", "โกรธ"];
  
  let quality = 60; // Base
  
  goodSignals.forEach(signal => { if (lower.includes(signal)) quality += 10; });
  badSignals.forEach(signal => { if (lower.includes(signal)) quality -= 15; });
  
  quality = Math.max(20, Math.min(100, quality));
  
  let tip = "ปานกลาง — ลองเพิ่มความเป็นส่วนตัว";
  if (quality >= 80) tip = "ดีมาก! ลูกค้ากำลังตัดสินใจ — follow up เร็ว";
  else if (quality < 50) tip = "ลูกค้ามีข้อกังวล — ตอบด้วย empathy ก่อน";
  
  return { quality, tip };
}

function getCoachingTip(stage: string, sentiment: string): string {
  const tips: Record<string, string> = {
    "hot": "🔥 Lead ร้อน! ติดต่อทันที — อย่ารอเกิน 5 นาที",
    "warm": "⚡ กำลังสนใจ — ส่งรีวิวหรือ testimonial เพื่อสร้างความมั่นใจ",
    "trial": "🧪 หลังทดลอง — follow up ใน 24 ชม. พร้อมข้อเสนอพิเศษ",
    "new": "🆕 Lead ใหม่ — ทักทายภายใน 5 นาที พร้อม offer ทดลองฟรี",
    "cold": "❄️ Lead เย็น — ส่ง content สร้างแรงบันดาลใจ ไม่ hard sell",
    "proposal": "📋 รอตัดสินใจ — ส่งเปรียบเทียบราคาและข้อดี",
    "negotiation": "🤝 กำลังเจรจา — หา win-win ไม่ลดราคาแต่เพิ่ม value",
  };
  
  if (sentiment === "negative") return "⚠️ ลูกค้าไม่พอใจ — ขอโทษก่อน แล้วเสนอทางออก";
  if (sentiment === "angry") return "🚨 ลูกค้าโกรธ — escalate ให้เจ้าของทันที";
  
  return tips[stage] || "📞 ติดตามต่อ — อย่าปล่อยให้ lead หาย";
}

export default function SalesCoachPage() {
  const [interactions, setInteractions] = useState<SalesInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTip, setSelectedTip] = useState<string | null>(null);

  async function loadInteractions() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const customers = await repos.customers.listPipeline();
      
      const interactionsData: SalesInteraction[] = [];
      
      for (const customer of customers.slice(0, 20)) {
        // Get recent conversations
        const convos = await createClient()
          .from("conversations")
          .select("id, channel, needs_review, updated_at")
          .eq("customer_id", customer.id)
          .order("updated_at", { ascending: false })
          .limit(1);
        
        const conv = convos.data?.[0];
        if (!conv) continue;
        
        // Get last message
        const messages = await repos.conversations.listMessages(conv.id, 3);
        const lastMsg = messages[messages.length - 1];
        const lastMessage = lastMsg?.content || "ไม่มีข้อความ";
        
        const { quality, tip } = analyzeResponseQuality(lastMessage);
        
        // Simple sentiment
        const lower = lastMessage.toLowerCase();
        const sentiment = (lower.includes("โกรธ") || lower.includes("ไม่พอใจ") || lower.includes("แย่")) ? "negative" :
                         (lower.includes("ขอบคุณ") || lower.includes("ดี") || lower.includes("ชอบ")) ? "positive" : "neutral";
        
        interactionsData.push({
          id: customer.id,
          customerName: customer.name || "ไม่ระบุชื่อ",
          channel: conv.channel || "unknown",
          lastMessage: lastMessage.slice(0, 80),
          salesStage: customer.sales_status || "new",
          sentiment,
          responseQuality: quality,
          recommendedAction: getCoachingTip(customer.sales_status || "new", sentiment),
          coachingTip: tip,
        });
      }
      
      setInteractions(interactionsData.sort((a, b) => a.responseQuality - b.responseQuality));
    } catch (err) {
      console.error("Failed to load interactions:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInteractions(); }, []);

  const avgQuality = interactions.length > 0 ? Math.round(interactions.reduce((s, i) => s + i.responseQuality, 0) / interactions.length) : 0;
  const needsAttention = interactions.filter(i => i.responseQuality < 50 || i.sentiment === "negative").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🎓 AI Sales Coach</h1>
          <p className="text-sm text-secondary/50">วิเคราะห์เทคนิคขายจาก conversation จริง — พร้อมคำแนะนำ</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadInteractions} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Interactions</p>
          <p className="text-2xl font-bold text-secondary">{interactions.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Avg Quality</p>
          <p className={cn("text-2xl font-bold", avgQuality >= 70 ? "text-emerald-600" : avgQuality >= 50 ? "text-amber-600" : "text-red-500")}>{avgQuality}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Needs Attention</p>
          <p className="text-2xl font-bold text-amber-500">{needsAttention}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Resolution Rate</p>
          <p className="text-2xl font-bold text-emerald-600">{interactions.length > 0 ? Math.round(((interactions.length - needsAttention) / interactions.length) * 100) : 100}%</p>
        </CardContent></Card>
      </div>

      {/* Quick Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary-accent" />Sales Tips วันนี้</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { tip: "📞 ติดต่อ lead ใหม่ภายใน 5 นาที — conversion สูงขึ้น 5 เท่า", priority: "high" },
            { tip: "💬 ใช้ชื่อลูกค้าในข้อความ — engagement เพิ่ม 30%", priority: "medium" },
            { tip: "🎁 เสนอ trial ฟรีก่อน — ลดความเสี่ยงให้ลูกค้า", priority: "medium" },
            { tip: "⏰ follow up ภายใน 24 ชม. หลัง trial — conversion สูงสุด", priority: "high" },
          ].map((item, i) => (
            <div key={i} className={cn("flex items-center gap-3 rounded-xl border p-3", item.priority === "high" ? "border-emerald-200/30 bg-emerald-50/5" : "border-line/10")}>
              <span className="text-lg">💡</span>
              <p className="text-sm text-secondary flex-1">{item.tip}</p>
              <Badge variant={item.priority === "high" ? "success" : "outline"} className="text-[9px]">{item.priority === "high" ? "สำคัญ" : "ดี"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Interactions */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary-accent" />Interactions Analysis</CardTitle><CardDescription>วิเคราะห์จาก conversation จริง — เรียงตามคุณภาพต่ำสุด</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-secondary/50">กำลังวิเคราะห์...</div>
          ) : interactions.length === 0 ? (
            <div className="text-center py-8 text-secondary/50">ไม่มี interactions</div>
          ) : (
            interactions.map((interaction) => (
              <div key={interaction.id} className="rounded-xl border border-line/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm", 
                      interaction.responseQuality >= 70 ? "bg-emerald-500" : interaction.responseQuality >= 50 ? "bg-amber-500" : "bg-red-500"
                    )}>
                      {interaction.responseQuality}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary">{interaction.customerName}</p>
                      <p className="text-[10px] text-secondary/40">{interaction.channel} · {interaction.salesStage}</p>
                    </div>
                  </div>
                  <Badge variant={interaction.sentiment === "positive" ? "success" : interaction.sentiment === "negative" ? "danger" : "outline"}>
                    {interaction.sentiment === "positive" ? "😊 Positive" : interaction.sentiment === "negative" ? "😟 Negative" : "😐 Neutral"}
                  </Badge>
                </div>
                <div className="rounded-lg bg-line/5 p-3 mb-2">
                  <p className="text-xs text-secondary/60">Last message:</p>
                  <p className="text-sm text-secondary">&quot;{interaction.lastMessage}&quot;</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-600">💡 {interaction.coachingTip}</span>
                </div>
                <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs text-primary font-medium">🎯 Action: {interaction.recommendedAction}</p>
                </div>
              </div>
            ))
          )}
        </CardContent></Card>
    </div>
  );
}
