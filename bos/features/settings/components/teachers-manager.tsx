"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/types/database";

export function TeachersManager({ teachers }: { teachers: Tables<"teachers">[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function addTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    const supabase = createClient();
    await supabase.from("teachers").insert({ name: name.trim() });
    setName("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teachers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={addTeacher} className="flex gap-2">
          <Input placeholder="Teacher name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={submitting}>
            Add
          </Button>
        </form>

        {teachers.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No teachers yet" />
        ) : (
          <ul className="divide-y divide-black/5">
            {teachers.map((teacher) => (
              <li key={teacher.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-secondary">{teacher.name}</span>
                <span className="text-secondary/40">{teacher.active ? "Active" : "Inactive"}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
