"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { CourseWriterManager } from "@/features/course-writer/components/course-writer-manager";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/types/database";

export default function CourseWriterPage() {
  const [courseArticles, setCourseArticles] = useState<Tables<"course_articles">[] | null>(null);

  const reload = useCallback(() => {
    const repos = createRepositories(createClient());
    repos.courseArticles.list().then(setCourseArticles);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Online Course Writer</h1>
        <p className="text-sm text-secondary/50">เขียนบทเรียนสำหรับคอร์สเรียนเปียโนออนไลน์ โดยค้นข้อมูลจริงจากเว็บมาอ้างอิงให้อัตโนมัติ</p>
      </div>
      {courseArticles ? <CourseWriterManager courseArticles={courseArticles} onChanged={reload} /> : <Skeleton className="h-96" />}
    </div>
  );
}
