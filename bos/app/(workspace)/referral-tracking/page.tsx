"use client";

import { useState } from "react";
import {
  Gift,
  Users,
  Trophy,
  Star,
  Copy,
  Check,
  ExternalLink,
  TrendingUp,
  Award,
  ArrowRight,
  Share2,
  Percent,
  BadgeCheck,
  Crown,
  Medal,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Referrer {
  id: string;
  name: string;
  referred: number;
  converted: number;
  pending: number;
  rewards: number;
  totalReward: number;
  rank: number;
}

const LEADERBOARD: Referrer[] = [
  { id: "1", name: "คุณสมศักดิ์", referred: 12, converted: 8, pending: 2, rewards: 4000, totalReward: 4000, rank: 1 },
  { id: "2", name: "คุณวิภา", referred: 9, converted: 6, pending: 1, rewards: 3000, totalReward: 3000, rank: 2 },
  { id: "3", name: "คุณนพดล", referred: 7, converted: 5, pending: 0, rewards: 2500, totalReward: 2500, rank: 3 },
  { id: "4", name: "คุณวรรณพร", referred: 5, converted: 3, pending: 1, rewards: 1500, totalReward: 1500, rank: 4 },
  { id: "5", name: "คุณพิมพ์ใจ", referred: 4, converted: 2, pending: 1, rewards: 1000, totalReward: 1000, rank: 5 },
];

interface ReferralEvent {
  date: string;
  referrer: string;
  referred: string;
  source: string;
  status: "pending" | "trial" | "converted" | "expired";
  reward: number;
}

const RECENT_EVENTS: ReferralEvent[] = [
  { date: "2025-08-19", referrer: "คุณสมศักดิ์", referred: "คุณกมล", source: "LINE", status: "converted", reward: 500 },
  { date: "2025-08-18", referrer: "คุณวิภา", referred: "คุณพิชัย", source: "Facebook", status: "trial", reward: 0 },
  { date: "2025-08-17", referrer: "คุณนพดล", referred: "คุณจินดา", source: "LINE", status: "converted", reward: 500 },
  { date: "2025-08-15", referrer: "คุณวรรณพร", referred: "คุณสุภาพร", source: "Referral Link", status: "pending", reward: 0 },
  { date: "2025-08-14", referrer: "คุณสมศักดิ์", referred: "คุณรัตนา", source: "LINE", status: "converted", reward: 500 },
  { date: "2025-08-13", referrer: "คุณพิมพ์ใจ", referred: "คุณนภา", source: "QR Code", status: "pending", reward: 0 },
];

const STATUS_MAP: Record<string, { label: string; color: string; variant: "success" | "warning" | "outline" | "danger" }> = {
  pending: { label: "รอยืนยัน", color: "text-amber-500", variant: "warning" },
  trial: { label: "ทดลองแล้ว", color: "text-blue-500", variant: "outline" },
  converted: { label: "สมัครแล้ว", color: "text-emerald-500", variant: "success" },
  expired: { label: "หมดอายุ", color: "text-gray-400", variant: "danger" },
};

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
  const totalReferrals = LEADERBOARD.reduce((s, r) => s + r.referred, 0);
  const totalConverted = LEADERBOARD.reduce((s, r) => s + r.converted, 0);
  const totalRewards = LEADERBOARD.reduce((s, r) => s + r.totalReward, 0);
  const convRate = totalReferrals > 0 ? ((totalConverted / totalReferrals) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">🎁 Referral Tracking</h1>
        <p className="text-sm text-secondary/50">ติดตาม Referral แนะนำเพื่อน — ใครแนะนำ, convert กี่คน, ได้รางวัลเท่าไหร่</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">แนะนำทั้งหมด</p>
            <p className="text-2xl font-bold text-secondary">{totalReferrals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">สมัครแล้ว</p>
            <p className="text-2xl font-bold text-emerald-600">{totalConverted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Conversion Rate</p>
            <p className="text-2xl font-bold text-primary">{convRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">รางวัลจ่ายแล้ว</p>
            <p className="text-2xl font-bold text-amber-600">฿{totalRewards.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Program Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary-accent" />
            โปรแกรม Referral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-200/30 bg-emerald-50/5 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-secondary">ผู้แนะนำ</span>
              </div>
              <p className="text-xl font-bold text-emerald-600">฿500</p>
              <p className="text-xs text-secondary/40">ต่อเพื่อนที่สมัครสำเร็จ</p>
            </div>
            <div className="rounded-xl border border-blue-200/30 bg-blue-50/5 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-secondary">เพื่อนใหม่</span>
              </div>
              <p className="text-xl font-bold text-blue-600">฿500</p>
              <p className="text-xs text-secondary/40">ส่วนลดเมื่อสมัครคอร์ส</p>
            </div>
            <div className="rounded-xl border border-purple-200/30 bg-purple-50/5 p-4 dark:border-purple-500/20 dark:bg-purple-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium text-secondary">Top Referrer</span>
              </div>
              <p className="text-xl font-bold text-purple-600">โบนัสพิเศษ</p>
              <p className="text-xs text-secondary/40">แนะนำ 10 คน = คอร์สฟรี 1 เดือน</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Leaderboard — ผู้แนะนำยอดเยี่ยม
          </CardTitle>
          <CardDescription>จัดอันดับตามจำนวนเพื่อนที่แนะนำมาสมัครสำเร็จ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {LEADERBOARD.map((r) => (
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary-accent" />
            Referral ล่าสุด
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {RECENT_EVENTS.map((event, i) => {
            const st = STATUS_MAP[event.status] ?? STATUS_MAP.pending;
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
                {event.reward > 0 && (
                  <span className="text-xs font-bold text-amber-600">+฿{event.reward}</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Revenue Impact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Revenue Impact
          </CardTitle>
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
          <div className="mt-3 rounded-xl bg-emerald-50/5 p-3 text-xs text-emerald-700 dark:text-emerald-400">
            💡 Referral เป็นช่องทางที่มี CAC ต่ำสุด (ค่าเฉลี่ย ฿{totalConverted > 0 ? Math.round(totalRewards / totalConverted) : 0}/ลูกค้า) เทียบกับ Facebook Ads (฿200-500/ลูกค้า)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
