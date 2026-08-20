"use client";

import { useState } from "react";
import {
  Clock,
  Calendar,
  Zap,
  BarChart3,
  Target,
  Users,
  TrendingUp,
  Sparkles,
  Check,
  AlertCircle,
  Globe,
  Music2,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  MessageCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OptimalSlot {
  day: string;
  time: string;
  platform: string;
  score: number;
  expectedReach: number;
  reason: string;
}

const OPTIMAL_SLOTS: OptimalSlot[] = [
  { day: "จันทร์", time: "07:30", platform: "LINE OA", score: 95, expectedReach: 450, reason: "คุณแม่เปิด LINE ก่อนส่งลูกไปโรงเรียน" },
  { day: "จันทร์", time: "12:00", platform: "Facebook", score: 88, expectedReach: 320, reason: "พักกลางวัน — คนเลื่อน Facebook เยอะ" },
  { day: "จันทร์", time: "19:00", platform: "TikTok", score: 92, expectedReach: 850, reason: "ช่วงเย็นหลังเลิกงาน — peak TikTok usage" },
  { day: "อังคาร", time: "08:00", platform: "Instagram", score: 85, expectedReach: 280, reason: "คนเช็ค Instagram ตอนเช้า" },
  { day: "อังคาร", time: "20:00", platform: "YouTube", score: 90, expectedReach: 400, reason: "ดู YouTube ช่วงก่อนนอน" },
  { day: "พุธ", time: "07:00", platform: "LINE OA", score: 93, expectedReach: 420, reason: "mid-week — คนเปิด LINE เช็คข่าว" },
  { day: "พุธ", time: "18:30", platform: "TikTok", score: 94, expectedReach: 920, reason: "Wednesday peak — คนกลับถึงบ้านแล้ว" },
  { day: "พฤหัส", time: "12:30", platform: "Facebook", score: 86, expectedReach: 300, reason: "พักกลางวันวันพฤหัส" },
  { day: "ศุกร์", time: "19:30", platform: "TikTok", score: 96, expectedReach: 1100, reason: "Friday night — peak social media ของสัปดาห์" },
  { day: "ศุกร์", time: "20:00", platform: "Instagram", score: 91, expectedReach: 380, reason: "Reels views สูงสุดวันศุกร์" },
  { day: "เสาร์", time: "10:00", platform: "Facebook", score: 89, expectedReach: 450, reason: "วันหยุด — คนเลื่อน Facebook ตอนเช้า" },
  { day: "เสาร์", time: "14:00", platform: "LINE OA", score: 87, expectedReach: 380, reason: "บ่ายวันเสาร์ — คนวางแผนสัปดาห์หน้า" },
  { day: "อาทิตย์", time: "09:00", platform: "YouTube", score: 88, expectedReach: 500, reason: "ดู YouTube ช่วงเช้าวันอาทิตย์" },
  { day: "อาทิตย์", time: "20:00", platform: "TikTok", score: 93, expectedReach: 1050, reason: "Sunday night — คนดู TikTok ก่อนนอน" },
];

interface ScheduledPost {
  id: string;
  content: string;
  platform: string;
  scheduledTime: string;
  status: "scheduled" | "posted" | "failed";
  autoOptimized: boolean;
}

const SCHEDULED_POSTS: ScheduledPost[] = [
  { id: "1", content: "🎹 เคยสงสัยไหมว่า ทำไมเด็กบางคนเรียนเปียโนแล้วเก่งเร็วกว่าคนอื่น? คำตอบอยู่ที่...", platform: "TikTok", scheduledTime: "ศุกร์ 19:30", status: "scheduled", autoOptimized: true },
  { id: "2", content: "📚 5 เหตุผลที่ควรเริ่มเรียนเปียโนตอนอายุ 6-12 ปี", platform: "Facebook", scheduledTime: "เสาร์ 10:00", status: "scheduled", autoOptimized: true },
  { id: "3", content: "🎵 นักเรียนของเราเล่น Moonlight Sonata ได้แล้ว! หลังเรียนแค่ 3 เดือน", platform: "Instagram", scheduledTime: "อาทิตย์ 20:00", status: "scheduled", autoOptimized: true },
  { id: "4", content: "🎉 จองเรียนทดลองฟรี 30 นาที — เหลือแค่ 2 ที่สัปดาห์นี้!", platform: "LINE OA", scheduledTime: "จันทร์ 07:30", status: "scheduled", autoOptimized: true },
];

const PLATFORM_ICONS: Record<string, typeof Globe> = {
  "LINE OA": MessageCircle,
  Facebook: Facebook,
  TikTok: Music2,
  Instagram: Instagram,
  YouTube: Youtube,
  X: Twitter,
};

const PLATFORM_COLORS: Record<string, string> = {
  "LINE OA": "bg-green-500",
  Facebook: "bg-blue-600",
  TikTok: "bg-black",
  Instagram: "bg-pink-500",
  YouTube: "bg-red-500",
  X: "bg-gray-800",
};

function ScoreBadge({ score }: { score: number }) {
  if (score >= 90) return <Badge variant="success">🔥 {score}</Badge>;
  if (score >= 80) return <Badge variant="info">👍 {score}</Badge>;
  return <Badge variant="outline">{score}</Badge>;
}

export default function AutoSchedulePage() {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const filteredSlots = selectedDay ? OPTIMAL_SLOTS.filter((s) => s.day === selectedDay) : OPTIMAL_SLOTS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">⏰ AI Auto-Schedule</h1>
        <p className="text-sm text-secondary/50">AI เลือกเวลาโพสต์ที่ดีสุดสำหรับแต่ละ platform — อิงข้อมูลจริง</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Slots ทั้งหมด</p>
            <p className="text-2xl font-bold text-secondary">{OPTIMAL_SLOTS.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Expected Reach รวม</p>
            <p className="text-2xl font-bold text-primary">{OPTIMAL_SLOTS.reduce((s, slot) => s + slot.expectedReach, 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Auto-Optimized</p>
            <p className="text-2xl font-bold text-emerald-600">{SCHEDULED_POSTS.filter((p) => p.autoOptimized).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Scheduled</p>
            <p className="text-2xl font-bold text-amber-600">{SCHEDULED_POSTS.filter((p) => p.status === "scheduled").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Best Times Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-accent" />
            เวลาโพสต์ที่ดีสุด — แยกตาม Platform
          </CardTitle>
          <CardDescription>AI วิเคราะห์จากข้อมูล engagement จริง → แนะนำเวลาที่คนเห็นเยอะสุด</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Day Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant={selectedDay === null ? "default" : "outline"} size="sm" onClick={() => setSelectedDay(null)}>ทั้งสัปดาห์</Button>
            {["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"].map((day) => (
              <Button key={day} variant={selectedDay === day ? "default" : "outline"} size="sm" onClick={() => setSelectedDay(day)}>{day}</Button>
            ))}
          </div>

          {/* Slots */}
          <div className="space-y-2">
            {filteredSlots.sort((a, b) => b.score - a.score).map((slot, i) => {
              const Icon = PLATFORM_ICONS[slot.platform] ?? Globe;
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-line/10 p-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white", PLATFORM_COLORS[slot.platform] ?? "bg-gray-500")}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-secondary">{slot.platform}</span>
                      <ScoreBadge score={slot.score} />
                    </div>
                    <p className="text-xs text-secondary/40">{slot.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-secondary">{slot.day} {slot.time}</p>
                    <p className="text-[10px] text-secondary/40">~{slot.expectedReach} คน</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-accent" />
            คิวโพสต์ที่ Schedule แล้ว
          </CardTitle>
          <CardDescription>โพสต์ที่ AI เลือกเวลาให้แล้ว — พร้อมโพสต์อัตโนมัติ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {SCHEDULED_POSTS.map((post) => (
            <div key={post.id} className="flex items-center gap-3 rounded-xl border border-line/10 p-3">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-xs", PLATFORM_COLORS[post.platform] ?? "bg-gray-500")}>
                {post.platform.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-secondary line-clamp-1">{post.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[9px]">{post.platform}</Badge>
                  {post.autoOptimized && <Badge variant="success" className="text-[9px]">🤖 Auto-scheduled</Badge>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-secondary">{post.scheduledTime}</p>
                <Badge variant={post.status === "scheduled" ? "warning" : post.status === "posted" ? "success" : "danger"} className="text-[9px]">
                  {post.status === "scheduled" ? "รอโพสต์" : post.status === "posted" ? "โพสต์แล้ว" : "ล้มเหลว"}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Platform Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-accent" />
            เปรียบเทียบ Platform — เวลาไหนดีสุด
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries(PLATFORM_COLORS).map(([platform, color]) => {
              const platformSlots = OPTIMAL_SLOTS.filter((s) => s.platform === platform);
              const bestSlot = platformSlots.sort((a, b) => b.score - a.score)[0];
              if (!bestSlot) return null;
              return (
                <div key={platform} className="rounded-xl border border-line/10 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("h-3 w-3 rounded-full", color)} />
                    <span className="text-sm font-medium text-secondary">{platform}</span>
                  </div>
                  <p className="text-lg font-bold text-secondary">{bestSlot.day} {bestSlot.time}</p>
                  <p className="text-xs text-secondary/40">Score: {bestSlot.score} · ~{bestSlot.expectedReach} คน</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
