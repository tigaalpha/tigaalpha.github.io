"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Users, Eye, MousePointerClick, Calendar, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface ContentPerformance {
  id: string;
  title: string;
  type: string;
  views: number;
  clicks: number;
  impressions: number;
  ctr: number;
  conversions: number;
  trend: "up" | "down" | "stable";
}

interface ChannelPerformance {
  channel: string;
  followers: number;
  engagement: number;
  reach: number;
  posts: number;
  trend: "up" | "down" | "stable";
}

export default function PerformanceDashboardPage() {
  const [content, setContent] = useState<ContentPerformance[]>([]);
  const [channels, setChannels] = useState<ChannelPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      
      // Load articles performance
      const articles = await repos.articles.list();
      const contentData: ContentPerformance[] = articles.map(article => ({
        id: article.id,
        title: article.title || "ไม่มีชื่อ",
        type: article.type || "article",
        views: article.views || 0,
        clicks: article.clicks || 0,
        impressions: article.impressions || 0,
        ctr: article.impressions > 0 ? ((article.clicks || 0) / article.impressions) * 100 : 0,
        conversions: article.conversions || 0,
        trend: (article.views || 0) > 100 ? "up" : "stable",
      })).sort((a, b) => b.views - a.views);
      
      setContent(contentData);
      
      // Load marketing channels
      const marketingChannels = await repos.marketingChannels.list();
      const channelsData: ChannelPerformance[] = marketingChannels.map(ch => ({
        channel: ch.platform || "unknown",
        followers: ch.followers_count || 0,
        engagement: ch.engagement_rate || 0,
        reach: ch.reach || 0,
        posts: ch.posts_count || 0,
        trend: (ch.followers_count || 0) > 100 ? "up" : "stable",
      }));
      
      setChannels(channelsData);
    } catch (err) {
      console.error("Failed to load performance data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const totalViews = content.reduce((s, c) => s + c.views, 0);
  const totalClicks = content.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = content.reduce((s, c) => s + c.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const totalFollowers = channels.reduce((s, c) => s + c.followers, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">📈 Performance Dashboard</h1>
          <p className="text-sm text-secondary/50">ติดตาม Performance ของ Content และ Marketing ทุกช่องทาง</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Total Views</p><p className="text-2xl font-bold text-secondary">{totalViews.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Total Clicks</p><p className="text-2xl font-bold text-primary">{totalClicks.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Impressions</p><p className="text-2xl font-bold text-amber-600">{totalImpressions.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Avg CTR</p><p className="text-2xl font-bold text-emerald-600">{avgCtr.toFixed(1)}%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-secondary/50">Total Followers</p><p className="text-2xl font-bold text-primary">{totalFollowers.toLocaleString()}</p></CardContent></Card>
      </div>

      {/* Channel Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary-accent" />Channel Performance</CardTitle>
          <CardDescription>Performance ของแต่ละ Platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-secondary/50">กำลังโหลด...</div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 text-secondary/50">ยังไม่มีข้อมูล</div>
          ) : (
            channels.map(ch => (
              <div key={ch.channel} className="rounded-xl border border-line/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{ch.channel === "facebook" ? "📘" : ch.channel === "instagram" ? "📸" : ch.channel === "tiktok" ? "🎵" : "📊"}</span>
                    <div>
                      <p className="text-sm font-medium text-secondary capitalize">{ch.channel}</p>
                      <p className="text-[10px] text-secondary/40">{ch.followers.toLocaleString()} followers</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {ch.trend === "up" ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : ch.trend === "down" ? <TrendingDown className="h-4 w-4 text-red-500" /> : null}
                    <Badge variant={ch.trend === "up" ? "success" : "outline"} className="text-[9px]">{ch.engagement.toFixed(1)}% engagement</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-secondary">{ch.followers.toLocaleString()}</p>
                    <p className="text-[10px] text-secondary/40">Followers</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-primary">{ch.reach.toLocaleString()}</p>
                    <p className="text-[10px] text-secondary/40">Reach</p>
                  </div>
                  <div className="rounded-lg bg-line/5 p-2">
                    <p className="text-lg font-bold text-amber-600">{ch.posts}</p>
                    <p className="text-[10px] text-secondary/40">Posts</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Content Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary-accent" />Content Performance</CardTitle>
          <CardDescription>Performance ของ Content แต่ละชิ้น</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {content.length === 0 ? (
            <div className="text-center py-4 text-secondary/50">ยังไม่มี content</div>
          ) : (
            content.slice(0, 10).map(item => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-line/10 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-secondary line-clamp-1">{item.title}</p>
                  <p className="text-[10px] text-secondary/40">{item.type}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-secondary/60">
                  <span>👁 {item.views.toLocaleString()}</span>
                  <span>🖱 {item.clicks}</span>
                  <span>📊 {item.ctr.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  {item.trend === "up" ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : item.trend === "down" ? <TrendingDown className="h-3 w-3 text-red-500" /> : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
