"use client";

import { useState } from "react";
import {
  GitBranch,
  Zap,
  Brain,
  Bot,
  ArrowRight,
  Check,
  Settings,
  BarChart3,
  Clock,
  Coins,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoutingRule {
  category: string;
  tasks: string[];
  defaultModel: string;
  reason: string;
  complexity: "low" | "medium" | "high";
  icon: typeof Zap;
  color: string;
}

const ROUTING_RULES: RoutingRule[] = [
  {
    category: "Customer Chat",
    tasks: ["ตอบคำถามทั่วไป", "ถามราคา/โปรโมชัน", "ทักทาย/ปิดท้าย", "ถามนโยบาย"],
    defaultModel: "gemini",
    reason: "ต้องตอบเร็ว, คำถามซ้ำ, ใช้ Knowledge Base เป็นหลัก",
    complexity: "low",
    icon: Zap,
    color: "text-blue-500",
  },
  {
    category: "Lead Qualification",
    tasks: ["收集ข้อมูลลูกค้า", "อัปเดต profile", "Lead scoring", "เปลี่ยน sales status"],
    defaultModel: "gemini",
    reason: "งาน straightforward, ใช้ tool calls, ต้องเร็ว",
    complexity: "low",
    icon: Bot,
    color: "text-purple-500",
  },
  {
    category: "Booking & Calendar",
    tasks: ["จองเรียน", "เลื่อนเรียน", "ยืนยันการมา", "ดูคาบว่าง"],
    defaultModel: "gemini",
    reason: "API calls ตรง, ไม่ต้องคิดมาก, ต้องเร็ว",
    complexity: "low",
    icon: Clock,
    color: "text-emerald-500",
  },
  {
    category: "Payment & Finance",
    tasks: ["สร้างลิงก์ชำระเงิน", "ยืนยันการโอน", "บันทึกรายรับ/รายจ่าย"],
    defaultModel: "gemini",
    reason: "transactional, ไม่ต้องวิเคราะห์, ต้องถูกต้อง",
    complexity: "low",
    icon: Coins,
    color: "text-amber-500",
  },
  {
    category: "Objection Handling",
    tasks: ["ลูกค้าบอกแพง", "เปรียบเทียบโรงเรียน", "ต่อรองราคา", "ลังเลไม่ตัดสินใจ"],
    defaultModel: "mimo",
    reason: "ต้องเข้าใจ context ซับซ้อน, ต้อง persuasion skill",
    complexity: "medium",
    icon: Brain,
    color: "text-rose-500",
  },
  {
    category: "Winback & Re-engagement",
    tasks: ["ลูกค้าหายไป 14+ วัน", "เหลือชั่วโมงน้อย", "ไม่ต่ออายุ"],
    defaultModel: "mimo",
    reason: "ต้องวิเคราะห์ behavior, สร้างข้อความเฉพาะบุคคล",
    complexity: "medium",
    icon: Sparkles,
    color: "text-orange-500",
  },
  {
    category: "Content Generation",
    tasks: ["เขียนบทความ SEO", "Video script", "Ad copy", "Social media post"],
    defaultModel: "mimo",
    reason: "ต้องเขียนดี, สร้างสรรค์, มี SEO knowledge",
    complexity: "high",
    icon: Sparkles,
    color: "text-indigo-500",
  },
  {
    category: "Strategy Analysis",
    tasks: ["วิเคราะห์ ROI", "เปรียบเทียบ channels", "วางแผนกลยุทธ์", "ทำนาย trend"],
    defaultModel: "all (7 models)",
    reason: "Strategy Room ใช้ 7 โมเดลพร้อมกัน เทียบคำตอบ side-by-side",
    complexity: "high",
    icon: Brain,
    color: "text-amber-500",
  },
  {
    category: "Daily Briefing",
    tasks: ["สรุปวันนี้", "นักเรียนวันนี้", "Lead ค้าง", "Revenue วันนี้"],
    defaultModel: "gemini",
    reason: "รวมข้อมูลจากหลาย table, ต้องเร็ว, ไม่ต้องวิเคราะห์ลึก",
    complexity: "medium",
    icon: BarChart3,
    color: "text-teal-500",
  },
  {
    category: "Knowledge Management",
    tasks: ["เพิ่มข้อมูลใหม่", "อัปเดตราคา", "แก้ไขนโยบาย", "เพิ่ม sales script"],
    defaultModel: "gemini",
    reason: "save_knowledge tool call, straightforward",
    complexity: "low",
    icon: Settings,
    color: "text-gray-500",
  },
];

const COMPLEXITY_MAP: Record<string, { label: string; variant: "success" | "warning" | "danger"; model: string }> = {
  low: { label: "Low — Gemini", variant: "success", model: "gemini" },
  medium: { label: "Medium — MiMo", variant: "warning", model: "mimo" },
  high: { label: "High — All Models", variant: "danger", model: "all" },
};

const MODEL_COLORS: Record<string, string> = {
  gemini: "bg-blue-500",
  mimo: "bg-emerald-500",
  all: "bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500",
};

export default function AITaskRouterPage() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const totalTasks = ROUTING_RULES.reduce((s, r) => s + r.tasks.length, 0);
  const geminiTasks = ROUTING_RULES.filter((r) => r.defaultModel === "gemini").reduce((s, r) => s + r.tasks.length, 0);
  const mimoTasks = ROUTING_RULES.filter((r) => r.defaultModel === "mimo").reduce((s, r) => s + r.tasks.length, 0);
  const allTasks = ROUTING_RULES.filter((r) => r.defaultModel === "all (7 models)").reduce((s, r) => s + r.tasks.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">🔀 AI Task Router</h1>
        <p className="text-sm text-secondary/50">ระบบกระจายงาน AI ตาม complexity — Low = Gemini, Medium = MiMo, High = All Models</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">งานทั้งหมด</p>
            <p className="text-2xl font-bold text-secondary">{totalTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <p className="text-xs text-secondary/50">Gemini (Fast)</p>
            </div>
            <p className="text-2xl font-bold text-blue-500">{geminiTasks}</p>
            <p className="text-[10px] text-secondary/30">งานเร็ว / ฟรี</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <p className="text-xs text-secondary/50">MiMo (Smart)</p>
            </div>
            <p className="text-2xl font-bold text-emerald-500">{mimoTasks}</p>
            <p className="text-[10px] text-secondary/30">งานซับซ้อน / ถูก</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" />
              <p className="text-xs text-secondary/50">All (Strategy)</p>
            </div>
            <p className="text-2xl font-bold text-primary">{allTasks}</p>
            <p className="text-[10px] text-secondary/30">วิเคราะห์ลึก / 7 ตัว</p>
          </CardContent>
        </Card>
      </div>

      {/* Routing Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary-accent" />
            Routing Flow
          </CardTitle>
          <CardDescription>งานเข้ามา → วิเคราะห์ complexity → ส่งไป model ที่เหมาะสม</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 overflow-x-auto py-4">
            {/* Input */}
            <div className="rounded-xl border border-line/10 bg-line/5 p-4 text-center shrink-0">
              <p className="text-xs font-medium text-secondary">📨 Task</p>
              <p className="text-[10px] text-secondary/30">User request</p>
            </div>

            <ArrowRight className="h-4 w-4 text-secondary/30 shrink-0" />

            {/* Router */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center shrink-0">
              <p className="text-xs font-medium text-primary">🧠 Router</p>
              <p className="text-[10px] text-secondary/30">วิเคราะห์ complexity</p>
            </div>

            <ArrowRight className="h-4 w-4 text-secondary/30 shrink-0" />

            {/* Outputs */}
            <div className="flex gap-3 shrink-0">
              <div className="rounded-xl border border-blue-200/30 bg-blue-50/5 p-3 text-center dark:border-blue-500/20 dark:bg-blue-500/5">
                <div className="h-3 w-3 rounded-full bg-blue-500 mx-auto mb-1" />
                <p className="text-[10px] font-medium text-secondary">Low</p>
                <p className="text-[10px] text-secondary/30">Gemini</p>
              </div>
              <div className="rounded-xl border border-emerald-200/30 bg-emerald-50/5 p-3 text-center dark:border-emerald-500/20 dark:bg-emerald-500/5">
                <div className="h-3 w-3 rounded-full bg-emerald-500 mx-auto mb-1" />
                <p className="text-[10px] font-medium text-secondary">Medium</p>
                <p className="text-[10px] text-secondary/30">MiMo</p>
              </div>
              <div className="rounded-xl border border-purple-200/30 bg-purple-50/5 p-3 text-center dark:border-purple-500/20 dark:bg-purple-500/5">
                <div className="h-3 w-3 rounded-full bg-purple-500 mx-auto mb-1" />
                <p className="text-[10px] font-medium text-secondary">High</p>
                <p className="text-[10px] text-secondary/30">All 7</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Routing Rules */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-secondary">Routing Rules ทั้งหมด ({ROUTING_RULES.length} หมวด)</h2>
        {ROUTING_RULES.map((rule) => {
          const complexity = COMPLEXITY_MAP[rule.complexity];
          const isExpanded = expandedCategory === rule.category;
          const Icon = rule.icon;
          return (
            <Card key={rule.category}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10", rule.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary">{rule.category}</p>
                      <p className="text-xs text-secondary/40">{rule.tasks.length} tasks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={complexity.variant} className="text-[9px]">{complexity.label}</Badge>
                    <div className={cn("h-3 w-3 rounded-full", MODEL_COLORS[rule.defaultModel] ?? "bg-gray-400")} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t border-line/10 pt-3">
                    <p className="text-xs text-secondary/40">📋 Tasks:</p>
                    <div className="flex flex-wrap gap-1">
                      {rule.tasks.map((task, i) => (
                        <Badge key={i} variant="outline" className="text-[9px]">{task}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-secondary/50">💬 เหตุผล: {rule.reason}</p>
                  </div>
                )}

                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : rule.category)}
                  className="mt-2 text-[10px] text-primary"
                >
                  {isExpanded ? "ปิด" : "ดูรายละเอียด"}
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cost Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary-accent" />
            Cost Comparison
          </CardTitle>
          <CardDescription>เปรียบเทียบค่าใช้จ่ายของแต่ละ model ต่อ 1,000 calls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { model: "Gemini 2.0 Flash", input: "$0.075", output: "$0.30", total: "~฿35", color: "bg-blue-500" },
              { model: "MiMo 7B RL", input: "$0.10", output: "$0.20", total: "~฿30", color: "bg-emerald-500" },
              { model: "Claude Sonnet 5", input: "$3.00", output: "$15.00", total: "~฿600", color: "bg-purple-500" },
              { model: "ChatGPT 5.1", input: "$2.50", output: "$10.00", total: "~฿430", color: "bg-teal-500" },
              { model: "DeepSeek V4 Flash", input: "$0.14", output: "$0.28", total: "~฿42", color: "bg-indigo-500" },
            ].map((m) => (
              <div key={m.model} className="flex items-center gap-3 rounded-lg border border-line/5 px-3 py-2">
                <div className={cn("h-2 w-2 rounded-full", m.color)} />
                <span className="w-32 text-xs font-medium text-secondary">{m.model}</span>
                <span className="flex-1 text-[10px] text-secondary/40">In: {m.input} · Out: {m.output}</span>
                <span className="text-xs font-bold text-secondary">{m.total}/1K</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
