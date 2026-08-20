"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Target,
  Zap,
  Brain,
  TrendingUp,
  Users,
  Calendar,
  ArrowRight,
  Sparkles,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StrategyAction {
  id: string;
  source: string;
  action: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  deadline: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  expectedImpact: string;
  assignee: string;
}

const ACTIONS: StrategyAction[] = [
  { id: "1", source: "Strategy Room — Revenue Growth", action: "สร้าง Landing Page สำหรับ 'เรียนเปียโนกรุงเทพ'", description: "สร้างหน้า SEO landing page ที่ Google index ได้ สำหรับ keyword หลัก", priority: "critical", category: "SEO", deadline: "สัปดาห์นี้", status: "in_progress", expectedImpact: "+20 leads/เดือน", assignee: "Owner" },
  { id: "2", source: "Strategy Room — Lead Generation", action: "เปิดตัว Referral Program v2", description: "เพิ่มรางวัลเป็น ฿750 + leaderboard + ระบบติดตาม", priority: "critical", category: "Referral", deadline: "สัปดาห์นี้", status: "todo", expectedImpact: "+8 referrals/เดือน", assignee: "Owner" },
  { id: "3", source: "Strategy Room — Content Marketing", action: "เพิ่ม TikTok posting เป็น 2 ครั้ง/วัน", description: "เปลี่ยนจาก 3 ครั้ง/สัปดาห์ เป็น 14 ครั้ง/สัปดาห์", priority: "high", category: "Content", deadline: "สัปดาห์หน้า", status: "todo", expectedImpact: "+40% reach", assignee: "AI Auto-Schedule" },
  { id: "4", source: "Strategy Room — Conversion Optimization", action: "สร้าง Post-Trial Drip Campaign", description: "ส่ง follow-up อัตโนมัติ 4 ข้อความ หลัง trial เสร็จ", priority: "high", category: "Drip Campaign", deadline: "สัปดาห์หน้า", status: "todo", expectedImpact: "+5 conversions", assignee: "Owner" },
  { id: "5", source: "Strategy Room — Paid Ads", action: "A/B test Facebook ad copy", description: "ทดสอบ 3 แบบ: 'เรียนฟรี' vs 'ทดลองฟรี' vs 'เล่นเปียโนเป็น'", priority: "high", category: "Ads", deadline: "สัปดาห์หน้า", status: "todo", expectedImpact: "-฿750 CAC", assignee: "Owner" },
  { id: "6", source: "Strategy Room — Winback", action: "ส่ง LINE หาคุณกัญญา (36 วันไม่มา)", description: "มีชั่วโมงเหลือ 12 ชม. — สูง risk ต้องรีบติดตาม", priority: "high", category: "Winback", deadline: "วันนี้", status: "todo", expectedImpact: "กันลูกค้าหลุด", assignee: "Owner" },
  { id: "7", source: "Strategy Room — SEO", action: "เขียน blog 'เปียโน vs กีตาร์' ให้เสร็จ", description: "Draft มีอยู่แล้ว เหลือ proofread + publish", priority: "medium", category: "SEO", deadline: "สัปดาห์หน้า", status: "in_progress", expectedImpact: "+500 views", assignee: "Owner" },
  { id: "8", source: "Strategy Room — Social Media", action: "เพิ่ม Instagram Reels 3 คลิป/สัปดาห์", description: "Reels มี reach สูงสุดใน Instagram", priority: "medium", category: "Content", deadline: "สัปดาห์หน้า", status: "todo", expectedImpact: "+200 reach", assignee: "Owner" },
  { id: "9", source: "Strategy Room — Google", action: "อัปเดต Google Business Profile", description: "เพิ่มรูป 5 รูป + ขอ review จากนักเรียน 3 คน", priority: "medium", category: "Google", deadline: "สัปดาห์หน้า", status: "todo", expectedImpact: "+15% profile views", assignee: "Owner" },
  { id: "10", source: "Strategy Room — Revenue", action: "สร้าง Upsell Path: Video → Private", description: "หลังเรียน video course จบ → 提案 Private course", priority: "low", category: "Sales", deadline: "เดือนหน้า", status: "todo", expectedImpact: "+฿27,000/student", assignee: "AI Sales" },
];

const PRIORITY_MAP: Record<string, { label: string; variant: "danger" | "warning" | "info" | "outline" }> = {
  critical: { label: "🔴 Critical", variant: "danger" },
  high: { label: "🟠 High", variant: "warning" },
  medium: { label: "🟡 Medium", variant: "info" },
  low: { label: "🟢 Low", variant: "outline" },
};

const STATUS_MAP: Record<string, { label: string; icon: typeof Circle; color: string }> = {
  todo: { label: "To Do", icon: Circle, color: "text-secondary/40" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-amber-500" },
  done: { label: "Done", icon: CheckCircle2, color: "text-emerald-500" },
  blocked: { label: "Blocked", icon: AlertCircle, color: "text-red-500" },
};

export default function StrategyActionsPage() {
  const [filter, setFilter] = useState<string>("all");

  const done = ACTIONS.filter((a) => a.status === "done").length;
  const inProgress = ACTIONS.filter((a) => a.status === "in_progress").length;
  const todo = ACTIONS.filter((a) => a.status === "todo").length;
  const progress = ACTIONS.length > 0 ? ((done / ACTIONS.length) * 100).toFixed(0) : "0";

  const filteredActions = filter === "all" ? ACTIONS : ACTIONS.filter((a) => a.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">🎯 Strategy Action Items</h1>
        <p className="text-sm text-secondary/50">แปลง Strategy Room output → งานที่ทำได้จริง พร้อมติดตาม progress</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">ทั้งหมด</p>
            <p className="text-2xl font-bold text-secondary">{ACTIONS.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">To Do</p>
            <p className="text-2xl font-bold text-secondary">{todo}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">In Progress</p>
            <p className="text-2xl font-bold text-amber-600">{inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Done</p>
            <p className="text-2xl font-bold text-emerald-600">{done}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Progress</p>
            <p className="text-2xl font-bold text-primary">{progress}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="h-4 rounded-full bg-line/5 overflow-hidden flex">
            {done > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(done / ACTIONS.length) * 100}%` }} />}
            {inProgress > 0 && <div className="h-full bg-amber-500" style={{ width: `${(inProgress / ACTIONS.length) * 100}%` }} />}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-secondary/50">
            <span>✅ Done: {done}</span>
            <span>🔄 In Progress: {inProgress}</span>
            <span>📋 To Do: {todo}</span>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "todo", "in_progress", "done"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "all" ? "ทั้งหมด" : f === "todo" ? "To Do" : f === "in_progress" ? "In Progress" : "Done"}
          </Button>
        ))}
      </div>

      {/* Action Items */}
      <div className="space-y-3">
        {filteredActions.map((action) => {
          const pri = PRIORITY_MAP[action.priority] ?? PRIORITY_MAP.low;
          const st = STATUS_MAP[action.status] ?? STATUS_MAP.todo;
          const StatusIcon = st.icon;
          return (
            <Card key={action.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <StatusIcon className={cn("h-5 w-5 shrink-0 mt-0.5", st.color)} />
                    <div>
                      <p className="text-sm font-medium text-secondary">{action.action}</p>
                      <p className="text-xs text-secondary/40 mt-1">{action.description}</p>
                    </div>
                  </div>
                  <Badge variant={pri.variant} className="text-[9px] shrink-0">{pri.label}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 ml-8">
                  <Badge variant="outline" className="text-[9px]">{action.category}</Badge>
                  <span className="text-[10px] text-secondary/30">📅 {action.deadline}</span>
                  <span className="text-[10px] text-secondary/30">👤 {action.assignee}</span>
                  <span className="text-[10px] text-emerald-600">📈 {action.expectedImpact}</span>
                </div>
                <div className="ml-8 text-[10px] text-secondary/30">
                  🧠 Source: {action.source}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Strategy Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary-accent" />
            Strategy Sources
          </CardTitle>
          <CardDescription>Strategy sessions ที่สร้าง action items เหล่านี้</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { session: "Revenue Growth Strategy", date: "2025-08-15", agents: 7, actions: 3 },
            { session: "Lead Generation Plan", date: "2025-08-14", agents: 7, actions: 2 },
            { session: "Content Marketing Review", date: "2025-08-13", agents: 5, actions: 3 },
            { session: "Winback Analysis", date: "2025-08-12", agents: 7, actions: 2 },
          ].map((session, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
              <div>
                <p className="text-xs font-medium text-secondary">{session.session}</p>
                <p className="text-[10px] text-secondary/30">{session.date} · {session.agents} agents</p>
              </div>
              <Badge variant="outline" className="text-[9px]">{session.actions} actions</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
