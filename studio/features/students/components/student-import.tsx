"use client";

import { useRef, useState } from "react";
import { Upload, Download, X } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { parseCsvToRecords } from "@/lib/parse-csv";
import { toRows, type ParsedRow } from "@/lib/students-import";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TEMPLATE_CSV = "name,phone,age,learning_goal,budget,sales_status,lead_source,notes\n";

interface StudentImportProps {
  onImported: () => void;
  onClose: () => void;
}

export function StudentImport({ onImported, onClose }: StudentImportProps) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const records = parseCsvToRecords(text);
      if (records.length === 0) throw new Error("ไม่พบข้อมูลในไฟล์ — ตรวจสอบว่ามีแถวหัวตาราง (header) และข้อมูลอย่างน้อย 1 แถว");
      setRows(toRows(records));
    } catch (err) {
      setError(err instanceof Error ? err.message : "อ่านไฟล์ไม่สำเร็จ");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tiga-students-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!rows) return;
    const valid = rows.filter((r) => !r.error);
    setImporting(true);
    setError(null);

    const repos = createRepositories(createClient());
    let ok = 0;
    let failed = 0;
    for (const row of valid) {
      try {
        await repos.customers.create(row.data);
        ok++;
      } catch {
        failed++;
      }
    }

    setImporting(false);
    setResult({ ok, failed });
    setRows(null);
    if (ok > 0) onImported();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>นำเข้าข้อมูลนักเรียน (CSV)</CardTitle>
          <CardDescription>
            อัปโหลดไฟล์ .csv จากสเปรดชีตนักเรียนเดิมของคุณ — ต้องมีคอลัมน์ name เป็นอย่างน้อย
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelected} />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            เลือกไฟล์ CSV
          </Button>
          <Button type="button" variant="ghost" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            ดาวน์โหลดเทมเพลต
          </Button>
        </div>

        {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

        {rows ? (
          <div className="space-y-3">
            <div className="max-h-72 overflow-auto rounded-xl border border-line/5">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-line/5 text-xs text-secondary/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">ชื่อ</th>
                    <th className="px-3 py-2 font-medium">เบอร์โทร</th>
                    <th className="px-3 py-2 font-medium">สถานะ</th>
                    <th className="px-3 py-2 font-medium">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {rows.map((row, i) => (
                    <tr key={i} className={row.error ? "bg-danger/5" : undefined}>
                      <td className="px-3 py-2">{row.data.name || "—"}</td>
                      <td className="px-3 py-2 text-secondary/70">{row.data.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-secondary/70">{row.data.sales_status ?? "—"}</td>
                      <td className="px-3 py-2 text-danger">{row.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-secondary/50">
              พบ {rows.length} แถว — จะนำเข้า {rows.filter((r) => !r.error).length} แถวที่ถูกต้อง
            </p>
            <Button onClick={() => void handleImport()} disabled={importing || rows.every((r) => r.error)}>
              {importing ? "กำลังนำเข้า…" : `นำเข้า ${rows.filter((r) => !r.error).length} รายการ`}
            </Button>
          </div>
        ) : null}

        {result ? (
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            นำเข้าสำเร็จ {result.ok} รายการ{result.failed > 0 ? ` (ล้มเหลว ${result.failed} รายการ)` : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
