"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SalesStatus, Tables } from "@/types/database";

const STATUS_TONE: Record<SalesStatus, "default" | "success" | "warning" | "danger"> = {
  new_lead: "default",
  contacted: "default",
  qualified: "default",
  interested: "default",
  trial_booked: "warning",
  trial_completed: "warning",
  negotiating: "warning",
  waiting_decision: "warning",
  won: "success",
  lost: "danger",
  renew_pending: "danger",
  renewed: "success",
};

export interface StudentRow extends Tables<"customers"> {
  courseSummary?: string;
}

export function StudentsTable({
  students,
  onDelete,
}: {
  students: StudentRow[];
  onDelete?: (id: string) => void;
}) {
  if (students.length === 0) {
    return <EmptyState icon={Users} title="No students yet" description="New leads will appear here automatically." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line/5 bg-card shadow-soft">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line/5 text-xs text-secondary/50">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Course</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Last Contact</th>
            {onDelete ? <th className="px-4 py-3 font-medium"></th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {students.map((student) => (
            <tr key={student.id} className="hover:bg-black/[0.02]">
              <td className="px-4 py-3">
                <Link href={`/students/detail?id=${student.id}`} className="font-medium text-secondary hover:text-primary-accent">
                  {student.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-secondary/70">{student.phone ?? "—"}</td>
              <td className="px-4 py-3 text-secondary/70">{student.courseSummary ?? "—"}</td>
              <td className="px-4 py-3">
                <Badge variant={STATUS_TONE[student.sales_status]}>{student.sales_status.replace(/_/g, " ")}</Badge>
              </td>
              <td className="px-4 py-3 text-secondary/50">
                {student.last_contact_at ? new Date(student.last_contact_at).toLocaleDateString() : "—"}
              </td>
              {onDelete ? (
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          `ลบ "${student.name}" ออกจากระบบ?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้`
                        )
                      ) {
                        onDelete(student.id);
                      }
                    }}
                    className="text-secondary/40 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
