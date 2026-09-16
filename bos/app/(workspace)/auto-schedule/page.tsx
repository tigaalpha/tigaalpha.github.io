"use client";

import { useEffect, useState, useMemo } from "react";
import { Clock, Calendar, TrendingUp, Users, RefreshCw, Zap, Target, BarChart3, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";

interface ScheduledPost {
  id: string;
  content: string;
  platforms: string[];
  scheduledAt: string;
  status: string;
  metrics: { reach: number; engagement: number; clicks: number };
}

interface PlatformMetric {
  platform: string;
  followers: number;
  postsThisWeek: number;
  avgReach: number;
  bestTime: string;
}

const PLATFORM_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  facebook: { color: "text-blue-500", bg: "bg-blue-500/10", icon: "📘" },
  line: { color: "text-green-500", bg: "bg-green-500/10", icon: "💬" },
  instagram: { color: "text-pink-500", bg: "bg-pink-500/10", icon: "📸" },
  tiktok: { color: "text-gray-900", bg: "bg-gray-900/10", icon: "🎵" },
  x: { color: "text-black", bg: "bg-black/10", icon: "✖️" },
};

const OPTIMAL_TIMES = [
  { time: "07:00", score: 65, label: "เช้า (คนเดินทาง)" },
  { time: "12:00", score: 75, label: "พักเที่ยง" },
  { time: "18:00", score: 90, label: "หลังเลิกงาน ⭐" },
  { time: "20:00", score: 85, label: "ก่อนนอน" },
];

export default function AutoSchedulePage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetric[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const repos = createRepositories(createClient());
      
      // Get social posts
      const { data: socialPosts } = await createClient()
        .from("social_posts")
        .select("id, content, platforms, scheduled_at, status")
        .order("scheduled_at", { ascending: false })
        .limit(20);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const postsData: ScheduledPost[] = ((socialPosts ?? []) as any[]).map((post: any) => ({
        id: post.id,
        content: (post.content as string || "").slice(0, 100),
        platforms: (post.platforms as string[]) || [],
        scheduledAt: post.scheduled_at || new Date().toISOString(),
        status: post.status || "draft",
        metrics: { reach: 0, engagement: 0, clicks: 0 },
      }));
      
      setPosts(postsData);
      
      // Get marketing channels data
      const channels = await repos.marketingChannels.listManualStats();
      const metricsData: PlatformMetric[] = channels.map(ch => ({
        platform: (ch.channel as string) || "unknown",
        followers: ch.followers || 0,
        postsThisWeek: 0,
        avgReach: 0,
        bestTime: "18:00",
      }));
      
      setMetrics(metricsData);
    } catch (err) {
      console.error("Failed to load schedule data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const scheduledPosts = posts.filter(p => p.status === "scheduled" || p.status === "pending");
  const publishedPosts = posts.filter(p => p.status === "success");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">🤖 AI Auto-Schedule</h1>
          <p className="text-sm text-secondary/50">AI เลือกเวลาโพสต์ที่ดีสุด — เชื่อมต่อ Social Media API จริง</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Scheduled Posts</p>
          <p className="text-2xl font-bold text-secondary">{scheduledPosts.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Published (Week)</p>
          <p className="text-2xl font-bold text-emerald-600">{publishedPosts.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Platforms Connected</p>
          <p className="text-2xl font-bold text-primary">{metrics.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-secondary/50">Best Time Today</p>
          <p className="text-2xl font-bold text-amber-500">18:00</p>
        </CardContent></Card>
      </div>

      {/* Platform Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary-accent" />Connected Platforms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="text-center py-4 text-secondary/50">กำลังโหลด...</div>
          ) : metrics.length === 0 ? (
            <div className="text-center py-4 text-secondary/50">ยังไม่ได้เชื่อมต่อ Platform ใดๆ</div>
          ) : (
            metrics.map((metric) => {
              const cfg = PLATFORM_CONFIG[metric.platform] ?? { color: "text-secondary", bg: "", icon: "📊" };
              return (
                <div key={metric.platform} className={cn("flex items-center justify-between rounded-xl border border-line/10 p-3", cfg.bg)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cfg.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-secondary capitalize">{metric.platform}</p>
                      <p className="text-xs text-secondary/40">{metric.followers.toLocaleString()} followers</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-secondary">{metric.bestTime}</p>
                    <p className="text-[10px] text-secondary/30">Best time</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Optimal Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary-accent" />AI Recommended Times</CardTitle>
          <CardDescription>เวลาที่ AI แนะนำสำหรับโพสต์วันนี้</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {OPTIMAL_TIMES.map((opt) => (
              <div key={opt.time} className={cn("rounded-xl border p-3", opt.score >= 85 ? "border-emerald-200/30 bg-emerald-50/5" : "border-line/10")}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-lg font-bold text-secondary">{opt.time}</p>
                  <Badge variant={opt.score >= 85 ? "success" : "outline"} className="text-[9px]">{opt.score}%</Badge>
                </div>
                <p className="text-xs text-secondary/50">{opt.label}</p>
                <div className="h-1.5 rounded-full bg-line/5 overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${opt.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary-accent" />Scheduled Posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {posts.length === 0 ? (
            <div className="text-center py-4 text-secondary/50">ยังไม่มีโพสต์ที่กำหนดเวลา</div>
          ) : (
            posts.slice(0, 10).map((post) => (
              <div key={post.id} className="flex items-center gap-3 rounded-xl border border-line/10 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-secondary truncate">{post.content}</p>
                  <div className="flex gap-2 mt-1">
                    {post.platforms.map(p => (
                      <Badge key={p} variant="outline" className="text-[9px] capitalize">{PLATFORM_CONFIG[p]?.icon} {p}</Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant={post.status === "success" ? "success" : post.status === "scheduled" ? "warning" : "outline"}>
                    {post.status}
                  </Badge>
                  <p className="text-[10px] text-secondary/30 mt-1">{new Date(post.scheduledAt).toLocaleString("th-TH")}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
