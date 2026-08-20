"use client";

import { useState } from "react";
import {
  Globe,
  Eye,
  Users,
  Target,
  TrendingUp,
  ExternalLink,
  Plus,
  Copy,
  Check,
  BarChart3,
  Sparkles,
  Layout,
  FileText,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  status: "live" | "draft" | "archived";
  type: "trial" | "course" | "quiz" | "referral";
  traffic: number;
  leads: number;
  conversions: number;
  ctr: number;
  bestCta: string;
  variants?: { name: string; traffic: number; convRate: number }[];
}

const PAGES: LandingPage[] = [
  {
    id: "1",
    title: "จองเรียนทดลองเปียโนฟรี — TIGA Studio",
    slug: "/trial",
    status: "live",
    type: "trial",
    traffic: 2340,
    leads: 189,
    conversions: 42,
    ctr: 8.1,
    bestCta: "จองเลย — เลือกเวลาที่สะดวก",
    variants: [
      { name: "A: สีม่วง", traffic: 1170, convRate: 7.8 },
      { name: "B: สีเขียว", traffic: 1170, convRate: 8.4 },
    ],
  },
  {
    id: "2",
    title: "เรียนเปียโนกรุงเทพ — ที่ไหนดี 2025",
    slug: "/piano-bangkok",
    status: "live",
    type: "course",
    traffic: 1560,
    leads: 98,
    conversions: 18,
    ctr: 6.3,
    bestCta: "ดูรายละเอียดคอร์ส",
  },
  {
    id: "3",
    title: "ทดสอบระดับเปียโนของคุณ — ฟรี!",
    slug: "/quiz",
    status: "live",
    type: "quiz",
    traffic: 890,
    leads: 267,
    conversions: 35,
    ctr: 30.0,
    bestCta: "ทำ Quiz เลย",
    variants: [
      { name: "A: 'ทดสอบเลย'", traffic: 445, convRate: 28.5 },
      { name: "B: 'รู้ระดับของคุณ'", traffic: 445, convRate: 31.5 },
    ],
  },
  {
    id: "4",
    title: "แนะนำเพื่อนเรียนเปียโน — ได้ส่วนลด ฿500",
    slug: "/refer",
    status: "live",
    type: "referral",
    traffic: 420,
    leads: 85,
    conversions: 12,
    ctr: 20.2,
    bestCta: "แชร์ลิงก์ให้เพื่อน",
  },
  {
    id: "5",
    title: "Online Course: Piano Mindset",
    slug: "/course/piano-mindset",
    status: "draft",
    type: "course",
    traffic: 0,
    leads: 0,
    conversions: 0,
    ctr: 0,
    bestCta: "สั่งซื้อ ฿990",
  },
];

const TYPE_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  trial: { label: "Trial", icon: Zap, color: "text-emerald-500" },
  course: { label: "Course", icon: FileText, color: "text-blue-500" },
  quiz: { label: "Quiz", icon: Target, color: "text-purple-500" },
  referral: { label: "Referral", icon: Users, color: "text-amber-500" },
};

const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  live: { label: "Live", variant: "success" },
  draft: { label: "Draft", variant: "warning" },
  archived: { label: "Archived", variant: "outline" },
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export default function LandingPagesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const activePage = PAGES.find((p) => p.id === selected);
  const totalTraffic = PAGES.reduce((s, p) => s + p.traffic, 0);
  const totalLeads = PAGES.reduce((s, p) => s + p.leads, 0);
  const totalConversions = PAGES.reduce((s, p) => s + p.conversions, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🌐 Landing Pages</h1>
          <p className="text-sm text-secondary/50">จัดการหน้า Landing Page สาธารณะ — SEO, CTA, Conversion Tracking</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-1" />สร้างใหม่</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Landing Pages</p>
            <p className="text-2xl font-bold text-secondary">{PAGES.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Traffic รวม</p>
            <p className="text-2xl font-bold text-secondary">{totalTraffic.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Lead รวม</p>
            <p className="text-2xl font-bold text-primary">{totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-secondary/50">Conversion Rate เฉลี่ย</p>
            <p className="text-2xl font-bold text-emerald-600">{totalTraffic > 0 ? ((totalConversions / totalTraffic) * 100).toFixed(1) : 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Landing Page Cards */}
      <div className="space-y-3">
        {PAGES.map((page) => {
          const type = TYPE_MAP[page.type] ?? TYPE_MAP.trial;
          const st = STATUS_MAP[page.status] ?? STATUS_MAP.draft;
          const isSelected = selected === page.id;
          const url = `https://tigaalpha.github.io/studio${page.slug}`;
          return (
            <Card key={page.id} className={cn(isSelected && "ring-2 ring-primary/30")}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10", type.color)}>
                      <type.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-secondary line-clamp-1">{page.title}</h3>
                      <p className="text-xs text-secondary/40">{page.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <Badge variant="outline">{type.label}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-secondary">{page.traffic.toLocaleString()}</p>
                    <p className="text-[10px] text-secondary/40">Traffic</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-primary">{page.leads}</p>
                    <p className="text-[10px] text-secondary/40">Leads</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-emerald-600">{page.conversions}</p>
                    <p className="text-[10px] text-secondary/40">Conversions</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-amber-600">{page.ctr}%</p>
                    <p className="text-[10px] text-secondary/40">CTR</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-secondary/40">Best CTA:</span>
                  <Badge variant="outline" className="text-[10px]">{page.bestCta}</Badge>
                  <CopyButton value={url} />
                  <Button size="sm" variant="ghost" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(isSelected ? null : page.id)}>
                    {isSelected ? "ปิด" : "ดูเพิ่มเติม"}
                  </Button>
                </div>

                {/* A/B Test Variants */}
                {isSelected && page.variants && (
                  <div className="space-y-2 border-t border-line/10 pt-3">
                    <h4 className="text-xs font-medium text-secondary/60">A/B Test Results:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {page.variants.map((v, i) => (
                        <div key={i} className="rounded-lg bg-line/5 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-secondary">{v.name}</span>
                            <Badge variant={v.convRate === Math.max(...page.variants!.map((x) => x.convRate)) ? "success" : "outline"} className="text-[9px]">
                              {v.convRate === Math.max(...page.variants!.map((x) => x.convRate)) ? "🏆 Winner" : ""}
                            </Badge>
                          </div>
                          <p className="text-lg font-bold text-secondary">{v.convRate}%</p>
                          <p className="text-[10px] text-secondary/40">{v.traffic} visitors</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* SEO Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-accent" />
            Landing Page SEO Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {[
              "✅ Title tag มี target keyword + ชื่อธุรกิจ",
              "✅ Meta description 120-160 chars, มี CTA",
              "✅ H1 มี keyword หลัก",
              "✅ CTA ชัดเจน above-the-fold",
              "✅ Social proof (รีวิว/สถิติ) visible",
              "✅ Form fields น้อยที่สุด (name + phone)",
              "✅ Mobile responsive",
              "✅ Page load < 3 วินาที",
              "✅ Internal link ไปหน้า Booking",
              "✅ Schema markup (LocalBusiness)",
            ].map((item, i) => (
              <div key={i} className="rounded-lg bg-emerald-50/5 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/5 dark:text-emerald-400">
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
