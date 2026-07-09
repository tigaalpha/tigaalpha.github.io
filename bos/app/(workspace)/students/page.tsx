"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { StudentsTable, type StudentRow } from "@/features/students/components/students-table";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRow[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.customers.listPipeline().then(setStudents);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Students / CRM</h1>
        <p className="text-sm text-secondary/50">{students ? `${students.length} customers` : "Loading…"}</p>
      </div>
      {students ? <StudentsTable students={students} /> : <Skeleton className="h-64" />}
    </div>
  );
}
