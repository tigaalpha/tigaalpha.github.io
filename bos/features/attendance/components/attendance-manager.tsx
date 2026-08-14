"use client";

import { useEffect, useState } from "react";
import { UserCheck, Pencil, Trash2, Pause, Play, Plus, X } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { AttendanceScheduleWithCustomer } from "@/services/repositories/attendance.repository";
import type { Tables } from "@/types/database";

type CustomerRow = Tables<"customers">;

const DAY_LABELS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

interface FormState {
  customerId: string;
  customerName: string;
  dayOfWeek: string;
  timeOfDay: string;
}

const EMPTY_FORM: FormState = { customerId: "", customerName: "", dayOfWeek: "1", timeOfDay: "16:00" };

export function AttendanceManager() {
  const [schedules, setSchedules] = useState<AttendanceScheduleWithCustomer[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    const repos = createRepositories(createClient());
    repos.attendance.list().then(setSchedules);
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!customerQuery.trim() || form.customerId) {
      setCustomerResults([]);
      return;
    }
    const repos = createRepositories(createClient());
    const timeout = setTimeout(() => {
      repos.customers.search(customerQuery.trim(), 5).then(setCustomerResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerQuery, form.customerId]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCustomerQuery("");
    setError(null);
    setShowForm(true);
  }

  function startEdit(row: AttendanceScheduleWithCustomer) {
    setEditingId(row.id);
    setForm({ customerId: row.customer_id, customerName: row.customerName, dayOfWeek: String(row.day_of_week), timeOfDay: row.time_of_day.slice(0, 5) });
    setCustomerQuery("");
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId) {
      setError("กรุณาเลือกน้องที่จะเรียน");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const repos = createRepositories(supabase);
      const { data: userData } = await supabase.auth.getUser();

      const input = { customerId: form.customerId, dayOfWeek: Number(form.dayOfWeek), timeOfDay: form.timeOfDay };

      if (editingId) {
        await repos.attendance.update(editingId, input);
      } else {
        await repos.attendance.create(input, userData.user?.id ?? null);
      }

      setShowForm(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(row: AttendanceScheduleWithCustomer) {
    const repos = createRepositories(createClient());
    await repos.attendance.toggleActive(row.id, !row.active);
    reload();
  }

  async function handleDelete(id: string) {
    const repos = createRepositories(createClient());
    await repos.attendance.remove(id);
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-secondary">ตารางเรียนรายสัปดาห์</h2>
          <p className="text-xs text-secondary/50">
            เพิ่มวัน/เวลาเรียนประจำของน้องแต่ละคน (1 แถว = เรียน 1 ครั้ง/สัปดาห์ — ถ้าเรียน 2 ครั้ง/สัปดาห์ ให้เพิ่ม 2 แถว) ระบบจะส่งข้อความยืนยันการมาเรียนให้ทาง LINE
            อัตโนมัติล่วงหน้า 24 ชั่วโมงก่อนเวลาเรียนจริงทุกครั้ง
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" />
          เพิ่มตารางเรียน
        </Button>
      </div>

      {showForm ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{editingId ? "แก้ไขตารางเรียน" : "เพิ่มตารางเรียนใหม่"}</CardTitle>
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Input
                  placeholder="ค้นหาน้อง (ชื่อลูกค้า)"
                  value={form.customerId ? form.customerName : customerQuery}
                  onChange={(e) => {
                    setForm({ ...form, customerId: "", customerName: "" });
                    setCustomerQuery(e.target.value);
                  }}
                  required
                />
                {customerResults.length > 0 && !form.customerId ? (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-line/10 bg-card shadow-card">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm text-secondary hover:bg-line/5"
                        onClick={() => {
                          setForm({ ...form, customerId: c.id, customerName: c.name });
                          setCustomerResults([]);
                        }}
                      >
                        {c.name} {c.phone ? `— ${c.phone}` : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-end gap-2">
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
                <div className="flex-1">
                  <label className="text-xs text-secondary/50">เวลา</label>
                  <Input type="time" value={form.timeOfDay} onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })} />
                </div>
              </div>

              {error ? <p className="text-xs text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "เพิ่มตารางเรียน"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {schedules === null ? null : schedules.length === 0 ? (
        <EmptyState icon={UserCheck} title="ยังไม่มีตารางเรียน" description="เพิ่มวัน/เวลาเรียนของน้องแต่ละคน ระบบจะเตือนยืนยันการมาเรียนล่วงหน้า 24 ชม. ให้เอง" />
      ) : (
        <div className="space-y-3">
          {schedules.map((row) => (
            <Card key={row.id} className={cn(!row.active && "opacity-60")}>
              <CardContent className="flex items-start justify-between gap-3 pt-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-secondary">{row.customerName}</p>
                    {!row.active ? <Badge variant="outline">พักไว้</Badge> : null}
                  </div>
                  <p className="text-xs text-secondary/50">
                    ทุกวัน{DAY_LABELS[row.day_of_week]} เวลา {row.time_of_day.slice(0, 5)} น.
                  </p>
                  <p className="text-xs text-secondary/40">
                    เรียนครั้งถัดไป: {row.active ? new Date(row.next_occurrence_at).toLocaleString("th-TH") : "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
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
