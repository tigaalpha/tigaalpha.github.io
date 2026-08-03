"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Download, Film, HardDrive, ExternalLink } from "lucide-react";
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

const MAX_IMAGES = 20;
const POLL_INTERVAL_MS = 6000;
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280;
const FPS = 30;

type VideoProvider = "veo" | "seedance-2" | "seedance-2-fast" | "luma-ray-2" | "runway-gen4-turbo";

interface ProviderInfo {
  id: VideoProvider;
  label: string;
  costLowPerSec: number;
  costHighPerSec: number;
  durationLow: number;
  durationHigh: number;
}

const PROVIDERS: ProviderInfo[] = [
  { id: "veo", label: "Veo 3 Fast (Google)", costLowPerSec: 0.1, costHighPerSec: 0.15, durationLow: 4, durationHigh: 8 },
  { id: "seedance-2", label: "Seedance 2.0 (fal.ai)", costLowPerSec: 0.03, costHighPerSec: 0.05, durationLow: 4, durationHigh: 8 },
  {
    id: "seedance-2-fast",
    label: "Seedance 2.0 Fast (fal.ai, ถูกสุด)",
    costLowPerSec: 0.015,
    costHighPerSec: 0.03,
    durationLow: 4,
    durationHigh: 8,
  },
  {
    id: "luma-ray-2",
    label: "Luma Ray 2 (fal.ai)",
    costLowPerSec: 0.35,
    costHighPerSec: 0.45,
    durationLow: 5,
    durationHigh: 9,
  },
  {
    id: "runway-gen4-turbo",
    label: "Runway Gen-4 Turbo",
    costLowPerSec: 0.05,
    costHighPerSec: 0.08,
    durationLow: 5,
    durationHigh: 10,
  },
];

function imageDataUrl(row: Tables<"generated_images">): string {
  return `data:${row.mime_type};base64,${row.image_base64}`;
}

function videoDataUrl(row: Tables<"video_clips">): string {
  return `data:${row.mime_type};base64,${row.video_base64}`;
}

function estimateCost(imageCount: number, provider: VideoProvider): { low: string; high: string } {
  const rates = PROVIDERS.find((p) => p.id === provider)!;
  return {
    low: (imageCount * rates.durationLow * rates.costLowPerSec).toFixed(2),
    high: (imageCount * rates.durationHigh * rates.costHighPerSec).toFixed(2),
  };
}

function drawVideoCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement) {
  const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
  const vw = video.videoWidth || CANVAS_WIDTH;
  const vh = video.videoHeight || CANVAS_HEIGHT;
  const videoRatio = vw / vh;
  let sx = 0,
    sy = 0,
    sw = vw,
    sh = vh;
  if (videoRatio > canvasRatio) {
    sw = vh * canvasRatio;
    sx = (vw - sw) / 2;
  } else {
    sh = vw / canvasRatio;
    sy = (vh - sh) / 2;
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function playAndDraw(clip: Tables<"video_clips">, ctx: CanvasRenderingContext2D): Promise<void> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = videoDataUrl(clip);
    let raf = 0;

    function draw() {
      if (video.paused || video.ended) return;
      drawVideoCover(ctx, video);
      raf = requestAnimationFrame(draw);
    }

    video.onloadedmetadata = () => {
      video
        .play()
        .then(() => {
          raf = requestAnimationFrame(draw);
        })
        .catch(reject);
    };
    video.onended = () => {
      cancelAnimationFrame(raf);
      resolve();
    };
    video.onerror = () => {
      cancelAnimationFrame(raf);
      reject(new Error("เล่นคลิปวิดีโอไม่สำเร็จระหว่างรวมไฟล์"));
    };
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Real image-to-video generation (Veo) — the source image actually moves,
 * unlike VerticalVideoStudio's free slideshow which only crossfades stills.
 * Select up to 20 images; each becomes its own Veo generation (async, can
 * take minutes), polled individually, then stitched client-side (canvas +
 * MediaRecorder, no server-side encoding) into one continuous video once
 * every clip in the batch has resolved.
 */
export function AiMotionVideoCard({ images, videoClips, onChanged }: AiMotionVideoCardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [provider, setProvider] = useState<VideoProvider>("veo");
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchClipIds, setBatchClipIds] = useState<string[] | null>(null);
  const [combining, setCombining] = useState(false);
  const [combinedVideoUrl, setCombinedVideoUrl] = useState<string | null>(null);
  const [combinedVideoBlob, setCombinedVideoBlob] = useState<Blob | null>(null);
  const [combineNote, setCombineNote] = useState<string | null>(null);
  const [savingToDrive, setSavingToDrive] = useState(false);
  const [driveViewUrl, setDriveViewUrl] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const inFlight = useRef<Set<string>>(new Set());
  const combinedForBatch = useRef<string | null>(null);

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

  // Once every clip in the active batch has resolved (done or error),
  // stitch the successful ones together in selection order.
  useEffect(() => {
    if (!batchClipIds || batchClipIds.length === 0) return;
    if (combinedForBatch.current === batchClipIds.join(",")) return;

    const matched = batchClipIds.map((id) => videoClips.find((c) => c.id === id));
    if (matched.some((c) => !c)) return; // wait for onChanged() to refetch the newly-created rows
    if (matched.some((c) => c!.status === "processing")) return;

    combinedForBatch.current = batchClipIds.join(",");
    const clips = matched as Tables<"video_clips">[];
    void combineClips(clips);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoClips, batchClipIds]);

  function toggleImage(id: string) {
    setConfirming(false);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_IMAGES) return prev;
      return [...prev, id];
    });
  }

  async function combineClips(clips: Tables<"video_clips">[]) {
    const successful = clips.filter((c) => c.status === "done" && c.video_base64);
    if (successful.length === 0) {
      setCombineNote("สร้างวิดีโอไม่สำเร็จทั้งชุด — ลองใหม่อีกครั้ง");
      return;
    }

    setCombining(true);
    setCombineNote(null);
    setCombinedVideoUrl(null);
    setCombinedVideoBlob(null);
    setDriveViewUrl(null);
    setDriveError(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context not available");

      const stream = canvas.captureStream(FPS);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();
      for (const clip of successful) {
        await playAndDraw(clip, ctx);
      }
      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: "video/webm" });
      setCombinedVideoUrl(URL.createObjectURL(blob));
      setCombinedVideoBlob(blob);
      if (successful.length < clips.length) {
        setCombineNote(`รวมสำเร็จ ${successful.length}/${clips.length} คลิป (บางคลิปสร้างไม่สำเร็จ จึงข้ามไป)`);
      }
    } catch (err) {
      setCombineNote(err instanceof Error ? err.message : "รวมวิดีโอไม่สำเร็จ");
    } finally {
      setCombining(false);
    }
  }

  async function handleConfirmGenerate() {
    setStarting(true);
    setError(null);
    setCombinedVideoUrl(null);
    setCombinedVideoBlob(null);
    setCombineNote(null);
    setDriveViewUrl(null);
    setDriveError(null);
    combinedForBatch.current = null;

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{
        videoClips: Tables<"video_clips">[];
        requested: number;
        started: number;
      }>("generate-video-batch-start", { body: { imageIds: selectedIds, provider } });
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from generate-video-batch-start");

      setBatchClipIds(data.videoClips.map((c) => c.id));
      if (data.started < data.requested) {
        setError(`เริ่มสร้างได้ ${data.started}/${data.requested} ภาพ (ติดขีดจำกัดจำนวนครั้งต่อชั่วโมง) — ที่เหลือลองใหม่ภายหลัง`);
      }
      setConfirming(false);
      setSelectedIds([]);
      onChanged();
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setStarting(false);
    }
  }

  async function handleSaveCombinedToDrive() {
    if (!combinedVideoBlob) return;
    setSavingToDrive(true);
    setDriveError(null);
    try {
      const videoBase64 = await blobToBase64(combinedVideoBlob);
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ driveViewUrl: string }>("drive-upload-video", {
        body: { videoBase64, mimeType: "video/webm" },
      });
      if (fnError) throw fnError;
      if (!data) throw new Error("Empty response from drive-upload-video");
      setDriveViewUrl(data.driveViewUrl);
    } catch (err) {
      setDriveError(await describeFunctionError(err));
    } finally {
      setSavingToDrive(false);
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

  const cost = estimateCost(selectedIds.length, provider);
  const providerInfo = PROVIDERS.find((p) => p.id === provider)!;
  const activeBatchClips = batchClipIds?.map((id) => videoClips.find((c) => c.id === id)).filter(Boolean) as
    | Tables<"video_clips">[]
    | undefined;
  const batchInProgress = activeBatchClips?.some((c) => c.status === "processing") ?? false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-accent" />
            สร้างวิดีโอเคลื่อนไหวจริงด้วย AI
          </CardTitle>
          <CardDescription>
            เลือกภาพนิ่งได้ 1-{MAX_IMAGES} ภาพ (แตะเพื่อเลือก/ยกเลิก ตามลำดับ) — แต่ละภาพจะกลายเป็นคลิปเคลื่อนไหวจริงความยาว
            สุ่มระหว่าง {providerInfo.durationLow}-{providerInfo.durationHigh} วินาที (ตามที่โมเดลรองรับ) แล้วต่อกันเป็นวิดีโอเดียวยาวต่อเนื่องอัตโนมัติ
            ใช้เวลาประมวลผลรวมประมาณ 1-3 นาทีต่อภาพ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-secondary/50">โมเดล</p>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProvider(p.id);
                    setConfirming(false);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    provider === p.id
                      ? "border-transparent bg-primary-gradient text-white"
                      : "border-line/10 text-secondary/70 hover:bg-line/5"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {images.map((img) => {
              const order = selectedIds.indexOf(img.id);
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => toggleImage(img.id)}
                  className={cn(
                    "relative overflow-hidden rounded-xl border-2 transition-colors",
                    order >= 0 ? "border-primary-accent" : "border-transparent"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageDataUrl(img)} alt={img.prompt} className="aspect-[9/16] w-full object-cover" />
                  {order >= 0 ? (
                    <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-gradient text-xs font-bold text-white">
                      {order + 1}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

          {confirming ? (
            <div className="space-y-2 rounded-xl border border-primary-accent/30 bg-primary-accent/5 p-3 text-sm">
              <p className="text-secondary">
                จะสร้างวิดีโอเคลื่อนไหว <b>{selectedIds.length} ภาพ</b> — มีค่าใช้จ่ายจริงต่อภาพ ประมาณรวม{" "}
                <b>
                  ${cost.low}-${cost.high}
                </b>{" "}
                (ราคาโดยประมาณ ขึ้นกับความยาวคลิปที่สุ่มได้)
              </p>
              <div className="flex gap-2">
                <Button onClick={() => void handleConfirmGenerate()} disabled={starting} className="flex-1">
                  {starting ? "กำลังเริ่มสร้าง…" : "ยืนยัน สร้างเลย"}
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={starting} className="flex-1">
                  ยกเลิก
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setConfirming(true)} disabled={selectedIds.length === 0} className="w-full">
              สร้างวิดีโอเคลื่อนไหว ({selectedIds.length} ภาพ)
            </Button>
          )}
        </CardContent>
      </Card>

      {batchClipIds ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-4 w-4 text-primary-accent" />
              วิดีโอรวม (ชุดล่าสุด)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {batchInProgress ? (
              <p className="text-sm text-secondary/50">
                กำลังสร้างคลิป… ({activeBatchClips?.filter((c) => c.status === "done").length ?? 0}/{batchClipIds.length}{" "}
                เสร็จแล้ว) — พอครบทุกคลิปจะต่อกันเป็นวิดีโอเดียวให้อัตโนมัติ
              </p>
            ) : combining ? (
              <p className="text-sm text-secondary/50">กำลังต่อคลิปเป็นวิดีโอเดียว…</p>
            ) : combinedVideoUrl ? (
              <div className="space-y-2">
                <video src={combinedVideoUrl} controls className="mx-auto aspect-[9/16] w-full max-w-[240px] rounded-xl bg-black" />
                {combineNote ? <p className="text-xs text-secondary/50">{combineNote}</p> : null}
                <a href={combinedVideoUrl} download="tiga-motion-video.webm">
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4" />
                    ดาวน์โหลดวิดีโอรวม (.webm)
                  </Button>
                </a>
                {driveError ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{driveError}</p> : null}
                {driveViewUrl ? (
                  <a href={driveViewUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full text-success">
                      <ExternalLink className="h-4 w-4" />
                      เปิดใน Google Drive
                    </Button>
                  </a>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => void handleSaveCombinedToDrive()} disabled={savingToDrive}>
                    <HardDrive className="h-4 w-4" />
                    {savingToDrive ? "กำลังบันทึกไปยัง Google Drive…" : "บันทึกไปยัง Google Drive"}
                  </Button>
                )}
              </div>
            ) : combineNote ? (
              <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{combineNote}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>คลิปเดี่ยวที่สร้างไว้ ({videoClips.length})</CardTitle>
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
