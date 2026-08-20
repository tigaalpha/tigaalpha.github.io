"use client";

import { useState } from "react";
import {
  Zap,
  MessageSquare,
  Mail,
  Clock,
  Users,
  Play,
  Pause,
  Settings,
  BarChart3,
  Send,
  Target,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DripCampaign {
  id: string;
  name: string;
  nameEn: string;
  trigger: string;
  channel: "line" | "email" | "both";
  status: "active" | "paused" | "draft";
  totalLeads: number;
  completedLeads: number;
  conversionRate: number;
  steps: DripStep[];
}

interface DripStep {
  day: number;
  message: string;
  channel: "line" | "email";
  sent: number;
  opened: number;
  clicked: number;
}

const CAMPAIGNS: DripCampaign[] = [
  {
    id: "welcome",
    name: "Welcome Sequence",
    nameEn: "Welcome Sequence",
    trigger: "Lead ใหม่ทุกคน",
    channel: "line",
    status: "active",
    totalLeads: 127,
    completedLeads: 89,
    conversionRate: 12.5,
    steps: [
      { day: 0, message: "🎉 ยินดีต้อนรับ! สิทธิ์ทดลองเรียนฟรี 30 นาที", channel: "line", sent: 127, opened: 120, clicked: 45 },
      { day: 1, message: "📚 ทำไม TIGA ถึงต่างจากที่อื่น? (3 เหตุผล)", channel: "line", sent: 120, opened: 95, clicked: 32 },
      { day: 3, message: "🎵 ฟังตัวอย่างนักเรียนของเราเล่นเปียโน", channel: "line", sent: 115, opened: 82, clicked: 28 },
      { day: 7, message: "⏰ จองทดลองเลย — เหลือแค่ 3 ที่สัปดาห์นี้!", channel: "line", sent: 110, opened: 78, clicked: 22 },
      { day: 14, message: "🎁 ส่วนลดพิเศษ 10% สำหรับคุณ (หมดอายุ 3 วัน)", channel: "line", sent: 105, opened: 70, clicked: 18 },
    ],
  },
  {
    id: "nurture",
    name: "Nurture Sequence",
    nameEn: "Nurture Sequence",
    trigger: "Lead ที่ยังไม่ตัดสินใจหลัง 7 วัน",
    channel: "both",
    status: "active",
    totalLeads: 64,
    completedLeads: 42,
    conversionRate: 8.3,
    steps: [
      { day: 0, message: "🎹 5 เหตุผลที่ควรเริ่มเรียนเปียโนตอนนี้", channel: "email", sent: 64, opened: 45, clicked: 12 },
      { day: 3, message: "📖 เรื่องจริงจากนักเรียน: จากศูนย์สู่เปียโนใน 3 เดือน", channel: "line", sent: 60, opened: 48, clicked: 15 },
      { day: 7, message: "💰 ลงทุนครั้งเดียว ได้ทักษะตลอดชีวิต — เปรียบเทียบ", channel: "email", sent: 55, opened: 38, clicked: 10 },
      { day: 14, message: "🎁 Offer พิเศษ: เรียนทดลองฟรี + แผนการเรียนส่วนตัว", channel: "line", sent: 50, opened: 40, clicked: 14 },
    ],
  },
  {
    id: "post-trial",
    name: "Post-Trial Follow-up",
    nameEn: "Post-Trial Follow-up",
    trigger: "ลูกค้าทดลองแล้ว แต่ยังไม่สมัคร",
    channel: "both",
    status: "active",
    totalLeads: 35,
    completedLeads: 28,
    conversionRate: 34.3,
    steps: [
      { day: 0, message: "😊 ขอบคุณที่มาทดลอง! รู้สึกยังไงบ้าง?", channel: "line", sent: 35, opened: 33, clicked: 20 },
      { day: 1, message: "📊 ผลการทดลองของคุณ + แผนแนะนำ", channel: "email", sent: 33, opened: 28, clicked: 15 },
      { day: 3, message: "🎬 วิดีโอจากนักเรียนที่เริ่มจาก trial เหมือนคุณ", channel: "line", sent: 30, opened: 25, clicked: 12 },
      { day: 7, message: "⏰ โปรโมชันพิเศษสำหรับผู้ทดลอง — หมดวันศุกร์!", channel: "both", sent: 28, opened: 22, clicked: 10 },
    ],
  },
  {
    id: "re-engage",
    name: "Re-engagement",
    nameEn: "Re-engagement",
    trigger: "Lead เงียบไป 14 วัน",
    channel: "line",
    status: "active",
    totalLeads: 45,
    completedLeads: 38,
    conversionRate: 5.2,
    steps: [
      { day: 0, message: "👋 คุณเป็นยังไงบ้าง? เรายังรอคุณอยู่นะ", channel: "line", sent: 45, opened: 30, clicked: 8 },
      { day: 3, message: "🎵 เพลงใหม่ที่นักเรียนของเราเล่นได้แล้ว!", channel: "line", sent: 40, opened: 25, clicked: 6 },
      { day: 7, message: "🎁 กลับมาตอนนี้ รับส่วนลด 15%", channel: "line", sent: 38, opened: 22, clicked: 5 },
    ],
  },
  {
    id: "winback",
    name: "Win-back (Lapsed Student)",
    nameEn: "Win-back",
    trigger: "นักเรียนไม่ต่ออายุ / หยุดเรียน > 30 วัน",
    channel: "both",
    status: "active",
    totalLeads: 28,
    completedLeads: 20,
    conversionRate: 10.7,
    steps: [
      { day: 0, message: "🎵 เราคิดถึงคุณ! อยากให้กลับมาเล่นเปียโนอีกครั้ง", channel: "line", sent: 28, opened: 20, clicked: 7 },
      { day: 3, message: "📊 สถิติการเล่นของคุณ vs ตอนที่เรียนอยู่", channel: "email", sent: 25, opened: 15, clicked: 4 },
      { day: 7, message: "🎁 Returnee Package: เรียน 10 ชั่วโมง ลด 20%", channel: "both", sent: 22, opened: 14, clicked: 5 },
    ],
  },
  {
    id: "course-renew",
    name: "Course Renewal Reminder",
    nameEn: "Course Renewal",
    trigger: "นักเรียนเรียนเหลือ < 5 ชั่วโมงสุดท้าย",
    channel: "line",
    status: "paused",
    totalLeads: 15,
    completedLeads: 12,
    conversionRate: 40.0,
    steps: [
      { day: -14, message: "⏰ คุณเหลืออีก 5 ชั่วโมง! ต่ออายุเลยไหม?", channel: "line", sent: 15, opened: 14, clicked: 10 },
      { day: -7, message: "🎵 แพ็กเกจต่ออายุพิเศษ — ได้โบนัส 2 ชั่วโมง", channel: "line", sent: 14, opened: 12, clicked: 8 },
      { day: -3, message: "⚡ เหลือ 3 ชั่วโมงสุดท้าย — อย่ารอจนหมด!", channel: "line", sent: 13, opened: 11, clicked: 7 },
    ],
  },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
    active: { label: "Active", variant: "success" },
    paused: { label: "Paused", variant: "warning" },
    draft: { label: "Draft", variant: "outline" },
  };
  const cfg = map[status] ?? map.draft;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "line") return <span className="text-green-500">💬 LINE</span>;
  if (channel === "email") return <span className="text-blue-500">📧 Email</span>;
  return <span className="text-purple-500">🔀 Both</span>;
}

export default function DripCampaignPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const activeCampaign = CAMPAIGNS.find((c) => c.id === selected);

  const totalLeads = CAMPAIGNS.reduce((s, c) => s + c.totalLeads, 0);
  const totalCompleted = CAMPAIGNS.reduce((s, c) => s + c.completedLeads, 0);
  const avgConversion = CAMPAIGNS.reduce((s, c) => s + c.conversionRate, 0) / CAMPAIGNS.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">🤖 Drip Campaign Automation</h1>
        <p className="text-sm text-secondary/50">Sequence อัตโนมัติสำหรับ Lead Nurturing, Re-engagement, Win-back</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">แคมเปญทั้งหมด</p>
            <p className="text-2xl font-bold text-secondary">{CAMPAIGNS.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Active</p>
            <p className="text-2xl font-bold text-emerald-600">{CAMPAIGNS.filter((c) => c.status === "active").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Lead ในระบบ</p>
            <p className="text-2xl font-bold text-secondary">{totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Conversion เฉลี่ย</p>
            <p className="text-2xl font-bold text-primary">{avgConversion.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign List */}
      <div className="space-y-3">
        {CAMPAIGNS.map((campaign) => {
          const isSelected = selected === campaign.id;
          return (
            <Card key={campaign.id} className={cn(isSelected && "ring-2 ring-primary/30")}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-secondary">{campaign.name}</h3>
                      <p className="text-xs text-secondary/40">{campaign.trigger}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChannelIcon channel={campaign.channel} />
                    <StatusBadge status={campaign.status} />
                    <Button size="sm" variant="ghost" onClick={() => setSelected(isSelected ? null : campaign.id)}>
                      {isSelected ? "ปิด" : "ดูรายละเอียด"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-secondary">{campaign.totalLeads}</p>
                    <p className="text-[10px] text-secondary/40">Lead</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-secondary">{campaign.completedLeads}</p>
                    <p className="text-[10px] text-secondary/40">Complete</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50/5 p-2">
                    <p className="text-lg font-bold text-emerald-600">{campaign.conversionRate}%</p>
                    <p className="text-[10px] text-secondary/40">Conversion</p>
                  </div>
                </div>

                {/* Step Progress Bar */}
                <div className="flex gap-1">
                  {campaign.steps.map((step, i) => {
                    const openRate = step.sent > 0 ? (step.opened / step.sent) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 space-y-1">
                        <div className="h-2 rounded-full bg-line/5 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${openRate}%` }} />
                        </div>
                        <p className="text-center text-[8px] text-secondary/30">D{step.day}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Expanded Steps */}
                {isSelected && (
                  <div className="space-y-2 pt-2 border-t border-line/10">
                    <h4 className="text-xs font-medium text-secondary/60">Sequence Steps:</h4>
                    {campaign.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg bg-line/5 p-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[9px]">วันที่ {step.day >= 0 ? `+${step.day}` : step.day}</Badge>
                            <Badge variant="outline" className="text-[9px]">{step.channel}</Badge>
                          </div>
                          <p className="text-xs text-secondary">{step.message}</p>
                          <div className="mt-1 flex gap-3 text-[10px] text-secondary/40">
                            <span>ส่ง {step.sent}</span>
                            <span>เปิด {step.opened} ({step.sent > 0 ? ((step.opened / step.sent) * 100).toFixed(0) : 0}%)</span>
                            <span>คลิก {step.clicked} ({step.sent > 0 ? ((step.clicked / step.sent) * 100).toFixed(0) : 0}%)</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Automation Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-accent" />
            Automation Rules
          </CardTitle>
          <CardDescription>กฎที่ใช้ trigger แคมเปญอัตโนมัติ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { trigger: "Lead ใหม่ทุกคน → Welcome Sequence", status: "active" },
            { trigger: "Lead ไม่ตอบกลับ 7 วัน → Nurture Sequence", status: "active" },
            { trigger: "Trial เสร็จสิ้น → Post-Trial Follow-up", status: "active" },
            { trigger: "Lead เงียบไป 14 วัน → Re-engagement", status: "active" },
            { trigger: "นักเรียนหยุดเรียน > 30 วัน → Win-back", status: "active" },
            { trigger: "เหลือ < 5 ชั่วโมง → Course Renewal", status: "paused" },
          ].map((rule, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
              <span className="text-xs text-secondary">{rule.trigger}</span>
              <StatusBadge status={rule.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
