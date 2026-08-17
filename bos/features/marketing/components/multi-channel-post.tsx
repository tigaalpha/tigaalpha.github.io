"use client";

import { useState, useEffect } from "react";
import { Share2, Facebook, Instagram, MessageCircle, Music2, Clock, AlertTriangle, Youtube, Twitter, Copy, Check, Trash2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SocialPost, SocialPlatform } from "@/types/database";

interface Channel {
  id: SocialPlatform;
  label: string;
  icon: typeof Facebook;
  url?: string;
}

const CHANNELS: Channel[] = [
  { id: "facebook", label: "Facebook", icon: Facebook, url: "https://facebook.com" },
  { id: "instagram", label: "Instagram", icon: Instagram, url: "https://instagram.com" },
  { id: "line", label: "LINE OA", icon: MessageCircle, url: "https://manager.line.biz" },
  { id: "tiktok", label: "TikTok", icon: Music2, url: "https://tiktok.com/creator" },
  { id: "x", label: "X (Twitter)", icon: Twitter, url: "https://x.com" },
  { id: "youtube", label: "YouTube", icon: Youtube, url: "https://studio.youtube.com" },
];

// Auto-publish: Facebook (text feed), LINE (broadcast), TikTok (photo/video
// via a public media URL) and X (text + media ≤5MB). Instagram needs an
// image URL, YouTube still posts by hand via the direct link.
const AUTO_PUBLISH_PLATFORMS: SocialPlatform[] = ["facebook", "line", "tiktok", "x", "instagram"];

export function MultiChannelPost() {
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<SocialPlatform[]>([]);
  const [queue, setQueue] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    try {
      const { createClient } = await import("@/services/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/social-posts`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setQueue(data.posts || []);
      }
    } catch (error) {
      console.error("Failed to load queue:", error);
    }
  }

  function toggleChannel(id: SocialPlatform) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleQueue() {
    if (!content.trim() || selected.length === 0) return;
    setLoading(true);
    try {
      const { createClient } = await import("@/services/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/social-posts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: content.trim(), platforms: selected }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setQueue((prev) => [data.post, ...prev]);
        setContent("");
        setSelected([]);
      }
    } catch (error) {
      console.error("Failed to queue post:", error);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, id: string) {
    // navigator.clipboard.writeText() can reject (denied permission, non-HTTPS,
    // no user-gesture context in some browsers) — previously the "copied"
    // checkmark showed unconditionally, telling the user it worked when it
    // may not have.
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setActionError("คัดลอกไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาตให้เข้าถึงคลิปบอร์ด");
    }
  }

  async function publishNow(id: string) {
    setPublishingId(id);
    setActionError(null);
    try {
      const { createClient } = await import("@/services/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/social-publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ postId: id }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.post) {
        setQueue((prev) => prev.map((p) => (p.id === id ? data.post : p)));
        if (data.failed?.length > 0) setActionError(`โพสต์บางช่องทางไม่สำเร็จ: ${data.failed.join("; ")}`);
      } else {
        setActionError(data.error ?? "โพสต์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (error) {
      console.error("Failed to publish post:", error);
      setActionError("โพสต์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPublishingId(null);
    }
  }

  async function deletePost(id: string) {
    try {
      const { createClient } = await import("@/services/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/social-posts-delete?id=${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        setQueue((prev) => prev.filter((p) => p.id !== id));
      } else {
        // Previously a failed delete (expired session, 404, server error)
        // did nothing at all — the item stayed in the queue with no
        // indication anything went wrong.
        setActionError("ลบโพสต์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
      setActionError("ลบโพสต์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-start gap-3 pt-6 text-sm text-info">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            เขียนคอนเทนต์ครั้งเดียว เลือกช่องทาง แล้วคิวไว้ — Facebook/LINE/TikTok/X/Instagram (มี media URL) โพสต์อัตโนมัติได้เลย
            ปุ่ม &quot;โพสต์เลย&quot; ในคิว ส่วน YouTube ยังต้องโพสต์ด้วยมือ (ลิงก์โดยตรงมีในคิวเพื่อให้ง่าย)
          </p>
        </CardContent>
      </Card>

      {actionError ? (
        <Card>
          <CardContent className="flex items-start justify-between gap-3 pt-6 text-sm text-danger">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {actionError}
            </span>
            <button onClick={() => setActionError(null)} className="text-xs text-danger/70 hover:text-danger">
              ปิด
            </button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary-accent" />
            เขียนคอนเทนต์
          </CardTitle>
          <CardDescription>เขียนครั้งเดียว เลือกช่องทาง แล้วคิวโพสต์</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea placeholder="เขียนคอนเทนต์ที่จะโพสต์…" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-32" />

          <div>
            <p className="mb-2 text-sm font-medium text-secondary">เลือกช่องทาง</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                const active = selected.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    onClick={() => toggleChannel(ch.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-3 text-sm transition-colors",
                      active ? "border-primary-accent bg-primary-accent/5 text-secondary" : "border-line/10 text-secondary/60 hover:bg-line/5"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button className="w-full" onClick={handleQueue} disabled={!content.trim() || selected.length === 0 || loading}>
            <Share2 className="h-4 w-4" />
            {loading ? "กำลังคิว..." : `คิวโพสต์ (${selected.length})`}
          </Button>
        </CardContent>
      </Card>

      {queue.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>คิวโพสต์ ({queue.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {queue.map((item) => (
              <div key={item.id} className="rounded-xl border border-line/10 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-secondary/50">
                    <Clock className="h-3 w-3" />
                    {new Date(item.created_at).toLocaleString("th-TH")}
                  </span>
                  <Badge variant={item.status === "success" ? "success" : item.status === "failed" ? "danger" : "warning"}>
                    {item.status === "queued" && "รอโพสต์"}
                    {item.status === "posting" && "กำลังโพสต์"}
                    {item.status === "success" && "โพสต์แล้ว"}
                    {item.status === "failed" && "ล้มเหลว"}
                  </Badge>
                </div>

                <p className="mb-3 text-sm text-secondary">{item.content}</p>

                <div className="mb-3 flex flex-wrap gap-1">
                  {(item.platforms as SocialPlatform[]).map((platform) => (
                    <Badge key={platform} variant="outline">
                      {CHANNELS.find((ch) => ch.id === platform)?.label ?? platform}
                    </Badge>
                  ))}
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {(item.platforms as SocialPlatform[]).map((platform) => {
                    const channel = CHANNELS.find((ch) => ch.id === platform);
                    return (
                      <div key={platform} className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(item.content, `${item.id}-${platform}`)}
                          className="text-xs"
                        >
                          {copied === `${item.id}-${platform}` ? (
                            <>
                              <Check className="h-3 w-3" />
                              คัดลอก
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              คัดลอก
                            </>
                          )}
                        </Button>
                        {AUTO_PUBLISH_PLATFORMS.includes(platform) && !(item.external_ids as Record<string, string>)?.[platform] ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => publishNow(item.id)}
                            disabled={publishingId === item.id}
                          >
                            <Share2 className="h-3 w-3" />
                            {publishingId === item.id ? "กำลังโพสต์…" : "โพสต์เลย"}
                          </Button>
                        ) : (item.external_ids as Record<string, string>)?.[platform] ? (
                          <Badge variant="success" className="text-xs">
                            โพสต์แล้ว
                          </Badge>
                        ) : channel?.url ? (
                          <a href={channel.url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="text-xs">
                              <ExternalLink className="h-3 w-3" />
                              โพสต์
                            </Button>
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {item.error_message && <p className="mb-2 text-xs text-destructive">{item.error_message}</p>}

                <Button size="sm" variant="ghost" onClick={() => deletePost(item.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                  ลบ
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
