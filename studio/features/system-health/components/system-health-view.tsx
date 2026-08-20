"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, AlertTriangle, Info, DatabaseBackup, Download, ShieldCheck, ShieldAlert } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/types/database";

const SEVERITY_ICON = { error: AlertCircle, warning: AlertTriangle, info: Info } as const;
const SEVERITY_VARIANT = { error: "danger", warning: "warning", info: "outline" } as const;

function BackupHistory() {
  const [backups, setBackups] = useState<Tables<"system_backups">[] | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.systemBackups.listRecent(14).then(setBackups).catch(() => setBackups([]));
  }, []);

  async function handleDownload(id: string, takenAt: string) {
    setDownloadingId(id);
    try {
      const repos = createRepositories(createClient());
      const full = await repos.systemBackups.getFull(id);
      if (!full) return;
      const blob = new Blob([JSON.stringify(full.tables, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tiga-backup-${takenAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  const latest = backups?.[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseBackup className="h-4 w-4 text-primary-accent" />
          Backup รายวัน (customers / courses / bookings / transactions)
        </CardTitle>
        <CardDescription>
          Backup อัตโนมัติทุกวันตอนตี 3 เก็บย้อนหลัง 14 วัน — เสริมจาก backup ระดับแพลตฟอร์มของ Supabase เอง
          (เช็ค plan ที่ Supabase Dashboard &gt; Settings &gt; Backups) แต่ละไฟล์ตรวจสอบจำนวนแถวทันทีหลัง backup
          ก่อนจะถือว่า &quot;verified&quot;
        </CardDescription>
      </CardHeader>
      <CardContent>
        {backups === null ? (
          <Skeleton className="h-32" />
        ) : backups.length === 0 ? (
          <p className="text-sm text-secondary/50">ยังไม่มี backup (จะเริ่มรันอัตโนมัติตามรอบถัดไป)</p>
        ) : (
          <div className="space-y-2">
            {latest && !latest.verified ? (
              <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Backup ล่าสุดตรวจสอบแล้วไม่ตรงกับข้อมูลจริง: {latest.verify_detail}</span>
              </div>
            ) : null}
            {backups.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/10 p-3">
                <div className="flex items-center gap-2">
                  {b.status === "error" ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                  ) : b.verified ? (
                    <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
                  )}
                  <div>
                    <p className="text-sm text-secondary">{new Date(b.taken_at).toLocaleString("th-TH")}</p>
                    <p className="text-xs text-secondary/50">
                      {b.status === "error"
                        ? `ล้มเหลว: ${b.error_detail}`
                        : Object.entries(b.row_counts)
                            .map(([table, count]) => `${table}: ${count}`)
                            .join(" · ")}
                    </p>
                  </div>
                </div>
                {b.status === "success" ? (
                  <Button variant="outline" size="sm" onClick={() => handleDownload(b.id, b.taken_at)} disabled={downloadingId === b.id}>
                    <Download className="h-3.5 w-3.5" />
                    {downloadingId === b.id ? "กำลังโหลด…" : "ดาวน์โหลด"}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SystemHealthView() {
  const [events, setEvents] = useState<Tables<"system_events">[] | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.systemEvents.listRecent(100).then(setEvents);
  }, []);

  const errorCount = events?.filter((e) => e.severity === "error").length ?? 0;
  const warningCount = events?.filter((e) => e.severity === "warning").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Activity className="h-8 w-8 text-primary-accent" />
            <div>
              <p className="text-2xl font-semibold text-secondary">{events?.length ?? "—"}</p>
              <p className="text-xs text-secondary/50">เหตุการณ์ล่าสุด (100 รายการ)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-8 w-8 text-danger" />
            <div>
              <p className="text-2xl font-semibold text-secondary">{errorCount}</p>
              <p className="text-xs text-secondary/50">Error</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <div>
              <p className="text-2xl font-semibold text-secondary">{warningCount}</p>
              <p className="text-xs text-secondary/50">Warning (เช่น rate limit)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ประวัติเหตุการณ์ระบบ</CardTitle>
          <CardDescription>
            ระบบตรวจสอบอัตโนมัติทุก 15 นาที และแจ้งเตือนผ่าน LINE + notification เมื่อพบ error เกิน 3 ครั้งในช่วง 15 นาที
            (ตั้งค่า LINE User ID เจ้าของร้านได้ที่หน้า Settings)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events === null ? (
            <Skeleton className="h-64" />
          ) : events.length === 0 ? (
            <p className="text-sm text-secondary/50">ยังไม่มีเหตุการณ์บันทึกไว้</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const Icon = SEVERITY_ICON[event.severity];
                return (
                  <div key={event.id} className="flex items-start gap-3 rounded-xl border border-line/10 p-3">
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        event.severity === "error" ? "text-danger" : event.severity === "warning" ? "text-warning" : "text-secondary/50"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant={SEVERITY_VARIANT[event.severity]}>{event.source}</Badge>
                        <span className="text-xs text-secondary/50">{new Date(event.created_at).toLocaleString("th-TH")}</span>
                      </div>
                      <p className="break-words text-sm text-secondary">{event.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <BackupHistory />
    </div>
  );
}
