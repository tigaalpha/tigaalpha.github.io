"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { ImageStudio } from "@/features/images/components/image-studio";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function ImagesPage() {
  const [images, setImages] = useState<Tables<"generated_images">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.generatedImages.list().then(setImages);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Image Studio</h1>
        <p className="text-sm text-secondary/50">สร้างภาพนิ่งด้วย AI ไว้ใช้เป็นวัตถุดิบสำหรับวิดีโอแนวตั้ง</p>
      </div>
      {images ? <ImageStudio images={images} onChanged={reload} /> : <Skeleton className="h-96" />}
    </div>
  );
}
