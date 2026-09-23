"use client";

import { useState, useEffect } from "react";
import {
  Gift, Users, Trophy, Copy, Check, TrendingUp, Share2, Percent,
  Crown, Medal, Award, Target, RefreshCw, Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";

/**
 * Referral Tracking — reads the REAL referrals table via the referral_stats()
 * RPC (supabase-referral-loop-migration.sql). Previously this page
 * regex-scraped customers.notes / lead_source strings, which never matched
 * what actually happened. Now every row is a real attribution: the web widget
 * (?ref=CODE) or the LINE AI (apply_referral_code tool) linked a friend to a
 * referrer's code, and the payments flow marks reward_granted when they pay.
 */

interface ReferralRow {
  id: string;
  code: string;
  referrerName: string;
  referrerPhone: string | null;
  referredName: string;
  referredPhone: string | null;
  status: "code_shared" | "pending" | "trial" | "converted" | "rewarded";
  createdAt: string;
}

interface ReferralStats {
  referrals: ReferralRow[];
  totals: { total: number; attributed: number; converted: number; rewardsPending: number };
}

// Display-only reward estimate per converted referral (same figure the
// program-info card promises the owner; actual granting is manual/owner-side).
const REWARD_BAHT = 500;

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

const STATUS_MAP: Record<ReferralRow["status"], { label: string; variant: "success" | "warning" | "outline" | "danger" | "secondary" }> = {
  code_shared: { label: "แชร์โค้ดแล้ว", variant: "secondary" },
  pending: { label: "รอยืนยัน", variant: "warning" },
  trial: { label: "ทดลองเรียน", variant: "outline" },
  converted: { label: "สมัครแล้ว", variant: "success" },
  rewarded: { label: "มอบรางวัลแล้ว", variant: "success" },
};

interface Referrer {
  name: string;
  referred: number;
  converted: number;
  pending: number;
  totalReward: number;
  rank: number;
}

export default function ReferralTrackingPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [totals, setTotals] = useState<ReferralStats["totals"]>({ total: 0, attributed: 0, converted: 0, rewardsPending: 0 });

  async function loadReferralData() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await createClient().rpc("referral_stats");
      if (error) throw error;
      const stats = data as ReferralStats | null;
      setRows(stats?.referrals ?? []);
      setTotals(stats?.totals ?? { total: 0, attributed: 0, converted: 0, rewardsPending: 0 });
    } catch (err) {
      console.error("Failed to load referral stats:", err);
      setLoadError("โหลดข้อมูลไม่สำเร็จ — ตรวจว่า migration referral-loop ถูก apply แล้ว");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReferralData(); }, []);

  // Leaderboard: group real referral rows by referrer.
  const leaderboard: Referrer[] = Object.values(
    rows.reduce<Record<string, { name: string; referred: number; converted: number; pending: number }>>((acc, r) => {
      const key = r.referrerName || "—";
      acc[key] = acc[key] || { name: key, referred: 0, converted: 0, pending: 0 };
      acc[key].referred++;
      if (r.status === "converted" || r.status === "rewarded") acc[key].converted++;
      else if (r.status !== "code_shared") acc[key].pending++;
      return acc;
    }, {}),
  )
    .map((r) => ({ ...r, totalReward: r.converted * REWARD_BAHT, rank: 0 }))
    .sort((a, b) => b.converted - a.converted || b.referred - a.referred)
    .map((r, i) => ({ ...r, rank: i + 1 }))
    .slice(0, 10);

  const totalConverted = totals.converted;
  const totalRewards = leaderboard.reduce((s, r) => s + r.totalReward, 0);
  const convRate = totals.attributed > 0 ? ((totalConverted / totals.attributed) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🎁 Referral Tracking</h1>
          <p className="text-sm text-secondary/50">ติดตาม Referral แนะนำเพื่อน — ข้อมูลจริงจากตาราง referrals (โค้ด + ?ref= ลิงก์ + AI บันทึกในแชท)</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadReferralData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">โค้ดถูกใช้ทั้งหมด</p><p className="text-2xl font-bold text-secondary">{totals.total}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">ผูกลูกค้าแล้ว</p><p className="text-2xl font-bold text-blue-600">{totals.attributed}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">สมัครแล้ว ({convRate}%)</p><p className="text-2xl font-bold text-emerald-600">{totalConverted}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">รางวัลรอมอบ</p><p className="text-2xl font-bold text-amber-600">{totals.rewardsPending}</p></CardContent></Card>
      </div>

      {loadError && (
        <Card><CardContent className="pt-4"><p className="text-sm text-red-500">{loadError}</p></CardContent></Card>
      )}

      {/* Referral Program Info */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary-accent" />โปรแกรม Referral</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-200/30 bg-emerald-50/5 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
              <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-emerald-500" /><span className="text-sm font-medium text-secondary">ผู้แนะนำ</span></div>
              <p className="text-xl font-bold text-emerald-600">฿{REWARD_BAHT}</p>
              <p className="text-xs text-secondary/40">ต่อเพื่อนที่สมัครสำเร็จ — ระบบแจ้งเตือนอัตโนมัติเมื่อเพื่อนจ่ายเงิน</p>
            </div>
            <div className="rounded-xl border border-blue-200/30 bg-blue-50/5 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
              <div className="flex items-center gap-2 mb-2"><Share2 className="h-4 w-4 text-blue-500" /><span className="text-sm font-medium text-secondary">เพื่อนใหม่</span></div>
              <p className="text-xl font-bold text-blue-600">฿{REWARD_BAHT}</p>
              <p className="text-xs text-secondary/40">ส่วนลดเมื่อสมัครคอร์ส — โค้ดใช้ได้หลายคน ไม่จำกัดจำนวนเพื่อน</p>
            </div>
            <div className="rounded-xl border border-purple-200/30 bg-purple-50/5 p-4 dark:border-purple-500/20 dark:bg-purple-500/5">
              <div className="flex items-center gap-2 mb-2"><Percent className="h-4 w-4 text-purple-500" /><span className="text-sm font-medium text-secondary">Top Referrer</span></div>
              <p className="text-xl font-bold text-purple-600">โบนัสพิเศษ</p>
              <p className="text-xs text-secondary/40">แนะนำ 10 คน = คอร์สฟรี 1 เดือน</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-secondary/40">
            โค้ดถูกสร้างให้ลูกค้าโดย AI ในแชทอัตโนมัติ (get_my_referral_code) — ลิงก์แชร์จะพาเพื่อนมาเปิดแชทพร้อมโค้ด
            (?ref=) และระบบผูกลูกค้าให้เองทันทีที่เพื่อนทักมา ไม่ต้องจดจำโค้ด
          </p>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />Leaderboard — ผู้แนะนำยอดเยี่ยม</CardTitle>
          <CardDescription>จัดอันดับตามจำนวนเพื่อนที่แนะนำมาสมัครสำเร็จ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <div className="text-center py-4 text-secondary/50">กำลังโหลด...</div> : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-secondary/50">ยังไม่มีข้อมูล Referral — AI จะสร้างโค้ดให้ลูกค้าที่พอใจอัตโนมัติในแชท</div>
          ) : leaderboard.map((r) => (
            <div key={r.name} className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 transition-all", r.rank <= 3 ? "border-primary/20 bg-primary/5" : "border-line/10")}>
              <RankBadge rank={r.rank} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary">{r.name}</p>
                <div className="flex gap-3 text-[10px] text-secondary/40">
                  <span>แนะนำ {r.referred} คน</span>
                  <span>สมัคร {r.converted} คน</span>
                  <span>กำลังดำเนินการ {r.pending} คน</span>
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
          {loading ? <div className="text-center py-4 text-secondary/50">กำลังโหลด...</div> : rows.length === 0 ? (
            <div className="text-center py-4 text-secondary/50">ยังไม่มี referral events</div>
          ) : rows.slice(0, 12).map((event) => {
            const st = STATUS_MAP[event.status] ?? STATUS_MAP.pending;
            return (
              <div key={event.id} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-secondary">
                      <span className="font-medium">{event.referrerName}</span>
                      {event.status === "code_shared" ? " แชร์โค้ด" : " แนะนำ"} <span className="font-medium">{event.referredName}</span>
                    </p>
                    <Badge variant={st.variant} className="text-[9px]">{st.label}</Badge>
                  </div>
                  <p className="text-[10px] text-secondary/30">
                    {event.createdAt?.slice(0, 10) || "—"} · โค้ด {event.code}
                    {event.referredPhone ? ` · ${event.referredPhone}` : ""}
                  </p>
                </div>
                {(event.status === "converted" || event.status === "rewarded") && (
                  <span className="text-xs font-bold text-amber-600">+฿{REWARD_BAHT}</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Revenue Impact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-500" />Revenue Impact</CardTitle>
          <CardDescription>Referral program สร้างรายได้ให้ธุรกิจเท่าไหร่ (ประมาณการจากคอร์สเฉลี่ย ฿27,000)</CardDescription>
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
              <p className="text-[10px] text-secondary/40">รางวัลที่ควรจ่าย</p>
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

      {/* How the loop works — so the owner can trust the numbers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary-accent" />วงจรทำงานของระบบ</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-secondary/60 space-y-1">
          <p>1. AI แชทกับลูกค้าที่พอใจ → สร้างโค้ดส่วนตัว + ลิงก์แชร์ให้ทันที (get_my_referral_code)</p>
          <p>2. เพื่อนกดลิงก์ (?ref=CODE) → เว็บแชทจำโค้ดไว้ → กรอกชื่อ/เบอร์ → ระบบผูกเป็นลูกค้าใหม่ของผู้แนะนำทันที</p>
          <p>3. หรือเพื่อนพิมพ์โค้ดในแชท LINE เอง → AI บันทึกด้วย apply_referral_code</p>
          <p>4. เพื่อนจ่ายเงิน → ระบบแจ้งเตือนให้มอบรางวัลผู้แนะนำทันที (และทำเครื่องหมายในหน้านี้)</p>
        </CardContent>
      </Card>
    </div>
  );
}
