"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { VerticalVideoStudio } from "@/features/video/components/vertical-video-studio";
import { AiMotionVideoCard } from "@/features/video/components/ai-motion-video-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function VerticalVideoPage() {
  const [images, setImages] = useState<Tables<"generated_images">[] | null>(null);
  const [videoClips, setVideoClips] = useState<Tables<"video_clips">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.generatedImages.list().then(setImages);
    repos.videoClips.list().then(setVideoClips);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Vertical Video</h1>
        <p className="text-sm text-secondary/50">แปลงภาพนิ่งจาก Image Studio ให้เป็นวิดีโอแนวตั้ง</p>
      </div>

      {images && videoClips ? (
        <AiMotionVideoCard images={images} videoClips={videoClips} onChanged={reload} />
      ) : (
        <Skeleton className="h-96" />
      )}

      <div>
        <h2 className="text-lg font-semibold text-secondary">สไลด์โชว์ฟรี (ไม่มีค่าใช้จ่าย)</h2>
        <p className="text-sm text-secondary/50">เรียงภาพนิ่งต่อกันแบบเฟด — เรนเดอร์ในเบราว์เซอร์ ไม่มีต้นทุน AI</p>
      </div>
      {images ? <VerticalVideoStudio images={images} /> : <Skeleton className="h-96" />}
    </div>
  );
}
