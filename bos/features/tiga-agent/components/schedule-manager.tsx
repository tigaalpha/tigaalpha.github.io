"use client";

import { useEffect, useState } from "react";
import { Bot, Pencil, Trash2, Pause, Play, Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

const RECURRENCE_OPTIONS: { value: Tables<"agent_schedules">["recurrence_type"]; label: string }[] = [
  { value: "once", label: "ครั้งเดียว (วันที่+เวลาที่กำหนด)" },
  { value: "daily", label: "ทุกวัน" },
  { value: "every_n_days", label: "ทุก N วัน" },
  { value: "weekly", label: "ทุกสัปดาห์ (เลือกวัน)" },
  { value: "monthly", label: "ทุกเดือน (เลือกวันที่)" },
];

const DAY_LABELS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

interface FormState {
  label: string;
  instruction: string;
  recurrenceType: Tables<"agent_schedules">["recurrence_type"];
  intervalDays: string;
  dayOfWeek: string;
  dayOfMonth: string;
  timeOfDay: string;
  runOnceAt: string;
}

const EMPTY_FORM: FormState = {
  label: "",
  instruction: "",
  recurrenceType: "daily",
  intervalDays: "3",
  dayOfWeek: "1",
  dayOfMonth: "1",
  timeOfDay: "09:00",
  runOnceAt: "",
};

function describeRecurrence(row: Tables<"agent_schedules">): string {
  const time = row.time_of_day.slice(0, 5);
  switch (row.recurrence_type) {
    case "once":
      return row.run_once_at ? `ครั้งเดียว: ${new Date(row.run_once_at).toLocaleString("th-TH")}` : "ครั้งเดียว";
    case "daily":
      return `ทุกวัน เวลา ${time}`;
    case "every_n_days":
      return `ทุก ${row.interval_days ?? 1} วัน เวลา ${time}`;
    case "weekly":
      return `ทุกสัปดาห์วัน${DAY_LABELS[row.day_of_week ?? 1]} เวลา ${time}`;
    case "monthly":
      return `ทุกเดือน วันที่ ${row.day_of_month ?? 1} เวลา ${time}`;
    default:
      return "";
  }
}

function StatusBadge({ row }: { row: Tables<"agent_schedules"> }) {
  if (!row.active) return <Badge variant="outline">พักไว้</Badge>;
  if (!row.last_run_status) return <Badge variant="outline">ยังไม่เคยรัน</Badge>;
  return <Badge variant={row.last_run_status === "success" ? "success" : "danger"}>{row.last_run_status === "success" ? "สำเร็จล่าสุด" : "ผิดพลาดล่าสุด"}</Badge>;
}

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<Tables<"agent_schedules">[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function reload() {
    const repos = createRepositories(createClient());
    repos.agentSchedules.listSchedules().then(setSchedules);
  }

  useEffect(() => {
    reload();
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function startEdit(row: Tables<"agent_schedules">) {
    setEditingId(row.id);
    setForm({
      label: row.label,
      instruction: row.instruction,
      recurrenceType: row.recurrence_type,
      intervalDays: String(row.interval_days ?? 3),
      dayOfWeek: String(row.day_of_week ?? 1),
      dayOfMonth: String(row.day_of_month ?? 1),
      timeOfDay: row.time_of_day.slice(0, 5),
      runOnceAt: row.run_once_at ? row.run_once_at.slice(0, 16) : "",
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.recurrenceType === "once" && !form.runOnceAt) {
      setError("กรุณาเลือกวันที่และเวลา");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const repos = createRepositories(supabase);
      const { data: userData } = await supabase.auth.getUser();

      const input = {
        label: form.label,
        instruction: form.instruction,
        recurrenceType: form.recurrenceType,
        intervalDays: form.recurrenceType === "every_n_days" ? Number(form.intervalDays) : null,
        dayOfWeek: form.recurrenceType === "weekly" ? Number(form.dayOfWeek) : null,
        dayOfMonth: form.recurrenceType === "monthly" ? Number(form.dayOfMonth) : null,
        timeOfDay: form.recurrenceType === "once" ? new Date(form.runOnceAt).toTimeString().slice(0, 5) : form.timeOfDay,
        runOnceAt: form.recurrenceType === "once" ? new Date(form.runOnceAt).toISOString() : null,
      };

      if (editingId) {
        await repos.agentSchedules.updateSchedule(editingId, input);
      } else {
        await repos.agentSchedules.createSchedule(input, userData.user?.id ?? null);
      }

      setShowForm(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(row: Tables<"agent_schedules">) {
    const repos = createRepositories(createClient());
    await repos.agentSchedules.toggleActive(row.id, !row.active);
    reload();
  }

  async function handleDelete(id: string) {
    const repos = createRepositories(createClient());
    await repos.agentSchedules.deleteSchedule(id);
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-secondary">งานที่ตั้งเวลาไว้</h2>
          <p className="text-xs text-secondary/50">TIGA AI Agent จะรันคำสั่งเหล่านี้ให้เองอัตโนมัติตามเวลาที่ตั้งไว้ (เช็คทุก 5 นาที)</p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" />
          สร้างกำหนดการใหม่
        </Button>
      </div>

      {showForm ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{editingId ? "แก้ไขกำหนดการ" : "สร้างกำหนดการใหม่"}</CardTitle>
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input placeholder="ชื่อกำหนดการ เช่น สรุปยอดขายทุกวันจันทร์" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
              <Textarea
                placeholder='คำสั่งที่จะให้ TIGA AI Agent ทำทุกรอบ เช่น "สรุปยอดขายอาทิตย์ที่แล้วและแจ้งเตือนฉัน"'
                value={form.instruction}
                onChange={(e) => setForm({ ...form, instruction: e.target.value })}
                className="min-h-24"
                required
              />
              <select
                value={form.recurrenceType}
                onChange={(e) => setForm({ ...form, recurrenceType: e.target.value as FormState["recurrenceType"] })}
                className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {form.recurrenceType === "once" ? (
                <Input type="datetime-local" value={form.runOnceAt} onChange={(e) => setForm({ ...form, runOnceAt: e.target.value })} required />
              ) : (
                <div className="flex items-end gap-2">
                  {form.recurrenceType === "every_n_days" ? (
                    <div className="flex-1">
                      <label className="text-xs text-secondary/50">ทุกกี่วัน</label>
                      <Input type="number" min={1} value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: e.target.value })} />
                    </div>
                  ) : null}
                  {form.recurrenceType === "weekly" ? (
                    <div className="flex-1">
                      <label className="text-xs text-secondary/50">วัน</label>
                      <select
                        value={form.dayOfWeek}
                        onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
                        className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary"
                      >
                        {DAY_LABELS.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {form.recurrenceType === "monthly" ? (
                    <div className="flex-1">
                      <label className="text-xs text-secondary/50">วันที่ (1-31)</label>
                      <Input type="number" min={1} max={31} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} />
                    </div>
                  ) : null}
                  <div className="flex-1">
                    <label className="text-xs text-secondary/50">เวลา</label>
                    <Input type="time" value={form.timeOfDay} onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })} />
                  </div>
                </div>
              )}

              {error ? <p className="text-xs text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "สร้างกำหนดการ"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {schedules === null ? null : schedules.length === 0 ? (
        <EmptyState icon={Bot} title="ยังไม่มีกำหนดการ" description="สร้างกำหนดการแรก ให้ TIGA AI Agent ทำงานอัตโนมัติตามเวลาที่ต้องการ" />
      ) : (
        <div className="space-y-3">
          {schedules.map((row) => (
            <Card key={row.id} className={cn(!row.active && "opacity-60")}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-secondary">{row.label}</p>
                    <p className="text-xs text-secondary/50">{describeRecurrence(row)}</p>
                  </div>
                  <StatusBadge row={row} />
                </div>
                <p className="truncate text-sm text-secondary/70">&quot;{row.instruction}&quot;</p>
                <p className="text-xs text-secondary/40">
                  รอบถัดไป: {row.active ? new Date(row.next_run_at).toLocaleString("th-TH") : "—"}
                  {row.last_run_at ? ` · รันล่าสุด ${new Date(row.last_run_at).toLocaleString("th-TH")}` : ""}
                </p>
                {row.last_run_result ? (
                  <div>
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 rounded-lg bg-line/5 px-3 py-2 text-left text-xs text-secondary/60 hover:bg-line/10 transition-colors"
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    >
                      {expandedId === row.id ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{expandedId === row.id ? "ซ่อนผลลัพธ์" : row.last_run_result}</span>
                    </button>
                    {expandedId === row.id ? (
                      <div className="mt-2 rounded-lg border border-line/10 bg-card p-4 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-secondary/50 mb-1">คำสั่งที่ให้ AI ทำ</p>
                          <p className="text-sm text-secondary/70">{row.instruction}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-secondary/50 mb-1">ผลลัพธ์จาก AI</p>
                          <div className="whitespace-pre-wrap text-sm text-secondary/80 leading-relaxed">{row.last_run_result}</div>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary/40">
                          <span>สถานะ: <span className={row.last_run_status === "success" ? "text-success" : "text-danger"}>{row.last_run_status === "success" ? "สำเร็จ" : "ผิดพลาด"}</span></span>
                          {row.last_run_at && <span>รันล่าสุด: {new Date(row.last_run_at).toLocaleString("th-TH")}</span>}
                          <span>รอบถัดไป: {new Date(row.next_run_at).toLocaleString("th-TH")}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex items-center gap-1 pt-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(row)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void handleToggle(row)}>
                    {row.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void handleDelete(row.id)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
