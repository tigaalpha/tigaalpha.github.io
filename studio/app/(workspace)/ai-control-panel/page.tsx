"use client";

import { useState } from "react";
import {
  Bot,
  Brain,
  Zap,
  Settings,
  Activity,
  BarChart3,
  Users,
  Calendar,
  MessageSquare,
  FileText,
  Target,
  TrendingUp,
  Globe,
  Sparkles,
  Check,
  Clock,
  AlertTriangle,
  RefreshCw,
  Shield,
  Coins,
  Cpu,
  ArrowRight,
  Play,
  Pause,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── AI Models ──
const AI_MODELS = [
  { id: "gemini", label: "Gemini 2.0 Flash", provider: "Google", status: "active", tier: "Fast/Free", color: "bg-blue-500" },
  { id: "mimo", label: "MiMo 7B RL", provider: "Xiaomi", status: "active", tier: "Fast/Free", color: "bg-emerald-500" },
  { id: "claude", label: "Claude Sonnet 5", provider: "Anthropic", status: "connected", tier: "Smart/Paid", color: "bg-purple-500" },
  { id: "gpt", label: "ChatGPT 5.1", provider: "OpenAI", status: "connected", tier: "Smart/Paid", color: "bg-teal-500" },
  { id: "deepseek", label: "DeepSeek V4 Flash", provider: "DeepSeek", status: "connected", tier: "Smart/Cheap", color: "bg-indigo-500" },
  { id: "qwen", label: "Qwen3 Max", provider: "Alibaba", status: "connected", tier: "Smart/Paid", color: "bg-orange-500" },
  { id: "kimi", label: "Kimi K2", provider: "Moonshot", status: "connected", tier: "Smart/Paid", color: "bg-pink-500" },
  { id: "glm", label: "GLM 5.1", provider: "Zhipu", status: "connected", tier: "Smart/Paid", color: "bg-red-500" },
  { id: "grok", label: "Grok", provider: "xAI", status: "connected", tier: "Smart/Paid", color: "bg-gray-800" },
];

// ── AI Tiers (per-task model selection) ──
const AI_TIERS = [
  {
    id: "chat",
    label: "แชทลูกค้า (LINE/เว็บ)",
    icon: MessageSquare,
    currentModel: "gemini",
    description: "ตอบลูกค้า 24/7 — ต้องเร็ว",
    stats: { calls: 1240, avgLatency: "0.8s", cost: "฿0" },
    color: "text-blue-500",
  },
  {
    id: "agent",
    label: "TIGA AI Agent (CEO)",
    icon: Bot,
    currentModel: "gemini",
    description: "สรุปวันนี้, follow-up lead, จัดตาราง",
    stats: { calls: 89, avgLatency: "1.2s", cost: "฿0" },
    color: "text-purple-500",
  },
  {
    id: "content",
    label: "สร้างคอนเทนต์ (บทความ/สคริปต์)",
    icon: FileText,
    currentModel: "mimo",
    description: "เขียน SEO, video script, ad copy",
    stats: { calls: 45, avgLatency: "3.5s", cost: "฿0" },
    color: "text-emerald-500",
  },
  {
    id: "strategy",
    label: "Strategy Room (7 Advisors)",
    icon: Brain,
    currentModel: "all",
    description: "วิเคราะห์กลยุทธ์ 7 โมเดลพร้อมกัน",
    stats: { calls: 12, avgLatency: "8s", cost: "฿15" },
    color: "text-amber-500",
  },
  {
    id: "sales",
    label: "Sales AI (Objection Handling)",
    icon: Target,
    currentModel: "mimo",
    description: "จัดการ objection, negotiation, closing",
    stats: { calls: 67, avgLatency: "2s", cost: "฿0" },
    color: "text-rose-500",
  },
];

// ── AI Tools (all 22) ──
const AI_TOOLS = [
  { name: "search_knowledge_base", category: "Knowledge", status: "active", calls: 890 },
  { name: "check_calendar_availability", category: "Calendar", status: "active", calls: 320 },
  { name: "book_lesson", category: "Calendar", status: "active", calls: 156 },
  { name: "reschedule_lesson", category: "Calendar", status: "active", calls: 45 },
  { name: "cancel_lesson", category: "Calendar", status: "active", calls: 12 },
  { name: "lookup_customer", category: "CRM", status: "active", calls: 567 },
  { name: "create_customer", category: "CRM", status: "active", calls: 89 },
  { name: "update_customer_profile", category: "CRM", status: "active", calls: 234 },
  { name: "change_sales_status", category: "Sales", status: "active", calls: 178 },
  { name: "flag_needs_review", category: "System", status: "active", calls: 23 },
  { name: "create_payment_link", category: "Payment", status: "active", calls: 67 },
  { name: "record_attendance_confirmation", category: "Calendar", status: "active", calls: 345 },
  { name: "record_transaction", category: "Finance", status: "owner-only", calls: 89 },
  { name: "save_knowledge", category: "Knowledge", status: "owner-only", calls: 34 },
  { name: "get_business_summary", category: "Reports", status: "owner-only", calls: 156 },
  { name: "list_customers_needing_attention", category: "CRM", status: "owner-only", calls: 234 },
  { name: "bulk_update_sales_status", category: "Sales", status: "owner-only", calls: 12 },
  { name: "mark_payment_paid", category: "Payment", status: "owner-only", calls: 56 },
  { name: "record_lesson_summary", category: "Reports", status: "owner-only", calls: 89 },
  { name: "create_referral_link", category: "Referral", status: "owner-only", calls: 34 },
  { name: "list_teachers", category: "Calendar", status: "active", calls: 123 },
];

// ── Recent Activity ──
const RECENT_ACTIVITY = [
  { time: "14:23", model: "Gemini", tool: "search_knowledge_base", task: "ลูกค้าถามราคาคอร์ส", status: "success", latency: "0.6s" },
  { time: "14:20", model: "MiMo", tool: "change_sales_status", task: "เปลี่ยน lead → negotiating", status: "success", latency: "1.1s" },
  { time: "14:15", model: "Gemini", tool: "book_lesson", task: "จอง trial ให้คุณพิชัย", status: "success", latency: "0.9s" },
  { time: "14:10", model: "Gemini", tool: "record_attendance_confirmation", task: "คุณกมล confirm  lesson", status: "success", latency: "0.4s" },
  { time: "14:05", model: "MiMo", tool: "create_payment_link", task: "สร้างลิงก์ ฿27,000", status: "success", latency: "1.8s" },
  { time: "13:58", model: "Gemini", tool: "lookup_customer", task: "ค้นหาลูกค้า LINE", status: "success", latency: "0.3s" },
  { time: "13:50", model: "MiMo", tool: "save_knowledge", task: "เพิ่มโปรโมชันใหม่", status: "success", latency: "2.1s" },
  { time: "13:45", model: "Gemini", tool: "get_business_summary", task: "สรุปยอดวันนี้", status: "success", latency: "1.5s" },
  { time: "13:40", model: "Gemini", tool: "flag_needs_review", task: "Escalate ลูกค้าโกรธ", status: "escalated", latency: "0.7s" },
  { time: "13:30", model: "MiMo", tool: "list_customers_needing_attention", task: "Lead ค้าง 7+ วัน", status: "success", latency: "1.9s" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Knowledge: "bg-blue-500",
  Calendar: "bg-emerald-500",
  CRM: "bg-purple-500",
  Sales: "bg-amber-500",
  Payment: "bg-rose-500",
  Finance: "bg-indigo-500",
  Reports: "bg-teal-500",
  Referral: "bg-pink-500",
  System: "bg-gray-500",
};

export default function AIControlPanelPage() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const totalCalls = AI_TOOLS.reduce((s, t) => s + t.calls, 0);
  const activeTools = AI_TOOLS.filter((t) => t.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">🤖 AI Control Panel</h1>
        <p className="text-sm text-secondary/50">ศูนย์กลางควบคุม AI ทั้งหมด — เลือกโมเดล, จัดการ tools, ดู activity</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">AI Models</p>
            <p className="text-2xl font-bold text-secondary">{AI_MODELS.length}</p>
            <p className="text-[10px] text-secondary/30">Active: {AI_MODELS.filter((m) => m.status === "active").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">AI Tools</p>
            <p className="text-2xl font-bold text-primary">{activeTools}</p>
            <p className="text-[10px] text-secondary/30">of {AI_TOOLS.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Total Calls Today</p>
            <p className="text-2xl font-bold text-emerald-600">{totalCalls.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Avg Latency</p>
            <p className="text-2xl font-bold text-amber-600">1.2s</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Cost Today</p>
            <p className="text-2xl font-bold text-emerald-600">฿15</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Models */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary-accent" />
            AI Models ที่เชื่อมต่อ ({AI_MODELS.length} ตัว)
          </CardTitle>
          <CardDescription>ทุกโมเดลใช้ผ่าน OpenRouter (1 API key) + Gemini (Google API ตรง)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {AI_MODELS.map((model) => (
              <div key={model.id} className="flex items-center gap-3 rounded-xl border border-line/10 p-3">
                <div className={cn("h-3 w-3 shrink-0 rounded-full", model.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-secondary">{model.label}</p>
                  <p className="text-[10px] text-secondary/30">{model.provider} · {model.tier}</p>
                </div>
                <Badge variant={model.status === "active" ? "success" : "outline"} className="text-[9px]">
                  {model.status === "active" ? "Active" : "Connected"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Model Per Tier */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-accent" />
            Model Selection แยกตามงาน (3 Tiers)
          </CardTitle>
          <CardDescription>เลือกโมเดลต่างกันตามประเภทงาน — ถูกสำหรับงานถูก, แรงสำหรับงานสำคัญ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {AI_TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <div key={tier.id} className="rounded-xl border border-line/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10", tier.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary">{tier.label}</p>
                      <p className="text-xs text-secondary/40">{tier.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-medium text-secondary">{tier.stats.calls} calls</p>
                      <p className="text-[10px] text-secondary/30">{tier.stats.avgLatency} · {tier.stats.cost}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px]">{tier.currentModel}</Badge>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="rounded-xl bg-primary/5 p-3 text-xs text-primary">
            💡 ไปที่ Settings → Integrations → เลือกโมเดลสำหรับแต่ละ tier — เปลี่ยนได้ทุกเมื่อโดยไม่ต้อง redeploy
          </div>
        </CardContent>
      </Card>

      {/* AI Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-accent" />
            AI Tools ทั้งหมด ({AI_TOOLS.length} tools)
          </CardTitle>
          <CardDescription>Tools ที่ AI ใช้ควบคุมระบบทุกอย่าง — 22 tools ใน 9 หมวด</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Category Summary */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
              const count = AI_TOOLS.filter((t) => t.category === cat).length;
              if (count === 0) return null;
              return (
                <div key={cat} className="flex items-center gap-1.5 rounded-lg bg-line/5 px-2 py-1">
                  <div className={cn("h-2 w-2 rounded-full", color)} />
                  <span className="text-[10px] text-secondary/60">{cat} ({count})</span>
                </div>
              );
            })}
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {AI_TOOLS.map((tool) => (
              <div key={tool.name} className="flex items-center gap-3 rounded-lg border border-line/5 px-3 py-2">
                <div className={cn("h-2 w-2 shrink-0 rounded-full", CATEGORY_COLORS[tool.category] ?? "bg-gray-400")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-secondary">{tool.name}</p>
                  <p className="text-[10px] text-secondary/30">{tool.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-secondary/50">{tool.calls}</p>
                  <Badge variant={tool.status === "active" ? "success" : "warning"} className="text-[8px]">
                    {tool.status === "active" ? "Active" : "Owner"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary-accent" />
            AI Activity Log — ล่าสุด
          </CardTitle>
          <CardDescription>งานที่ AI เพิ่งทำ — เห็นว่า model ไหน ใช้ tool ไหน ทำอะไร</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {RECENT_ACTIVITY.map((activity, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-line/5 px-3 py-2">
              <span className="text-[10px] text-secondary/30 w-12 shrink-0">{activity.time}</span>
              <Badge variant="outline" className="text-[8px] shrink-0">{activity.model}</Badge>
              <span className="text-[10px] font-mono text-primary shrink-0">{activity.tool}</span>
              <span className="flex-1 text-xs text-secondary truncate">{activity.task}</span>
              <span className="text-[10px] text-secondary/30 shrink-0">{activity.latency}</span>
              <Badge variant={activity.status === "success" ? "success" : activity.status === "escalated" ? "warning" : "danger"} className="text-[8px] shrink-0">
                {activity.status === "success" ? "✅" : activity.status === "escalated" ? "⚠️" : "❌"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-accent" />
            Quick Actions — สั่ง AI ได้ทันที
          </CardTitle>
          <CardDescription>ปุ่มลัดสั่งงาน AI ผ่าน Floating Assistant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { label: "สรุปวันนี้", icon: BarChart3, prompt: "สรุปธุรกิจวันนี้", model: "Gemini" },
              { label: "Lead ที่ควรติดตาม", icon: Users, prompt: "list customers needing attention", model: "MiMo" },
              { label: "ดู Calendar", icon: Calendar, prompt: "ดูบทเรียนวันนี้", model: "Gemini" },
              { label: "Inbox ใหม่", icon: MessageSquare, prompt: "ดูข้อความใหม่", model: "Gemini" },
              { label: "สร้าง Content", icon: FileText, prompt: "เขียนบทความ SEO", model: "MiMo" },
              { label: "วิเคราะห์ ROI", icon: TrendingUp, prompt: "วิเคราะห์ marketing ROI", model: "MiMo" },
              { label: "สร้าง Referral", icon: Target, prompt: "สร้างรหัส referral", model: "Gemini" },
              { label: "Strategy Room", icon: Brain, prompt: "วิเคราะห์กลยุทธ์", model: "7 Models" },
            ].map((action, i) => {
              const Icon = action.icon;
              return (
                <button key={i} className="flex flex-col items-center gap-2 rounded-xl border border-line/10 p-3 hover:bg-line/5 transition-colors text-center">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium text-secondary">{action.label}</span>
                  <Badge variant="outline" className="text-[8px]">{action.model}</Badge>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-accent" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { label: "Gemini API", status: "connected", detail: "Free tier" },
              { label: "OpenRouter", status: "connected", detail: "9 models" },
              { label: "LINE OA", status: "connected", detail: "@422gobjh" },
              { label: "Google Calendar", status: "connected", detail: "3 calendars" },
              { label: "Facebook Page", status: "connected", detail: "Auto-post" },
              { label: "TikTok", status: "sandbox", detail: "3 posts/day" },
              { label: "X (Twitter)", status: "connected", detail: "Auto-post" },
              { label: "Supabase DB", status: "connected", detail: "Real-time" },
            ].map((sys, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-line/5 p-2">
                <div className={cn("h-2 w-2 rounded-full", sys.status === "connected" ? "bg-emerald-500" : sys.status === "sandbox" ? "bg-amber-500" : "bg-red-500")} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-secondary">{sys.label}</p>
                  <p className="text-[10px] text-secondary/30">{sys.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
