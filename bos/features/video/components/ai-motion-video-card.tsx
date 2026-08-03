"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Download } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { describeFunctionError, cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface AiMotionVideoCardProps {
  images: Tables<"generated_images">[];
  videoClips: Tables<"video_clips">[];
  onChanged: () => void;
}

function imageDataUrl(row: Tables<"generated_images">): string {
  return `data:${row.mime_type};base64,${row.image_base64}`;
}

function videoDataUrl(row: Tables<"video_clips">): string {
  return `data:${row.mime_type};base64,${row.video_base64}`;
}

const POLL_INTERVAL_MS = 6000;

/**
 * Real image-to-video generation (Veo) — the source image actually moves,
 * unlike VerticalVideoStudio's free slideshow which only crossfades stills.
 * Generation is an async Google operation that can take minutes, so this
 * polls generate-video-clip-status until each processing clip resolves.
 */
export function AiMotionVideoCard({ images, videoClips, onChanged }: AiMotionVideoCardProps) {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const processingIds = videoClips.filter((c) => c.status === "processing").map((c) => c.id);
  const processingKey = processingIds.join(",");

  useEffect(() => {
    if (processingIds.length === 0) return;
    const interval = setInterval(async () => {
      const supabase = createClient();
      await Promise.all(
        processingIds
          .filter((id) => !inFlight.current.has(id))
          .map(async (id) => {
            inFlight.current.add(id);
            try {
              await supabase.functions.invoke("generate-video-clip-status", { body: { videoClipId: id } });
            } finally {
              inFlight.current.delete(id);
            }
          })
      );
      onChanged();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingKey]);

  async function handleGenerate() {
    if (!selectedImageId) return;
    setStarting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ videoClip: Tables<"video_clips"> }>(
        "generate-video-clip-start",
        { body: { imageId: selectedImageId } }
      );
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from generate-video-clip-start");
      onChanged();
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setStarting(false);
    }
  }

  if (images.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState icon={Sparkles} title="ยังไม่มีภาพให้ใช้" description="ไปสร้างภาพก่อนที่หน้า Image Studio แล้วกลับมาเลือกภาพที่นี่" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-accent" />
            สร้างวิดีโอเคลื่อนไหวจริงด้วย AI (Veo)
          </CardTitle>
          <CardDescription>
            เลือกภาพนิ่ง 1 ภาพ แล้วให้ AI สร้างวิดีโอที่ภาพนั้นเคลื่อนไหวจริง — ใช้เวลาประมวลผลประมาณ 1-3 นาที
            ความยาวคลิปสุ่มระหว่าง 4-8 วินาที
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedImageId(img.id)}
                className={cn(
                  "relative overflow-hidden rounded-xl border-2 transition-colors",
                  selectedImageId === img.id ? "border-primary-accent" : "border-transparent"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageDataUrl(img)} alt={img.prompt} className="aspect-[9/16] w-full object-cover" />
              </button>
            ))}
          </div>
          {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <Button onClick={() => void handleGenerate()} disabled={starting || !selectedImageId} className="w-full">
            {starting ? "กำลังเริ่มสร้างวิดีโอ…" : "สร้างวิดีโอเคลื่อนไหว"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>วิดีโอที่สร้างไว้ ({videoClips.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {videoClips.length === 0 ? (
            <EmptyState icon={Sparkles} title="ยังไม่มีวิดีโอ" description="เลือกภาพแล้วกดสร้างวิดีโอด้านบน" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {videoClips.map((clip) => (
                <div key={clip.id} className="overflow-hidden rounded-xl border border-line/10">
                  {clip.status === "done" && clip.video_base64 ? (
                    <video src={videoDataUrl(clip)} controls loop className="aspect-[9/16] w-full bg-black object-cover" />
                  ) : clip.status === "error" ? (
                    <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-1 bg-danger/10 p-3 text-center text-xs text-danger">
                      <span>สร้างไม่สำเร็จ</span>
                      <span className="line-clamp-3">{clip.error_message}</span>
                    </div>
                  ) : (
                    <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-1 bg-line/5 p-3 text-center text-xs text-secondary/50">
                      <span className="animate-pulse">กำลังสร้าง…</span>
                      <span>({clip.duration_seconds}s)</span>
                    </div>
                  )}
                  {clip.status === "done" && clip.video_base64 ? (
                    <a href={videoDataUrl(clip)} download={`tiga-motion-${clip.id}.mp4`}>
                      <Button variant="ghost" size="sm" className="w-full rounded-none">
                        <Download className="h-4 w-4" />
                        ดาวน์โหลด
                      </Button>
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
