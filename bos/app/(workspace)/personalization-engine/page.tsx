"use client";

import { useEffect, useState, useMemo } from "react";
import { Users, Target, MessageSquare, Zap, TrendingUp, RefreshCw, UserCheck, Mail, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface CustomerProfile {
  id: string;
  name: string;
  segment: string;
  channel: string;
  lastMessage: string;
  daysSinceContact: number;
  recommendedMessage: string;
  recommendedChannel: string;
  personalizationScore: number;
}

const SEGMENT_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  "hot": { color: "text-red-500", bg: "bg-red-500/10", icon: "🔥" },
  "warm": { color: "text-amber-500", bg: "bg-amber-500/10", icon: "⚡" },
  "new": { color: "text-blue-500", bg: "bg-blue-500/10", icon: "🆕" },
  "trial": { color: "text-purple-500", bg: "bg-purple-500/10", icon: "🧪" },
  "cold": { color: "text-gray-500", bg: "bg-gray-500/10", icon: "❄️" },
  "default": { color: "text-secondary", bg: "bg-secondary/10", icon: "👤" },
};

function generatePersonalizedMessage(profile: { name: string; segment: string; daysSinceContact: number; leadSource: string | null }): string {
  const { segment, daysSinceContact, leadSource } = profile;
  
  if (segment === "hot" && daysSinceContact <= 1) {
    return "🔥 คุณกำลังสนใจอยู่ — จองทดลองเลยไหม? เหลือแค่ 2 ที่สัปดาห์นี้!";
  } else if (segment === "hot") {
    return "👋 ยังสนใจเรียนเปียโนอยู่ไหม? เรามีโปรโมชันพิเศษสำหรับคุณ";
  } else if (segment === "trial") {
    return "😊 หลังทดลองแล้วเป็นยังไงบ้าง? อยากเรียนต่อไหม?";
  } else if (segment === "warm") {
    return "📚 5 เหตุผลที่ควรเริ่มเรียนเปียโนตอนนี้ — ดูรีวิวนักเรียนของเรา";
  } else if (segment === "cold" && daysSinceContact > 14) {
    return "🎵 เราคิดถึงคุณ! กลับมาเรียนเปียโนกันเถอะ — ส่วนลด 15% สำหรับคุณ";
  } else if (leadSource === "referral") {
    return "🎁 เพื่อนแนะนำคุณมา — เรามีสิทธิ์พิเศษสำหรับคุณ!";
  } else if (leadSource === "facebook" || leadSource === "tiktok") {
    return "📱 เห็นจาก Social Media ใช่ไหม? ลองจองทดลองฟรีดูสิ!";
  }
  
  return "🎹 สนใจเรียนเปียโน? ทดลองฟรี 30 นาที — ไม่มีค่าใช้จ่าย";
}

function getRecommendedChannel(profile: { leadSource: string | null; lastContactChannel: string | null }): string {
  if (profile.lastContactChannel === "line") return "LINE";
  if (profile.leadSource === "facebook" || profile.leadSource === "instagram") return "LINE";
  if (profile.leadSource === "google") return "Email";
  return "LINE";
}

export default function PersonalizationEnginePage() {
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadProfiles() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const customers = await repos.customers.listPipeline();
      
      const profilesData: CustomerProfile[] = customers
        .filter(c => c.sales_status !== "won" && c.sales_status !== "lost")
        .map(customer => {
          const now = new Date();
          const lastContact = customer.last_contact_at ? new Date(customer.last_contact_at) : new Date(customer.created_at);
          const daysSinceContact = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
          
          const segment = customer.sales_status || "default";
          const channel = getRecommendedChannel({ leadSource: customer.lead_source, lastContactChannel: null });
          
          return {
            id: customer.id,
            name: customer.name || "ไม่ระบุชื่อ",
            segment,
            channel,
            lastMessage: generatePersonalizedMessage({
              name: customer.name || "",
              segment,
              daysSinceContact,
              leadSource: customer.lead_source,
            }),
            daysSinceContact,
            recommendedMessage: generatePersonalizedMessage({
              name: customer.name || "",
              segment,
              daysSinceContact,
              leadSource: customer.lead_source,
            }),
            recommendedChannel: channel,
            personalizationScore: Math.min(100, Math.max(50, 100 - daysSinceContact * 5)),
          };
        })
        .sort((a, b) => b.personalizationScore - a.personalizationScore)
        .slice(0, 20);
      
      setProfiles(profilesData);
    } catch (err) {
      console.error("Failed to load profiles:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProfiles(); }, []);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    profiles.forEach(p => { counts[p.segment] = (counts[p.segment] || 0) + 1; });
    return counts;
  }, [profiles]);

  const avgScore = profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + p.personalizationScore, 0) / profiles.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">💬 Personalization Engine</h1>
          <p className="text-sm text-secondary/50">AI ปรับข้อความตามบุคคล — ข้อมูลจริงจาก CRM</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadProfiles} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Profiles ทั้งหมด</p>
          <p className="text-2xl font-bold text-secondary">{profiles.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Personalization Score</p>
          <p className="text-2xl font-bold text-primary">{avgScore}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">High Intent</p>
          <p className="text-2xl font-bold text-red-500">{segmentCounts["hot"] || 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Needs Follow-up</p>
          <p className="text-2xl font-bold text-amber-500">{profiles.filter(p => p.daysSinceContact > 7).length}</p>
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary-accent" />Personalized Messages</CardTitle><CardDescription>ข้อความที่แนะนำสำหรับแต่ละ lead — ปรับตาม segment และ behavior</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-secondary/50">กำลังโหลด...</div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-secondary/50">ไม่มี lead ในระบบ</div>
          ) : (
            profiles.map((profile) => {
              const segCfg = SEGMENT_CONFIG[profile.segment] || SEGMENT_CONFIG.default;
              return (
                <div key={profile.id} className={cn("rounded-xl border border-line/10 p-4", segCfg.bg)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{segCfg.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-secondary">{profile.name}</p>
                        <p className="text-[10px] text-secondary/40">{profile.segment} · {profile.daysSinceContact} วัน · {profile.recommendedChannel}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px]">{profile.personalizationScore}%</Badge>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 mt-2">
                    <p className="text-xs text-secondary/60 mb-1">ข้อความแนะนำ:</p>
                    <p className="text-sm text-secondary">&quot;{profile.recommendedMessage}&quot;</p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline">
                      <Mail className="h-3 w-3 mr-1" />
                      ส่ง
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Smartphone className="h-3 w-3 mr-1" />
                      {profile.recommendedChannel}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent></Card>
    </div>
  );
}
