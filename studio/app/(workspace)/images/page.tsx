"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { ImageStudio } from "@/features/images/components/image-studio";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function ImagesPage() {
  const [images, setImages] = useState<Tables<"generated_images">[] | null>(null);
  const [referencePhotos, setReferencePhotos] = useState<Tables<"reference_photos">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.generatedImages.list().then(setImages);
  }, []);

  useEffect(() => {
    reload();
    const repos = createRepositories(createClient());
    repos.referencePhotos.list().then(setReferencePhotos);
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Image Studio</h1>
        <p className="text-sm text-secondary/50">วางบทความ → AI วิเคราะห์ → สร้างภาพแนวนอน + แนวตั้ง ทุกฉาก ไว้ทำวิดีโอต่อ</p>
      </div>
      {images && referencePhotos ? (
        <ImageStudio images={images} referencePhotos={referencePhotos} onChanged={reload} />
      ) : (
        <Skeleton className="h-96" />
      )}
    </div>
  );
}
