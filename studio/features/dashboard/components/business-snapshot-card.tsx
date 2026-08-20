"use client";

import { useState } from "react";
import { Users2, Clock3, TrendingUp, Pencil } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface BusinessSnapshotCardProps {
  snapshot: Tables<"business_snapshot"> | null;
  onChanged: () => void;
}

interface FormState {
  active_students: string;
  teaching_hours_per_week: string;
  avg_monthly_hours: string;
  sales_policy: string;
  cac: string;
  ltv_min: string;
  ltv_max: string;
  note: string;
}

function toForm(s: Tables<"business_snapshot"> | null): FormState {
  return {
    active_students: s?.active_students?.toString() ?? "",
    teaching_hours_per_week: s?.teaching_hours_per_week?.toString() ?? "",
    avg_monthly_hours: s?.avg_monthly_hours?.toString() ?? "",
    sales_policy: s?.sales_policy ?? "",
    cac: s?.cac?.toString() ?? "",
    ltv_min: s?.ltv_min?.toString() ?? "",
    ltv_max: s?.ltv_max?.toString() ?? "",
    note: s?.note ?? "",
  };
}

export function BusinessSnapshotCard({ snapshot, onChanged }: BusinessSnapshotCardProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(snapshot));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ltvCacMin = snapshot?.cac && snapshot.ltv_min ? snapshot.ltv_min / snapshot.cac : null;
  const ltvCacMax = snapshot?.cac && snapshot.ltv_max ? snapshot.ltv_max / snapshot.cac : null;

  function startEdit() {
    setForm(toForm(snapshot));
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const repos = createRepositories(createClient());
      await repos.businessSnapshot.upsert({
        active_students: form.active_students ? Number(form.active_students) : null,
        teaching_hours_per_week: form.teaching_hours_per_week ? Number(form.teaching_hours_per_week) : null,
        avg_monthly_hours: form.avg_monthly_hours ? Number(form.avg_monthly_hours) : null,
        sales_policy: form.sales_policy || null,
        cac: form.cac ? Number(form.cac) : null,
        ltv_min: form.ltv_min ? Number(form.ltv_min) : null,
        ltv_max: form.ltv_max ? Number(form.ltv_max) : null,
        note: form.note || null,
      });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>สถานะธุรกิจปัจจุบัน</CardTitle>
          <CardDescription>แก้ไขตัวเลขสรุปธุรกิจ — อัปเดตเองเป็นระยะตามที่คำนวณได้</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="นักเรียน Active (คน)">
              <Input type="number" value={form.active_students} onChange={(e) => setForm({ ...form, active_students: e.target.value })} />
            </Field>
            <Field label="ชั่วโมงสอน/สัปดาห์">
              <Input type="number" step="0.1" value={form.teaching_hours_per_week} onChange={(e) => setForm({ ...form, teaching_hours_per_week: e.target.value })} />
            </Field>
            <Field label="ชั่วโมงสอนเฉลี่ย/เดือน">
              <Input type="number" step="0.1" value={form.avg_monthly_hours} onChange={(e) => setForm({ ...form, avg_monthly_hours: e.target.value })} />
            </Field>
            <Field label="CAC (บาท/ลูกค้า)">
              <Input type="number" step="0.01" value={form.cac} onChange={(e) => setForm({ ...form, cac: e.target.value })} />
            </Field>
            <Field label="LTV ต่ำสุด (บาท)">
              <Input type="number" step="0.01" value={form.ltv_min} onChange={(e) => setForm({ ...form, ltv_min: e.target.value })} />
            </Field>
            <Field label="LTV สูงสุด (บาท)">
              <Input type="number" step="0.01" value={form.ltv_max} onChange={(e) => setForm({ ...form, ltv_max: e.target.value })} />
            </Field>
          </div>
          <Field label="นโยบายขายปัจจุบัน">
            <Input value={form.sales_policy} onChange={(e) => setForm({ ...form, sales_policy: e.target.value })} />
          </Field>
          <Field label="หมายเหตุ">
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              ยกเลิก
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>สถานะธุรกิจปัจจุบัน</CardTitle>
          <CardDescription>
            {snapshot?.updated_at ? `อัปเดตล่าสุด ${new Date(snapshot.updated_at).toLocaleDateString("th-TH")}` : "ยังไม่มีข้อมูล"}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={startEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat icon={Users2} label="นักเรียน Active" value={snapshot?.active_students != null ? `${snapshot.active_students} คน` : "—"} />
          <MiniStat
            icon={Clock3}
            label="ชั่วโมงสอน/สัปดาห์"
            value={snapshot?.teaching_hours_per_week != null ? `${snapshot.teaching_hours_per_week} ชม.` : "—"}
          />
          <MiniStat
            icon={Clock3}
            label="เฉลี่ย/เดือน"
            value={snapshot?.avg_monthly_hours != null ? `~${snapshot.avg_monthly_hours} ชม.` : "—"}
          />
          <MiniStat
            icon={TrendingUp}
            label="LTV/CAC"
            value={ltvCacMin != null && ltvCacMax != null ? `${ltvCacMin.toFixed(1)}–${ltvCacMax.toFixed(1)} เท่า` : "—"}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-secondary/50">CAC โดยประมาณ</p>
            <p className="font-medium text-secondary">{snapshot?.cac != null ? `${formatCurrency(snapshot.cac)}/ลูกค้า` : "—"}</p>
          </div>
          <div>
            <p className="text-secondary/50">LTV ขั้นต่ำ–สูงสุด</p>
            <p className="font-medium text-secondary">
              {snapshot?.ltv_min != null && snapshot?.ltv_max != null
                ? `${formatCurrency(snapshot.ltv_min)} – ${formatCurrency(snapshot.ltv_max)}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-secondary/50">นโยบายขายปัจจุบัน</p>
            <p className="font-medium text-secondary">{snapshot?.sales_policy ?? "—"}</p>
          </div>
        </div>

        {snapshot?.note ? <p className="text-xs text-secondary/50">{snapshot.note}</p> : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-secondary/60">{label}</span>
      {children}
    </label>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line/10 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-accent">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-secondary/50">{label}</p>
        <p className="truncate text-sm font-semibold text-secondary">{value}</p>
      </div>
    </div>
  );
}
