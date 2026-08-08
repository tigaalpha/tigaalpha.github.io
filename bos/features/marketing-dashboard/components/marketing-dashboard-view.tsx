"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Globe, Youtube, Facebook, Instagram, Music2, Twitter, RefreshCw, type LucideIcon } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Channel = Tables<"marketing_metric_snapshots">["channel"];
type Metric = Tables<"marketing_metric_snapshots">["metric"];

const RANGE_OPTIONS: { label: string; days: number }[] = [
  { label: "1 วัน", days: 1 },
  { label: "3 วัน", days: 3 },
  { label: "7 วัน", days: 7 },
  { label: "14 วัน", days: 14 },
  { label: "1 เดือน", days: 30 },
  { label: "3 เดือน", days: 90 },
  { label: "6 เดือน", days: 180 },
  { label: "1 ปี", days: 365 },
];

const METRIC_LABELS: Record<Metric, string> = {
  followers: "ผู้ติดตาม",
  likes: "ไลก์",
  views: "วิว",
  shares: "แชร์",
  comments: "คอมเมนต์",
  saves: "บันทึก",
  reposts: "รีโพสต์",
};

interface ChannelDef {
  channel: Channel;
  label: string;
  icon: LucideIcon;
  metrics: Metric[];
  auto: boolean;
}

// Matches the audited per-channel metric matrix -- blank/omitted metrics
// don't apply to that platform rather than showing a fake zero. Auto
// channels are populated by marketing-metrics-snapshot (hourly cron +
// "sync now"); manual channels have no free API (TikTok needs business
// API approval, Instagram needs Meta app review beyond what's connected,
// X's read API is paid-tier-only) so the owner logs them by hand.
const CHANNELS: ChannelDef[] = [
  { channel: "website", label: "เว็บไซต์", icon: Globe, metrics: ["views"], auto: true },
  { channel: "youtube", label: "YouTube", icon: Youtube, metrics: ["followers", "views", "likes", "comments"], auto: true },
  { channel: "facebook", label: "Facebook", icon: Facebook, metrics: ["followers", "likes", "comments", "shares"], auto: true },
  { channel: "tiktok", label: "TikTok", icon: Music2, metrics: ["followers", "likes", "views", "shares", "comments", "saves"], auto: false },
  { channel: "instagram", label: "Instagram", icon: Instagram, metrics: ["followers", "likes", "views", "shares", "comments", "saves"], auto: false },
  { channel: "x", label: "X (Twitter)", icon: Twitter, metrics: ["followers", "likes", "views", "shares", "comments", "reposts"], auto: false },
];

const CHART_COLORS: Record<Channel, string> = {
  website: "#6b7280",
  youtube: "#e5342b",
  facebook: "#2a78d6",
  tiktok: "#1baf7a",
  instagram: "#c2337a",
  x: "#111827",
};

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

interface MetricSummary {
  current: number | null;
  delta: number | null;
}

function summarize(snapshots: Tables<"marketing_metric_snapshots">[], channel: Channel, metric: Metric): MetricSummary {
  const filtered = snapshots.filter((s) => s.channel === channel && s.metric === metric);
  if (filtered.length === 0) return { current: null, delta: null };
  const first = filtered[0]!.value;
  const last = filtered[filtered.length - 1]!.value;
  return { current: last, delta: filtered.length > 1 ? last - first : null };
}

function buildFollowerChartData(snapshots: Tables<"marketing_metric_snapshots">[]): Record<string, number | string>[] {
  const byDate: Record<string, Record<string, number>> = {};
  for (const s of snapshots) {
    if (s.metric !== "followers") continue;
    const dateKey = new Date(s.captured_at).toISOString().slice(0, 10);
    byDate[dateKey] = byDate[dateKey] ?? {};
    // Sorted ascending by captured_at (repository query order), so the
    // last write for a given day wins -- one point per channel per day.
    byDate[dateKey][s.channel] = s.value;
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));
}

export function MarketingDashboardView() {
  const isDark = useIsDarkMode();
  const [rangeDays, setRangeDays] = useState(7);
  const [snapshots, setSnapshots] = useState<Tables<"marketing_metric_snapshots">[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<Record<string, string>>({});
  const [savingManual, setSavingManual] = useState<Channel | null>(null);

  function loadSnapshots() {
    const repos = createRepositories(createClient());
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
    repos.marketingMetrics.snapshotsSince(since).then(setSnapshots);
  }

  useEffect(() => {
    loadSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays]);

  async function handleSyncNow() {
    setSyncing(true);
    setSyncError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.functions.invoke("marketing-metrics-snapshot", { body: {} });
      if (error) throw error;
      loadSnapshots();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "ซิงค์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveManual(def: ChannelDef) {
    setSavingManual(def.channel);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const repos = createRepositories(supabase);
      const userId = userData.user?.id ?? null;

      for (const metric of def.metrics) {
        const raw = manualForm[`${def.channel}:${metric}`];
        if (!raw || raw.trim() === "") continue;
        const value = Number(raw);
        if (!Number.isFinite(value)) continue;
        await repos.marketingMetrics.logManualSnapshot(def.channel, metric, value, userId);
        if (metric === "followers" && (def.channel === "tiktok" || def.channel === "x" || def.channel === "instagram")) {
          await repos.marketingChannels.upsertManualStat(def.channel, value, null, userId);
        }
      }

      setManualForm((prev) => {
        const next = { ...prev };
        for (const metric of def.metrics) delete next[`${def.channel}:${metric}`];
        return next;
      });
      loadSnapshots();
    } finally {
      setSavingManual(null);
    }
  }

  const chartData = useMemo(() => (snapshots ? buildFollowerChartData(snapshots) : []), [snapshots]);
  const followerChannels = CHANNELS.filter((c) => c.metrics.includes("followers"));
  const gridColor = isDark ? "rgb(237 232 224 / 0.1)" : "rgb(28 22 14 / 0.08)";
  const textColor = isDark ? "rgb(237 232 224 / 0.5)" : "rgb(28 22 14 / 0.5)";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setRangeDays(opt.days)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                rangeDays === opt.days ? "bg-primary-gradient text-white" : "bg-line/5 text-secondary/60 hover:bg-line/10"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleSyncNow()} disabled={syncing}>
          <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          {syncing ? "กำลังซิงค์…" : "ซิงค์ตอนนี้"}
        </Button>
      </div>
      {syncError ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{syncError}</p> : null}
      {(() => {
        const earliest = snapshots && snapshots.length > 0 ? snapshots[0]!.captured_at : null;
        const daysOfHistory = earliest ? (Date.now() - new Date(earliest).getTime()) / (24 * 60 * 60 * 1000) : 0;
        return daysOfHistory < 1 ? (
          <p className="text-xs text-secondary/40">
            ระบบเพิ่งเริ่มเก็บข้อมูลไม่นานนี้ — ตัวเลขจะยังเหมือนกันในทุกช่วงเวลาจนกว่าจะมีข้อมูลสะสมข้ามวัน (ระบบซิงค์ให้อัตโนมัติทุกชั่วโมง หรือกดกรอกยอดเองสำหรับ TikTok/Instagram/X)
          </p>
        ) : null;
      })()}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CHANNELS.map((def) => (
          <Card key={def.channel}>
            <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
              <def.icon className="h-4 w-4 text-primary-accent" />
              <CardTitle className="text-sm">{def.label}</CardTitle>
              {!def.auto ? <span className="ml-auto text-[10px] text-secondary/40">กรอกเอง</span> : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshots === null ? (
                <p className="text-xs text-secondary/40">กำลังโหลด…</p>
              ) : (
                <div className="space-y-1.5">
                  {def.metrics.map((metric) => {
                    const { current, delta } = summarize(snapshots, def.channel, metric);
                    return (
                      <div key={metric} className="flex items-center justify-between text-sm">
                        <span className="text-secondary/60">{METRIC_LABELS[metric]}</span>
                        <span className="font-medium text-secondary">
                          {current != null ? current.toLocaleString("th-TH") : "—"}
                          {delta != null ? (
                            <span className={cn("ml-1.5 text-xs", delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-secondary/40")}>
                              {delta > 0 ? "+" : ""}
                              {delta.toLocaleString("th-TH")}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                  {snapshots.filter((s) => s.channel === def.channel).length === 0 ? (
                    <p className="text-xs text-secondary/40">ยังไม่มีข้อมูลในช่วงเวลานี้</p>
                  ) : null}
                </div>
              )}

              {!def.auto ? (
                <div className="space-y-2 border-t border-line/10 pt-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    {def.metrics.map((metric) => (
                      <Input
                        key={metric}
                        type="number"
                        placeholder={METRIC_LABELS[metric]}
                        value={manualForm[`${def.channel}:${metric}`] ?? ""}
                        onChange={(e) => setManualForm((prev) => ({ ...prev, [`${def.channel}:${metric}`]: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-full" disabled={savingManual === def.channel} onClick={() => void handleSaveManual(def)}>
                    {savingManual === def.channel ? "กำลังบันทึก…" : "บันทึกยอดวันนี้"}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>แนวโน้มผู้ติดตามรวมทุกช่องทาง</CardTitle>
          <CardDescription>ข้อมูลเริ่มสะสมตั้งแต่เปิดใช้ฟีเจอร์นี้ — ยังไม่มีข้อมูลย้อนหลังก่อนหน้านี้</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-secondary/40">ยังไม่มีข้อมูลเพียงพอสำหรับแสดงกราฟ</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="date" stroke={textColor} fontSize={12} tickLine={false} axisLine={{ stroke: gridColor }} />
                <YAxis stroke={textColor} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {followerChannels.map((def) => (
                  <Line key={def.channel} type="monotone" dataKey={def.channel} name={def.label} stroke={CHART_COLORS[def.channel]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
