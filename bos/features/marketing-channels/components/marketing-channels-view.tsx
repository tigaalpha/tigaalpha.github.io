"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Youtube, Facebook, Instagram, Music2, Twitter, RefreshCw, Pencil, ExternalLink, type LucideIcon } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface WebsiteStatus {
  connected: boolean;
  detail: string;
  responseTimeMs?: number;
  statusCode?: number;
}

interface YouTubeStatus {
  connected: boolean;
  detail: string;
  title?: string;
  thumbnail?: string;
  subscriberCount?: number;
  viewCount?: number;
  videoCount?: number;
  latestVideo?: { title: string; videoId: string; publishedAt: string };
}

interface FacebookStatus {
  connected: boolean;
  detail: string;
  name?: string;
  fanCount?: number;
  link?: string;
}

interface AutoStatusResponse {
  website: WebsiteStatus;
  youtube: YouTubeStatus;
  facebook: FacebookStatus;
}

const AUTO_REFRESH_MS = 5 * 60 * 1000;

const MANUAL_CHANNELS: { channel: "tiktok" | "x" | "instagram"; label: string; icon: LucideIcon }[] = [
  { channel: "tiktok", label: "TikTok", icon: Music2 },
  { channel: "x", label: "X (Twitter)", icon: Twitter },
  { channel: "instagram", label: "Instagram", icon: Instagram },
];

function fmtNumber(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toLocaleString("th-TH");
}

function ChannelBadge({ connected }: { connected: boolean | null }) {
  if (connected === null) return <Badge variant="outline">กำลังตรวจสอบ…</Badge>;
  return <Badge variant={connected ? "success" : "danger"}>{connected ? "เชื่อมต่อ" : "ไม่เชื่อมต่อ"}</Badge>;
}

export function MarketingChannelsView() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [savingWebsiteUrl, setSavingWebsiteUrl] = useState(false);
  const [youtubeHandle, setYoutubeHandle] = useState("");
  const [savingYoutubeHandle, setSavingYoutubeHandle] = useState(false);

  const [autoStatus, setAutoStatus] = useState<AutoStatusResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const [manualStats, setManualStats] = useState<Tables<"marketing_channel_manual_stats">[] | null>(null);
  const [editingChannel, setEditingChannel] = useState<"tiktok" | "x" | "instagram" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const userIdRef = useRef<string | null>(null);

  const refreshAuto = useCallback(async () => {
    setChecking(true);
    const supabase = createClient();
    const { data } = await supabase.functions.invoke<AutoStatusResponse>("marketing-channel-status");
    if (data) {
      setAutoStatus(data);
      setLastChecked(new Date());
    }
    setChecking(false);
  }, []);

  const reloadManual = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.marketingChannels.listManualStats().then(setManualStats);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const repos = createRepositories(supabase);
    repos.integrations.get("marketing_website_url").then((v) => setWebsiteUrl(v ?? ""));
    repos.integrations.get("youtube_channel_handle").then((v) => setYoutubeHandle(v ?? ""));
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
    reloadManual();
    void refreshAuto();

    const interval = setInterval(() => void refreshAuto(), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshAuto, reloadManual]);

  async function saveWebsiteUrl() {
    setSavingWebsiteUrl(true);
    const repos = createRepositories(createClient());
    await repos.integrations.set("marketing_website_url", websiteUrl.trim());
    setSavingWebsiteUrl(false);
    void refreshAuto();
  }

  async function saveYoutubeHandle() {
    setSavingYoutubeHandle(true);
    const repos = createRepositories(createClient());
    await repos.integrations.set("youtube_channel_handle", youtubeHandle.trim());
    setSavingYoutubeHandle(false);
    void refreshAuto();
  }

  function startEditing(channel: "tiktok" | "x" | "instagram", currentValue: number) {
    setEditingChannel(channel);
    setEditValue(String(currentValue));
  }

  async function saveManualStat() {
    if (!editingChannel) return;
    const followers = Number(editValue);
    if (!Number.isFinite(followers) || followers < 0) return;
    setSavingManual(true);
    const repos = createRepositories(createClient());
    await repos.marketingChannels.upsertManualStat(editingChannel, Math.round(followers), null, userIdRef.current);
    setSavingManual(false);
    setEditingChannel(null);
    reloadManual();
  }

  const manualByChannel = new Map((manualStats ?? []).map((row) => [row.channel, row]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ตั้งค่าช่องทาง</CardTitle>
          <CardDescription>กรอกครั้งเดียว ระบบจะดึงข้อมูลสดจากช่องทางเหล่านี้ให้เองทุกครั้งที่เปิดหน้านี้</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-secondary/50">URL เว็บไซต์</label>
              <Input placeholder="https://tigaalpha.github.io/studio" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => void saveWebsiteUrl()} disabled={savingWebsiteUrl}>
              {savingWebsiteUrl ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-secondary/50">YouTube handle (เช่น @tigastudio) หรือ Channel ID</label>
              <Input placeholder="@tigastudio" value={youtubeHandle} onChange={(e) => setYoutubeHandle(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => void saveYoutubeHandle()} disabled={savingYoutubeHandle}>
              {savingYoutubeHandle ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
          <p className="text-xs text-secondary/40">
            ต้องตั้งค่า <code className="rounded bg-line/5 px-1">YOUTUBE_API_KEY</code> ใน Supabase Dashboard ก่อน — ดูวิธีที่หน้า Settings
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-secondary">เชื่อมต่ออัตโนมัติ (Real-time)</h2>
          {lastChecked ? <p className="text-xs text-secondary/40">เช็คล่าสุด {lastChecked.toLocaleTimeString("th-TH")}</p> : null}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refreshAuto()} disabled={checking}>
          <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-secondary/60" />
                <p className="font-medium text-secondary">เว็บไซต์</p>
              </div>
              <ChannelBadge connected={autoStatus?.website.connected ?? null} />
            </div>
            {autoStatus?.website.responseTimeMs !== undefined ? (
              <p className="text-2xl font-semibold text-secondary">{autoStatus.website.responseTimeMs} ms</p>
            ) : null}
            <p className="text-xs text-secondary/50">{autoStatus?.website.detail ?? "กำลังตรวจสอบ…"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Youtube className="h-5 w-5 text-secondary/60" />
                <p className="font-medium text-secondary">YouTube</p>
              </div>
              <ChannelBadge connected={autoStatus?.youtube.connected ?? null} />
            </div>
            {autoStatus?.youtube.connected ? (
              <>
                <p className="text-2xl font-semibold text-secondary">{fmtNumber(autoStatus.youtube.subscriberCount)}</p>
                <p className="text-xs text-secondary/50">
                  ผู้ติดตาม · {fmtNumber(autoStatus.youtube.videoCount)} วิดีโอ · {fmtNumber(autoStatus.youtube.viewCount)} ยอดวิว
                </p>
                {autoStatus.youtube.latestVideo ? (
                  <a
                    href={`https://www.youtube.com/watch?v=${autoStatus.youtube.latestVideo.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 truncate text-xs text-primary-accent underline"
                  >
                    ล่าสุด: {autoStatus.youtube.latestVideo.title} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-secondary/50">{autoStatus?.youtube.detail ?? "กำลังตรวจสอบ…"}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Facebook className="h-5 w-5 text-secondary/60" />
                <p className="font-medium text-secondary">Facebook</p>
              </div>
              <ChannelBadge connected={autoStatus?.facebook.connected ?? null} />
            </div>
            {autoStatus?.facebook.connected ? (
              <>
                <p className="text-2xl font-semibold text-secondary">{fmtNumber(autoStatus.facebook.fanCount)}</p>
                <p className="text-xs text-secondary/50">ผู้ติดตาม Page · {autoStatus.facebook.name}</p>
                {autoStatus.facebook.link ? (
                  <a
                    href={autoStatus.facebook.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary-accent underline"
                  >
                    เปิด Page <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-secondary/50">{autoStatus?.facebook.detail ?? "กำลังตรวจสอบ…"}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-secondary">กรอกยอดเอง</h2>
        <p className="text-xs text-secondary/40">
          แพลตฟอร์มเหล่านี้ไม่มี API สาธารณะฟรีสำหรับดึงยอดผู้ติดตามแบบ real-time — กรอกยอดล่าสุดด้วยตัวเอง
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MANUAL_CHANNELS.map(({ channel, label, icon: Icon }) => {
          const row = manualByChannel.get(channel);
          const isEditing = editingChannel === channel;
          return (
            <Card key={channel}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-secondary/60" />
                    <p className="font-medium text-secondary">{label}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => startEditing(channel, row?.followers ?? 0)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                {isEditing ? (
                  <div className="flex items-end gap-2">
                    <Input type="number" min={0} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                    <Button size="sm" onClick={() => void saveManualStat()} disabled={savingManual}>
                      บันทึก
                    </Button>
                  </div>
                ) : (
                  <p className="text-2xl font-semibold text-secondary">{fmtNumber(row?.followers ?? 0)}</p>
                )}
                <p className="text-xs text-secondary/50">
                  {row ? `อัปเดตล่าสุด ${new Date(row.updated_at).toLocaleDateString("th-TH")}` : "ยังไม่เคยกรอก"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
