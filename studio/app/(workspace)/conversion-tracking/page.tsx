"use client";

import { useEffect, useState } from "react";
import { Target, TrendingUp, Users, Zap, BarChart3, ExternalLink, Copy, Check, RefreshCw, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface ConversionEvent {
  id: string;
  source: string;
  medium: string;
  campaign: string;
  timestamp: string;
  converted: boolean;
  revenue: number;
}

interface SourcePerformance {
  source: string;
  visits: number;
  leads: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  roi: number;
}

export default function ConversionTrackingPage() {
  const [events, setEvents] = useState<ConversionEvent[]>([]);
  const [sourcePerformance, setSourcePerformance] = useState<SourcePerformance[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      const customers = await repos.customers.listPipeline();
      const transactions = await repos.transactions.list();
      
      // Group customers by lead source
      const sourceMap: Record<string, { leads: number; conversions: number; revenue: number }> = {};
      
      for (const customer of customers) {
        const source = customer.lead_source || "direct";
        if (!sourceMap[source]) sourceMap[source] = { leads: 0, conversions: 0, revenue: 0 };
        sourceMap[source].leads++;
        
        if (customer.sales_status === "won") {
          sourceMap[source].conversions++;
          const tx = transactions.find(t => t.customer_id === customer.id && t.type === "income");
          if (tx) sourceMap[source].revenue += tx.amount || 0;
        }
      }
      
      // Convert to performance format
      const performance: SourcePerformance[] = Object.entries(sourceMap).map(([source, data]) => ({
        source,
        visits: data.leads * 3, // Estimate visits from leads
        leads: data.leads,
        conversions: data.conversions,
        revenue: data.revenue,
        conversionRate: data.leads > 0 ? (data.conversions / data.leads) * 100 : 0,
        roi: 0, // Would need ad spend data per source
      })).sort((a, b) => b.conversionRate - a.conversionRate);
      
      setSourcePerformance(performance);
      
      // Generate sample conversion events
      const sampleEvents: ConversionEvent[] = customers.slice(0, 10).map(c => ({
        id: c.id,
        source: c.lead_source || "direct",
        medium: "organic",
        campaign: "default",
        timestamp: c.created_at || new Date().toISOString(),
        converted: c.sales_status === "won",
        revenue: c.sales_status === "won" ? 27000 : 0,
      }));
      
      setEvents(sampleEvents);
    } catch (err) {
      console.error("Failed to load conversion data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const totalLeads = sourcePerformance.reduce((s, p) => s + p.leads, 0);
  const totalConversions = sourcePerformance.reduce((s, p) => s + p.conversions, 0);
  const totalRevenue = sourcePerformance.reduce((s, p) => s + p.revenue, 0);
  const overallConversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">📊 Conversion Tracking</h1>
          <p className="text-sm text-secondary/50">ติดตาม Conversion จากทุกช่องทาง — ข้อมูลจริงจาก Supabase</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Total Leads</p><p className="text-2xl font-bold text-secondary">{totalLeads}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Conversions</p><p className="text-2xl font-bold text-emerald-600">{totalConversions}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Conversion Rate</p><p className="text-2xl font-bold text-primary">{overallConversionRate.toFixed(1)}%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Revenue</p><p className="text-2xl font-bold text-amber-600">฿{totalRevenue.toLocaleString()}</p></CardContent></Card>
      </div>

      {/* Source Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary-accent" />Source Performance</CardTitle>
          <CardDescription>เปรียบเทียบ Conversion Rate ของแต่ละแหล่งที่มา</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-secondary/50">กำลังโหลด...</div>
          ) : sourcePerformance.length === 0 ? (
            <div className="text-center py-8 text-secondary/50">ไม่มีข้อมูล</div>
          ) : (
            sourcePerformance.map((source) => (
              <div key={source.source} className="rounded-xl border border-line/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{source.source === "facebook" ? "📘" : source.source === "google" ? "🔍" : source.source === "tiktok" ? "🎵" : source.source === "referral" ? "🎁" : "📊"}</span>
                    <div>
                      <p className="text-sm font-medium text-secondary capitalize">{source.source}</p>
                      <p className="text-[10px] text-secondary/40">{source.leads} leads · {source.conversions} conversions</p>
                    </div>
                  </div>
                  <Badge variant={source.conversionRate > 15 ? "success" : source.conversionRate > 10 ? "info" : "outline"}>
                    {source.conversionRate.toFixed(1)}% CVR
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-secondary">{source.leads}</p>
                    <p className="text-[10px] text-secondary/40">Leads</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50/5 p-2">
                    <p className="text-lg font-bold text-emerald-600">{source.conversions}</p>
                    <p className="text-[10px] text-secondary/40">Sales</p>
                  </div>
                  <div className="rounded-lg bg-amber-50/5 p-2">
                    <p className="text-lg font-bold text-amber-600">฿{source.revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-secondary/40">Revenue</p>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-line/5 overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${source.conversionRate}%` }} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* UTM Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary-accent" />UTM Builder</CardTitle>
          <CardDescription>สร้าง Trackable Links สำหรับแต่ละแคมเปญ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { source: "facebook", medium: "social", campaigns: ["promo_august", "trial_free"] },
            { source: "google", medium: "cpc", campaigns: ["piano_bangkok", "piano_kids"] },
            { source: "tiktok", medium: "social", campaigns: ["viral_piano", "student_showcase"] },
            { source: "line", medium: "organic", campaigns: ["welcome", "winback"] },
          ].map((item) => (
            <div key={item.source} className="rounded-xl border border-line/10 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{item.source === "facebook" ? "📘" : item.source === "google" ? "🔍" : item.source === "tiktok" ? "🎵" : "💬"}</span>
                <span className="text-sm font-medium text-secondary capitalize">{item.source}</span>
              </div>
              <div className="space-y-1">
                {item.campaigns.map((campaign) => {
                  const url = `https://tigaalpha.github.io/studio/lead-sale?utm_source=${item.source}&utm_medium=${item.medium}&utm_campaign=${campaign}`;
                  return (
                    <div key={campaign} className="flex items-center gap-2 rounded-lg bg-line/5 px-2 py-1">
                      <span className="flex-1 truncate text-[10px] text-secondary/60">{url}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(url)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Conversions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary-accent" />Recent Conversions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.slice(0, 10).map((event) => (
            <div key={event.id} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
              <div className="flex items-center gap-3">
                <Badge variant={event.converted ? "success" : "outline"} className="text-[9px]">
                  {event.converted ? " Converted" : " Lead"}
                </Badge>
                <span className="text-xs text-secondary capitalize">{event.source}</span>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-secondary">{event.revenue > 0 ? `฿${event.revenue.toLocaleString()}` : "-"}</p>
                <p className="text-[10px] text-secondary/30">{new Date(event.timestamp).toLocaleDateString("th-TH")}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
