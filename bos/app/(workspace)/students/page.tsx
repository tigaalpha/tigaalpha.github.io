"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { StudentsTable, type StudentRow } from "@/features/students/components/students-table";
import { StudentImport } from "@/features/students/components/student-import";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [showImport, setShowImport] = useState(false);

  function reload() {
    const repos = createRepositories(createClient());
    repos.customers.listPipeline().then(setStudents);
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">Students / CRM</h1>
          <p className="text-sm text-secondary/50">{students ? `${students.length} customers` : "Loading…"}</p>
        </div>
        {!showImport ? (
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4" />
            นำเข้าข้อมูลนักเรียน
          </Button>
        ) : null}
      </div>
      {showImport ? (
        <StudentImport
          onClose={() => setShowImport(false)}
          onImported={() => {
            reload();
          }}
        />
      ) : null}
      {students ? <StudentsTable students={students} /> : <Skeleton className="h-64" />}
    </div>
  );
}
