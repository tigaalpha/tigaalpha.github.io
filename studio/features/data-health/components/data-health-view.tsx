"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertOctagon, AlertTriangle, Copy, FileWarning, GitCompareArrows } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import type { DataHealthFinding } from "@/services/repositories/data-health.repository";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_LABEL: Record<string, string> = {
  duplicate: "ข้อมูลซ้ำ",
  missing_data: "ข้อมูลสำคัญหาย",
  malformed: "ข้อมูลผิดรูปแบบ",
  inconsistent_status: "สถานะขัดแย้งกัน",
};

const CATEGORY_ICON: Record<string, typeof Copy> = {
  duplicate: Copy,
  missing_data: FileWarning,
  malformed: AlertTriangle,
  inconsistent_status: GitCompareArrows,
};

const SEVERITY_VARIANT = { critical: "danger", warning: "warning", info: "outline" } as const;
const SEVERITY_LABEL = { critical: "วิกฤต", warning: "ควรตรวจสอบ", info: "ข้อมูล" } as const;

export function DataHealthView() {
  const [findings, setFindings] = useState<DataHealthFinding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.dataHealth
      .report()
      .then(setFindings)
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const criticalCount = findings?.filter((f) => f.severity === "critical").length ?? 0;
  const warningCount = findings?.filter((f) => f.severity === "warning").length ?? 0;
  const byCategory = (findings ?? []).reduce<Record<string, DataHealthFinding[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            {findings && findings.length === 0 ? (
              <CheckCircle2 className="h-8 w-8 text-success" />
            ) : (
              <AlertOctagon className="h-8 w-8 text-primary-accent" />
            )}
            <div>
              <p className="text-2xl font-semibold text-secondary">{findings?.length ?? "—"}</p>
              <p className="text-xs text-secondary/50">รายการที่พบทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertOctagon className="h-8 w-8 text-danger" />
            <div>
              <p className="text-2xl font-semibold text-secondary">{criticalCount}</p>
              <p className="text-xs text-secondary/50">วิกฤต (กระทบการเรียนจริง)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <div>
              <p className="text-2xl font-semibold text-secondary">{warningCount}</p>
              <p className="text-xs text-secondary/50">ควรตรวจสอบ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รายการที่พบ</CardTitle>
          <CardDescription>
            ตรวจสอบข้อมูลซ้ำ ข้อมูลสำคัญที่หายไป และสถานะที่ขัดแย้งกันข้ามตาราง — ระบบนี้ไม่แก้ไขหรือลบข้อมูลใดๆ ให้อัตโนมัติ
            เป็นเพียงรายการให้ตรวจสอบและแก้ไขด้วยตนเอง
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : findings === null ? (
            <Skeleton className="h-64" />
          ) : findings.length === 0 ? (
            <p className="text-sm text-secondary/50">ไม่พบปัญหาข้อมูลในขณะนี้ 🎉</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(byCategory).map(([category, items]) => {
                const Icon = CATEGORY_ICON[category] ?? AlertTriangle;
                return (
                  <div key={category}>
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-secondary/60" />
                      <h3 className="text-sm font-semibold text-secondary">
                        {CATEGORY_LABEL[category] ?? category} ({items.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {items.map((f, i) => (
                        <div key={i} className="rounded-xl border border-line/10 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <Badge variant={SEVERITY_VARIANT[f.severity]}>{SEVERITY_LABEL[f.severity]}</Badge>
                            <span className="text-xs text-secondary/40">{f.entity_type}</span>
                          </div>
                          <p className="text-sm text-secondary">{f.description}</p>
                          <p className="mt-1 text-xs text-secondary/50">แนะนำ: {f.suggested_fix}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
