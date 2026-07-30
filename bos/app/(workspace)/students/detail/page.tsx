"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { StudentDetail } from "@/features/students/components/student-detail";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { UserX } from "lucide-react";
import type { Tables } from "@/types/database";

interface DetailData {
  customer: Tables<"customers">;
  courses: Tables<"courses">[];
  history: Tables<"sales_status_history">[];
}

function StudentDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [data, setData] = useState<DetailData | null | "not_found">(null);

  useEffect(() => {
    if (!id) {
      setData("not_found");
      return;
    }

    // Without this flag, clicking through the student list quickly (id A
    // then id B before A's fetch resolves) could let A's slower response
    // land after B's and overwrite the screen with the wrong customer —
    // the same pattern message-thread.tsx already guards against.
    let cancelled = false;
    const repos = createRepositories(createClient());
    repos.customers.findById(id).then(async (customer) => {
      if (cancelled) return;
      if (!customer) {
        setData("not_found");
        return;
      }
      const [courses, history] = await Promise.all([repos.courses.listForCustomer(id), repos.sales.history(id)]);
      if (cancelled) return;
      setData({ customer, courses, history });
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (data === null) return <Skeleton className="h-96" />;
  if (data === "not_found") return <EmptyState icon={UserX} title="Customer not found" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">{data.customer.name}</h1>
        <p className="text-sm text-secondary/50">Customer profile</p>
      </div>
      <StudentDetail customer={data.customer} courses={data.courses} history={data.history} />
    </div>
  );
}

export default function StudentDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <StudentDetailContent />
    </Suspense>
  );
}
