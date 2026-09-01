"use client";

import { useState, useEffect } from "react";
import {
  Gift, Users, Trophy, Star, Copy, Check, ExternalLink, TrendingUp,
  Award, ArrowRight, Share2, Percent, BadgeCheck, Crown, Medal, Target, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface Referrer {
  id: string;
  name: string;
  referred: number;
  converted: number;
  pending: number;
  totalReward: number;
  rank: number;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-line/10 text-[10px] font-bold text-secondary/60">{rank}</span>;
}

export default function ReferralTrackingPage() {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<Referrer[]>([]);
  const [recentEvents, setRecentEvents] = useState<{ date: string; referrer: string; referred: string; source: string; status: string; reward: number }[]>([]);

  async function loadReferralData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const allCustomers = await repos.customers.listPipeline();

      // Referral customers
      const referralCustomers = allCustomers.filter(c => 
        (c.lead_source || "").toLowerCase().includes("referral")
      );

      // Build leaderboard from referral source tracking
      // Group by referral patterns — customers who came from other customers
      const referrerMap = new Map<string, { referred: number; converted: number }>();
      
      referralCustomers.forEach(c => {
        // Use notes or metadata to find who referred them
        const referrerName = (c as any).notes?.match(/referred by[:\s]+(.+)/i)?.[1] || 
                             (c.lead_source || "").replace(/referral[-_\s]*/i, "").trim() || 
                             "Direct Referral";
        const existing = referrerMap.get(referrerName) || { referred: 0, converted: 0 };
        existing.referred++;
        if (c.sales_status === "won") existing.converted++;
        referrerMap.set(referrerName, existing);
      });

      // If no referrer data, create from referral customers directly
      if (referrerMap.size === 0 && referralCustomers.length > 0) {
        referralCustomers.forEach(c => {
          const name = c.name || "ลูกค้าแนะนำ";
          const existing = referrerMap.get(name) || { referred: 0, converted: 0 };
          existing.referred++;
          if (c.sales_status === "won") existing.converted++;
          referrerMap.set(name, existing);
        });
      }

      const lb: Referrer[] = Array.from(referrerMap.entries())
        .map(([name, data], i) => ({
          id: String(i),
          name,
          referred: data.referred,
          converted: data.converted,
          pending: data.referred - data.converted,
          totalReward: data.converted * 500,
          rank: 0,
        }))
        .sort((a, b) => b.converted - a.converted)
        .map((r, i) => ({ ...r, rank: i + 1 }))
        .slice(0, 10);

      setLeaderboard(lb);

      // Recent referral events
      const events = referralCustomers.slice(0, 10).map(c => ({
        date: c.created_at?.slice(0, 10) || "N/A",
        referrer: (c as any).notes?.match(/referred by[:\s]+(.+)/i)?.[1] || "Direct",
        referred: c.name || "ไม่ระบุชื่อ",
        source: c.lead_source || "Referral",
        status: c.sales_status === "won" ? "converted" : c.sales_status === "contacted" ? "trial" : "pending",
        reward: c.sales_status === "won" ? 500 : 0,
      }));
      setRecentEvents(events);

    } catch (err) {
      console.error("Failed to load referral data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReferralData(); }, []);

  const totalReferrals = leaderboard.reduce((s, r) => s + r.referred, 0);
  const totalConverted = leaderboard.reduce((s, r) => s + r.converted, 0);
  const totalRewards = leaderboard.reduce((s, r) => s + r.totalReward, 0);
  const convRate = totalReferrals > 0 ? ((totalConverted / totalReferrals) * 100).toFixed(1) : "0";

  const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "outline" | "danger" }> = {
    pending: { label: "รอยืนยัน", variant: "warning" },
    trial: { label: "ทดลองแล้ว", variant: "outline" },
    converted: { label: "สมัครแล้ว", variant: "success" },
    expired: { label: "หมดอายุ", variant: "danger" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🎁 Referral Tracking</h1>
          <p className="text-sm text-secondary/50">ติดตาม Referral แนะนำเพื่อน — ข้อมูลจริงจาก CRM</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadReferralData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">แนะนำทั้งหมด</p><p className="text-2xl font-bold text-secondary">{totalReferrals}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">สมัครแล้ว</p><p className="text-2xl font-bold text-emerald-600">{totalConverted}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Conversion Rate</p><p className="text-2xl font-bold text-primary">{convRate}%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">รางวัลจ่ายแล้ว</p><p className="text-2xl font-bold text-amber-600">฿{totalRewards.toLocaleString()}</p></CardContent></Card>
      </div>

      {/* Referral Program Info */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary-accent" />โปรแกรม Referral</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-200/30 bg-emerald-50/5 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
              <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-emerald-500" /><span className="text-sm font-medium text-secondary">ผู้แนะนำ</span></div>
              <p className="text-xl font-bold text-emerald-600">฿500</p>
              <p className="text-xs text-secondary/40">ต่อเพื่อนที่สมัครสำเร็จ</p>
            </div>
            <div className="rounded-xl border border-blue-200/30 bg-blue-50/5 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
              <div className="flex items-center gap-2 mb-2"><Share2 className="h-4 w-4 text-blue-500" /><span className="text-sm font-medium text-secondary">เพื่อนใหม่</span></div>
              <p className="text-xl font-bold text-blue-600">฿500</p>
              <p className="text-xs text-secondary/40">ส่วนลดเมื่อสมัครคอร์ส</p>
            </div>
            <div className="rounded-xl border border-purple-200/30 bg-purple-50/5 p-4 dark:border-purple-500/20 dark:bg-purple-500/5">
              <div className="flex items-center gap-2 mb-2"><Percent className="h-4 w-4 text-purple-500" /><span className="text-sm font-medium text-secondary">Top Referrer</span></div>
              <p className="text-xl font-bold text-purple-600">โบนัสพิเศษ</p>
              <p className="text-xs text-secondary/40">แนะนำ 10 คน = คอร์สฟรี 1 เดือน</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />Leaderboard — ผู้แนะนำยอดเยี่ยม</CardTitle>
          <CardDescription>จัดอันดับตามจำนวนเพื่อนที่แนะนำมาสมัครสำเร็จ — ข้อมูลจริง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <div className="text-center py-4 text-secondary/50">กำลังโหลด...</div> : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-secondary/50">ยังไม่มีข้อมูล Referral — เริ่มแชร์ลิงก์ได้เลย!</div>
          ) : leaderboard.map((r) => (
            <div key={r.id} className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 transition-all", r.rank <= 3 ? "border-primary/20 bg-primary/5" : "border-line/10")}>
              <RankBadge rank={r.rank} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary">{r.name}</p>
                <div className="flex gap-3 text-[10px] text-secondary/40">
                  <span>แนะนำ {r.referred} คน</span>
                  <span>สมัคร {r.converted} คน</span>
                  <span>รอยืนยัน {r.pending} คน</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-600">฿{r.totalReward.toLocaleString()}</p>
                <p className="text-[10px] text-secondary/40">รางวัลรวม</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Referral Events */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary-accent" />Referral ล่าสุด</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <div className="text-center py-4 text-secondary/50">กำลังโหลด...</div> : recentEvents.length === 0 ? (
            <div className="text-center py-4 text-secondary/50">ยังไม่มี referral events</div>
          ) : recentEvents.map((event, i) => {
            const st = (STATUS_MAP as any)[event.status ?? "pending"] ?? STATUS_MAP.pending;
            return (
              <div key={i} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-secondary">
                      <span className="font-medium">{event.referrer}</span> แนะนำ <span className="font-medium">{event.referred}</span>
                    </p>
                    <Badge variant={st.variant} className="text-[9px]">{st.label}</Badge>
                  </div>
                  <p className="text-[10px] text-secondary/30">{event.date} · {event.source}</p>
                </div>
                {event.reward > 0 && <span className="text-xs font-bold text-amber-600">+฿{event.reward}</span>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Revenue Impact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-500" />Revenue Impact</CardTitle>
          <CardDescription>Referral program สร้างรายได้ให้ธุรกิจเท่าไหร่</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-line/5 p-3 text-center">
              <p className="text-2xl font-bold text-secondary">{totalConverted}</p>
              <p className="text-[10px] text-secondary/40">นักเรียนจาก Referral</p>
            </div>
            <div className="rounded-xl bg-line/5 p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">฿{(totalConverted * 27000).toLocaleString()}</p>
              <p className="text-[10px] text-secondary/40">รายได้จาก Referral</p>
            </div>
            <div className="rounded-xl bg-line/5 p-3 text-center">
              <p className="text-2xl font-bold text-red-500">฿{totalRewards.toLocaleString()}</p>
              <p className="text-[10px] text-secondary/40">รางวัลที่จ่าย</p>
            </div>
            <div className="rounded-xl bg-emerald-50/5 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {totalRewards > 0 ? (((totalConverted * 27000) - totalRewards) / totalRewards * 100).toFixed(0) : "∞"}x
              </p>
              <p className="text-[10px] text-secondary/40">ROI ของ Referral Program</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
