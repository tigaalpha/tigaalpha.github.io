"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { VerticalVideoStudio } from "@/features/video/components/vertical-video-studio";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function VerticalVideoPage() {
  const [images, setImages] = useState<Tables<"generated_images">[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.generatedImages.list().then(setImages);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Vertical Video</h1>
        <p className="text-sm text-secondary/50">แปลงภาพนิ่งจาก Image Studio ให้เป็นวิดีโอแนวตั้งแบบสไลด์โชว์</p>
      </div>
      {images ? <VerticalVideoStudio images={images} /> : <Skeleton className="h-96" />}
    </div>
  );
}
