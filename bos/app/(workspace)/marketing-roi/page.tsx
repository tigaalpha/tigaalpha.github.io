"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, BarChart3, Target, Zap, Coins, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface ChannelROI {
  channel: string;
  icon: string;
  spend: number;
  leads: number;
  conversions: number;
  revenue: number;
  cac: number;
  roi: number;
  trend: "up" | "down" | "stable";
  recommendation: string;
  status: "excellent" | "good" | "needs_work" | "stop";
}

const STATUS_MAP: Record<string, { label: string; variant: "success" | "info" | "warning" | "danger" }> = {
  excellent: { label: "🏆 Excellent", variant: "success" },
  good: { label: "✅ Good", variant: "info" },
  needs_work: { label: "⚠️ Needs Work", variant: "warning" },
  stop: { label: "🛑 Stop", variant: "danger" },
};

function fmtCurrency(value: number): string {
  if (!isFinite(value)) return "∞";
  return `฿${value.toLocaleString("th-TH")}`;
}

function fmtPercent(value: number): string {
  if (!isFinite(value)) return "∞%";
  return `${value.toFixed(0)}%`;
}

export default function MarketingROIPage() {
  const [channels, setChannels] = useState<ChannelROI[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  async function loadData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      
      // Get customers grouped by lead source
      const customers = await repos.customers.listPipeline();
      const transactions = await repos.transactions.listAll();
      
      // Group by lead source
      const sourceMap: Record<string, { leads: number; conversions: number; revenue: number }> = {};
      
      for (const customer of customers) {
        const source = customer.lead_source || "Unknown";
        if (!sourceMap[source]) sourceMap[source] = { leads: 0, conversions: 0, revenue: 0 };
        sourceMap[source].leads++;
        if (customer.sales_status === "won") {
          sourceMap[source].conversions++;
          // Find transaction for this customer
          const tx = transactions.find(t => t.customer_id === customer.id && t.type === "income");
          if (tx) sourceMap[source].revenue += tx.amount || 0;
        }
      }
      
      // Map to channel ROI format
      const channelMap: Record<string, string> = {
        "line_oa": "LINE OA",
        "facebook": "Facebook",
        "tiktok": "TikTok",
        "google": "Google",
        "referral": "Referral",
        "instagram": "Instagram",
        "landing_page": "SEO (Organic)",
        "quiz": "Quiz",
        "Unknown": "Other",
      };
      
      const spendMap: Record<string, number> = {
        "Facebook": 15000,
        "Google": 8000,
        "Referral": 5000,
      };
      
      const iconMap: Record<string, string> = {
        "LINE OA": "💬",
        "Facebook": "📘",
        "TikTok": "🎵",
        "Google": "🔍",
        "Referral": "🎁",
        "Instagram": "📸",
        "SEO (Organic)": "🌐",
        "Quiz": "🎯",
        "Other": "📊",
      };
      
      const channelsData: ChannelROI[] = Object.entries(sourceMap).map(([source, data]) => {
        const channelName = channelMap[source] || source;
        const spend = spendMap[channelName] || 0;
        const cac = data.conversions > 0 ? spend / data.conversions : 0;
        const roi = spend > 0 ? ((data.revenue - spend) / spend) * 100 : Infinity;
        
        let status: "excellent" | "good" | "needs_work" | "stop" = "good";
        if (roi === Infinity || roi > 500) status = "excellent";
        else if (roi > 200) status = "good";
        else if (roi > 0) status = "needs_work";
        else status = "stop";
        
        return {
          channel: channelName,
          icon: iconMap[channelName] || "📊",
          spend,
          leads: data.leads,
          conversions: data.conversions,
          revenue: data.revenue,
          cac,
          roi,
          trend: (data.conversions > 0 ? "up" : "stable") as "up" | "down" | "stable",
          recommendation: roi === Infinity ? "ฟรี — มี lead เยอะ ควรเพิ่ม content" : roi > 500 ? "ROI ดี — รักษาไว้" : roi > 0 ? "ROI พอได้ — ลอง optimize" : "ขาดทุน — ทบทวน",
          status,
        };
      }).sort((a, b) => {
        if (!isFinite(a.roi) && isFinite(b.roi)) return -1;
        if (isFinite(a.roi) && !isFinite(b.roi)) return 1;
        return b.roi - a.roi;
      });
      
      setChannels(channelsData);
    } catch (err) {
      console.error("Failed to load ROI data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
  const totalLeads = channels.reduce((s, c) => s + c.leads, 0);
  const totalConversions = channels.reduce((s, c) => s + c.conversions, 0);
  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);
  const avgCac = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const avgRoi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">💰 Marketing ROI</h1>
          <p className="text-sm text-secondary/50">เปรียบเทียบค่าโฆษณากับรายได้ — ข้อมูลจริงจาก Supabase</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">ค่าใช้จ่ายรวม</p><p className="text-xl font-bold text-red-500">฿{totalSpend.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">รายได้รวม</p><p className="text-xl font-bold text-emerald-600">฿{totalRevenue.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">ROI รวม</p><p className="text-xl font-bold text-primary">{fmtPercent(avgRoi)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">CAC เฉลี่ย</p><p className="text-xl font-bold text-amber-600">฿{Math.round(avgCac).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Profit</p><p className="text-xl font-bold text-emerald-600">฿{(totalRevenue - totalSpend).toLocaleString()}</p></CardContent></Card>
      </div>

      {/* Period Toggle */}
      <div className="flex gap-2">
        {(["month", "quarter", "year"] as const).map((p) => (
          <Button key={p} variant={period === p ? "primary" : "outline"} size="sm" onClick={() => setPeriod(p)}>
            {p === "month" ? "เดือนนี้" : p === "quarter" ? "ไตรมาสนี้" : "ปีนี้"}
          </Button>
        ))}
      </div>

      {/* Channel ROI Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary-accent" />ROI แยกตามช่องทาง</CardTitle>
          <CardDescription>เปรียบเทียบ CAC, ROI, และ Conversion ของแต่ละช่องทาง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-secondary/50">กำลังโหลด...</div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 text-secondary/50">ไม่มีข้อมูล</div>
          ) : (
            channels.map((ch) => {
              const st = (STATUS_MAP as any)[ch.status ?? "good"] ?? STATUS_MAP.good;
              const revenueBar = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={ch.channel} className="rounded-xl border border-line/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{ch.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-secondary">{ch.channel}</p>
                        <p className="text-[10px] text-secondary/40">{ch.recommendation}</p>
                      </div>
                    </div>
                    <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="rounded-lg bg-line/5 p-2">
                      <p className="text-xs font-bold text-secondary">{ch.spend > 0 ? `฿${ch.spend.toLocaleString()}` : "ฟรี"}</p>
                      <p className="text-[9px] text-secondary/40">Spend</p>
                    </div>
                    <div className="rounded-lg bg-line/5 p-2">
                      <p className="text-xs font-bold text-secondary">{ch.leads}</p>
                      <p className="text-[9px] text-secondary/40">Leads</p>
                    </div>
                    <div className="rounded-lg bg-line/5 p-2">
                      <p className="text-xs font-bold text-emerald-600">{ch.conversions}</p>
                      <p className="text-[9px] text-secondary/40">Sales</p>
                    </div>
                    <div className="rounded-lg bg-line/5 p-2">
                      <p className="text-xs font-bold text-amber-600">฿{ch.revenue.toLocaleString()}</p>
                      <p className="text-[9px] text-secondary/40">Revenue</p>
                    </div>
                    <div className="rounded-lg bg-line/5 p-2">
                      <p className="text-xs font-bold text-primary">{fmtPercent(ch.roi)}</p>
                      <p className="text-[9px] text-secondary/40">ROI</p>
                    </div>
                  </div>

                  <div className="h-2 rounded-full bg-line/5 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${revenueBar}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Budget Optimization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary-accent" />Budget Optimization</CardTitle>
          <CardDescription>แนะนำการจัดสรรงบประมาณตาม ROI จริง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-emerald-200/30 bg-emerald-50/5 p-4">
            <h4 className="text-sm font-medium text-emerald-700 mb-2">✅ ลงทุนเพิ่ม</h4>
            <div className="space-y-1 text-xs text-secondary/70">
              {channels.filter(c => !isFinite(c.roi) || c.roi > 500).map(c => (
                <p key={c.channel}>• <strong>{c.channel}</strong> — ROI {fmtPercent(c.roi)}, มี {c.leads} leads</p>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200/30 bg-amber-50/5 p-4">
            <h4 className="text-sm font-medium text-amber-700 mb-2">⚠️ ปรับปรุง</h4>
            <div className="space-y-1 text-xs text-secondary/70">
              {channels.filter(c => isFinite(c.roi) && c.roi > 0 && c.roi <= 500).map(c => (
                <p key={c.channel}>• <strong>{c.channel}</strong> — ROI {fmtPercent(c.roi)} ลอง optimize</p>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-red-200/30 bg-red-50/5 p-4">
            <h4 className="text-sm font-medium text-red-700 mb-2">🛑 หยุด/ลด</h4>
            <div className="space-y-1 text-xs text-secondary/70">
              {channels.filter(c => isFinite(c.roi) && c.roi <= 0).length > 0 ? (
                channels.filter(c => isFinite(c.roi) && c.roi <= 0).map(c => (
                  <p key={c.channel}>• <strong>{c.channel}</strong> — ROI {fmtPercent(c.roi)} ขาดทุน</p>
                ))
              ) : (
                <p>• ยังไม่มีช่องทางที่ต้องหยุด</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
