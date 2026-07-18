"use client";

import { useRef, useState } from "react";
import { Upload, Download, X } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { parseCsvToRecords } from "@/lib/parse-csv";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Database, SalesStatus } from "@/types/database";

const SALES_STATUSES: SalesStatus[] = [
  "new_lead", "contacted", "qualified", "interested", "trial_booked", "trial_completed",
  "negotiating", "waiting_decision", "won", "lost", "renew_pending", "renewed",
];

// Accept a few header spellings so an owner's existing spreadsheet (Thai or
// English column names) usually works without editing it first.
const HEADER_ALIASES: Record<string, string> = {
  name: "name", ชื่อ: "name", "ชื่อนักเรียน": "name",
  phone: "phone", เบอร์: "phone", "เบอร์โทร": "phone", "เบอร์โทรศัพท์": "phone",
  age: "age", อายุ: "age",
  learning_goal: "learning_goal", goal: "learning_goal", เป้าหมาย: "learning_goal",
  budget: "budget", งบประมาณ: "budget",
  experience_level: "experience_level", experience: "experience_level", ประสบการณ์: "experience_level",
  preferred_schedule: "preferred_schedule", schedule: "preferred_schedule", ตาราง: "preferred_schedule",
  practice_frequency: "practice_frequency",
  parent_name: "parent_name", "ชื่อผู้ปกครอง": "parent_name",
  parent_phone: "parent_phone", "เบอร์ผู้ปกครอง": "parent_phone",
  sales_status: "sales_status", status: "sales_status", สถานะ: "sales_status",
  lead_source: "lead_source", source: "lead_source", ช่องทาง: "lead_source",
  notes: "notes", note: "notes", หมายเหตุ: "notes",
};

const TEMPLATE_CSV = "name,phone,age,learning_goal,budget,sales_status,lead_source,notes\n";

type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];

interface ParsedRow {
  data: CustomerInsert;
  error?: string;
}

function toRows(records: Record<string, string>[]): ParsedRow[] {
  return records.map((record) => {
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      const field = HEADER_ALIASES[key];
      if (field && value) mapped[field] = value;
    }

    if (!mapped.name) {
      return { data: { name: "" }, error: "ไม่มีชื่อ (name) — ข้ามแถวนี้" };
    }

    const status = mapped.sales_status?.toLowerCase().replace(/\s+/g, "_") as SalesStatus | undefined;
    const data: CustomerInsert = {
      name: mapped.name,
      phone: mapped.phone || null,
      age: mapped.age ? Number(mapped.age) || null : null,
      learning_goal: mapped.learning_goal || null,
      budget: mapped.budget || null,
      experience_level: mapped.experience_level || null,
      preferred_schedule: mapped.preferred_schedule || null,
      practice_frequency: mapped.practice_frequency || null,
      parent_name: mapped.parent_name || null,
      parent_phone: mapped.parent_phone || null,
      sales_status: status && SALES_STATUSES.includes(status) ? status : "new_lead",
      lead_source: mapped.lead_source || "CSV Import",
      notes: mapped.notes || null,
    };

    return { data };
  });
}

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
