"use client";

import { useState } from "react";
import { Share2, Facebook, Instagram, MessageCircle, Music2, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Channel {
  id: string;
  label: string;
  icon: typeof Facebook;
}

const CHANNELS: Channel[] = [
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "line", label: "LINE OA", icon: MessageCircle },
  { id: "tiktok", label: "TikTok", icon: Music2 },
];

interface QueueItem {
  id: string;
  content: string;
  channels: string[];
  queuedAt: string;
}

/**
 * UI/workflow only — no channel is actually connected yet (each one needs
 * its own Developer App + credentials, set up separately). Queuing here is
 * local to this browser tab so it's honest about not actually posting
 * anywhere; wire up real posting once the owner decides which channels to
 * connect for real.
 */
export function MultiChannelPost() {
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  function toggleChannel(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function handleQueue() {
    if (!content.trim() || selected.length === 0) return;
    setQueue((prev) => [
      { id: crypto.randomUUID(), content: content.trim(), channels: [...selected], queuedAt: new Date().toLocaleString("th-TH") },
      ...prev,
    ]);
    setContent("");
    setSelected([]);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-start gap-3 pt-6 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            หน้านี้ยังเป็น UI ตัวอย่างเท่านั้น — ยังไม่ได้เชื่อมต่อ API จริงของแต่ละช่องทาง (แต่ละที่ต้องสมัคร Developer
            App และขอสิทธิ์แยกกัน) กดคิวโพสต์ที่นี่จะยังไม่ถูกโพสต์ขึ้นช่องทางจริง
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary-accent" />
            โพสต์คอนเทนต์
          </CardTitle>
          <CardDescription>เขียนคอนเทนต์ครั้งเดียว เลือกช่องทางที่ต้องการ แล้วกดปุ่มเดียวคิวไปทุกช่องทางพร้อมกัน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea placeholder="เขียนคอนเทนต์ที่จะโพสต์…" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-32" />

          <div>
            <p className="mb-2 text-sm font-medium text-secondary">ช่องทาง</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    <Badge variant="outline" className="text-[10px]">
                      ยังไม่เชื่อมต่อ
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <Button className="w-full" onClick={handleQueue} disabled={!content.trim() || selected.length === 0}>
            <Share2 className="h-4 w-4" />
            คิวโพสต์ไปทุกช่องทางที่เลือก ({selected.length})
          </Button>
        </CardContent>
      </Card>

      {queue.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>คิวโพสต์ ({queue.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {queue.map((item) => (
              <div key={item.id} className="rounded-xl border border-line/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-secondary/50">
                    <Clock className="h-3 w-3" />
                    {item.queuedAt}
                  </span>
                  <Badge variant="warning">รอเชื่อมต่อ API</Badge>
                </div>
                <p className="mb-2 text-sm text-secondary">{item.content}</p>
                <div className="flex flex-wrap gap-1">
                  {item.channels.map((c) => (
                    <Badge key={c} variant="outline">
                      {CHANNELS.find((ch) => ch.id === c)?.label ?? c}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
