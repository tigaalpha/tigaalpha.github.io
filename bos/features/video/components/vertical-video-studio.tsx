"use client";

import { useRef, useState } from "react";
import { Clapperboard, Download, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280; // 9:16 vertical
const SECONDS_PER_IMAGE = 3;
const FADE_SECONDS = 0.6;
const FPS = 30;

interface VerticalVideoStudioProps {
  images: Tables<"generated_images">[];
}

function dataUrl(row: Tables<"generated_images">): string {
  return `data:${row.mime_type};base64,${row.image_base64}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** object-fit: cover, so a portrait or landscape source always fills the 9:16 canvas without distortion. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, alpha: number) {
  const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
  const imgRatio = img.width / img.height;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > canvasRatio) {
    sw = img.height * canvasRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / canvasRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.globalAlpha = 1;
}

/**
 * No paid video-generation service involved — this composites the selected
 * still images onto a canvas (crossfade slideshow, 9:16) and records the
 * canvas stream straight to a downloadable WebM with the browser's own
 * MediaRecorder API. Real, working, and free.
 */
export function VerticalVideoStudio({ images }: VerticalVideoStudioProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  async function render() {
    if (selected.length === 0) return;
    setRendering(true);
    setProgress(0);
    setError(null);
    setVideoUrl(null);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not ready");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const maybeCtx = canvas.getContext("2d");
      if (!maybeCtx) throw new Error("Canvas 2D context not available");
      const ctx: CanvasRenderingContext2D = maybeCtx;

      const chosen = selected
        .map((id) => images.find((img) => img.id === id))
        .filter((img): img is Tables<"generated_images"> => Boolean(img));
      const loaded = await Promise.all(chosen.map((img) => loadImage(dataUrl(img))));

      const stream = canvas.captureStream(FPS);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const done = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();

      const totalSeconds = loaded.length * SECONDS_PER_IMAGE;
      const start = performance.now();

      await new Promise<void>((resolve) => {
        function frame() {
          const elapsed = (performance.now() - start) / 1000;
          setProgress(Math.min(100, Math.round((elapsed / totalSeconds) * 100)));

          if (elapsed >= totalSeconds) {
            resolve();
            return;
          }

          const index = Math.min(loaded.length - 1, Math.floor(elapsed / SECONDS_PER_IMAGE));
          const withinImage = elapsed - index * SECONDS_PER_IMAGE;

          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          drawCover(ctx, loaded[index]!, 1);

          // Crossfade into the next image during the last FADE_SECONDS of this slot.
          if (withinImage > SECONDS_PER_IMAGE - FADE_SECONDS && index + 1 < loaded.length) {
            const fadeProgress = (withinImage - (SECONDS_PER_IMAGE - FADE_SECONDS)) / FADE_SECONDS;
            drawCover(ctx, loaded[index + 1]!, fadeProgress);
          }

          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });

      recorder.stop();
      await done;

      const blob = new Blob(chunks, { type: "video/webm" });
      setVideoUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างวิดีโอไม่สำเร็จ");
    } finally {
      setRendering(false);
    }
  }

  if (images.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Clapperboard}
            title="ยังไม่มีภาพให้ใช้"
            description="ไปสร้างภาพก่อนที่หน้า Image Studio แล้วกลับมาเลือกภาพที่นี่"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>เลือกภาพเรียงลำดับ ({selected.length} ภาพ)</CardTitle>
          <CardDescription>แตะภาพเพื่อเลือก/ยกเลิก — วิดีโอจะเรียงตามลำดับที่เลือก ภาพละ {SECONDS_PER_IMAGE} วินาที พร้อมเฟดต่อเนื่อง</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {images.map((img) => {
              const order = selected.indexOf(img.id);
              return (
                <button
                  key={img.id}
                  onClick={() => toggle(img.id)}
                  className={cn(
                    "relative overflow-hidden rounded-xl border-2 transition-colors",
                    order >= 0 ? "border-primary-accent" : "border-transparent"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={dataUrl(img)} alt={img.prompt} className="aspect-[9/16] w-full object-cover" />
                  {order >= 0 ? (
                    <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-gradient text-xs font-bold text-white">
                      {order + 1}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-primary-accent" />
            เรนเดอร์วิดีโอแนวตั้ง
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <canvas ref={canvasRef} className="mx-auto aspect-[9/16] w-full max-w-[240px] rounded-xl bg-black" />
          {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <Button onClick={() => void render()} disabled={rendering || selected.length === 0} className="w-full">
            <Play className="h-4 w-4" />
            {rendering ? `กำลังเรนเดอร์… ${progress}%` : "เรนเดอร์วิดีโอ"}
          </Button>
          {videoUrl ? (
            <a href={videoUrl} download="tiga-vertical-video.webm">
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4" />
                ดาวน์โหลดวิดีโอ (.webm)
              </Button>
            </a>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
