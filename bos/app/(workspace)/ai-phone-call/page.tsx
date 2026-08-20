"use client";

import { Phone, PhoneForwarded, PhoneIncoming, Clock, Users, Check, TrendingUp, BarChart3, AlertTriangle, Bot, Mic, Volume2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CallLog {
  id: string;
  caller: string;
  phone: string;
  time: string;
  duration: string;
  status: "completed" | "missed" | "transferred";
  aiAction: string;
  result: string;
  sentiment: "positive" | "neutral" | "negative";
}

const CALL_LOGS: CallLog[] = [
  { id: "1", caller: "คุณสมชาย", phone: "081-xxx-xxx", time: "14:20", duration: "3:45", status: "completed", aiAction: "สอบถามข้อมูล + จอง trial", result: "จอง trial วันเสาร์ 10:00", sentiment: "positive" },
  { id: "2", caller: "คุณนภา", phone: "092-xxx-xxx", time: "13:50", duration: "2:10", status: "completed", aiAction: "ตอบคำถามราคา + ส่ง LINE", result: "ส่งข้อมูลคอร์สทาง LINE", sentiment: "neutral" },
  { id: "3", caller: "Unknown", phone: "085-xxx-xxx", time: "12:30", duration: "0:00", status: "missed", aiAction: "ไม่ได้รับสาย", result: "ส่ง SMS: 'ขออภัยที่ไม่ได้รับสาย'", sentiment: "neutral" },
  { id: "4", caller: "คุณพงศ์", phone: "089-xxx-xxx", time: "11:15", duration: "5:20", status: "transferred", aiAction: "สอบถาม + ต่อสายเจ้าของ", result: "โอนให้เจ้าของ (ต่อรองราคา)", sentiment: "negative" },
];

const STATS = {
  totalCalls: 45,
  answered: 38,
  avgDuration: "2:30",
  bookingsCreated: 12,
  leadsCaptured: 18,
  transferRate: "15%",
};

const SENTIMENT_MAP: Record<string, { label: string; color: string }> = {
  positive: { label: "😊", color: "text-emerald-500" },
  neutral: { label: "😐", color: "text-gray-500" },
  negative: { label: "😟", color: "text-red-500" },
};

export default function AIPhoneCallPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-secondary">📞 AI Phone Call</h1>
        <p className="text-sm text-secondary/50">AI รับสายโทรศัพท์ — สอบถาม, จอง trial, ส่งข้อมูลอัตโนมัติ</p></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">สายทั้งหมด</p><p className="text-2xl font-bold text-secondary">{STATS.totalCalls}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">รับสาย</p><p className="text-2xl font-bold text-emerald-600">{STATS.answered}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">เฉลี่ย</p><p className="text-2xl font-bold text-secondary">{STATS.avgDuration}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">จอง Trial</p><p className="text-2xl font-bold text-primary">{STATS.bookingsCreated}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Lead จับได้</p><p className="text-2xl font-bold text-amber-600">{STATS.leadsCaptured}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">โอนเจ้าของ</p><p className="text-2xl font-bold text-secondary">{STATS.transferRate}</p></CardContent></Card>
      </div>

      {/* How it works */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary-accent" />AI Phone Call Flow</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-3 overflow-x-auto py-4">
            {["📞 สายเข้า", "🤖 AI รับ", "💬 สอบถาม", "📋 บันทึก", "📅 จอง/Send", "👤 โอน (ถ้าจำเป็น)"].map((step, i) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <div className="rounded-xl border border-line/10 bg-line/5 px-3 py-2 text-xs font-medium text-secondary">{step}</div>
                {i < 5 && <span className="text-secondary/20">→</span>}
              </div>
            ))}
          </div>
        </CardContent></Card>

      {/* Call Log */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-primary-accent" />Call Log — ล่าสุด</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {CALL_LOGS.map((call) => (
            <div key={call.id} className="flex items-center gap-3 rounded-xl border border-line/10 p-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", call.status === "completed" ? "bg-emerald-500/10" : call.status === "transferred" ? "bg-amber-500/10" : "bg-red-500/10")}>
                {call.status === "completed" ? <Phone className="h-5 w-5 text-emerald-500" /> : call.status === "transferred" ? <PhoneForwarded className="h-5 w-5 text-amber-500" /> : <PhoneIncoming className="h-5 w-5 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-secondary">{call.caller}</p>
                  <Badge variant={call.status === "completed" ? "success" : call.status === "transferred" ? "warning" : "danger"} className="text-[9px]">
                    {call.status === "completed" ? "AI จัดการ" : call.status === "transferred" ? "โอนเจ้าของ" : "พลาด"}
                  </Badge>
                </div>
                <p className="text-[10px] text-secondary/40">{call.phone} · {call.time} · {call.duration}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-secondary">{call.result}</p>
                <p className={cn("text-lg", SENTIMENT_MAP[call.sentiment]?.color ?? "text-gray-500")}>{SENTIMENT_MAP[call.sentiment]?.label ?? "😐"}</p>
              </div>
            </div>
          ))}
        </CardContent></Card>

      {/* Transfer Rules */}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><PhoneForwarded className="h-5 w-5 text-amber-500" />Transfer Rules</CardTitle><CardDescription>AI จะโอนสายให้เจ้าของเมื่อไร</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {[
            { rule: "ลูกค้าขอส่วนลดมากกว่า 10%", action: "โอนเจ้าของ", reason: "超出 policy" },
            { rule: "ลูกค้าโกรธ/ขู่", action: "โอนเจ้าของ", reason: "complaint handling" },
            { rule: "ลูกค้าถามเรื่อง partnership/collab", action: "โอนเจ้าของ", reason: "business decision" },
            { rule: "ลูกค้าขอคุยกับคนจริง", action: "โอนเจ้าของ", reason: "personal request" },
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-line/5 px-3 py-2">
              <div><p className="text-xs text-secondary">{r.rule}</p><p className="text-[10px] text-secondary/30">{r.reason}</p></div>
              <Badge variant="warning" className="text-[9px]">{r.action}</Badge>
            </div>
          ))}
        </CardContent></Card>
    </div>
  );
}
