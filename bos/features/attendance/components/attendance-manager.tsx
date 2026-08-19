"use client";

import { useEffect, useMemo, useState } from "react";
import { UserCheck, Pencil, Trash2, Pause, Play, Plus, X, Clock, Calendar } from "lucide-react";
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

/* ── Grouped student view ── */

interface StudentGroup {
  customerId: string;
  customerName: string;
  slots: AttendanceScheduleWithCustomer[];
}

/* ── Inline Slot Editor ── */

function SlotEditor({
  customerId,
  existingSlot,
  onSave,
  onCancel,
  submitting,
}: {
  customerId: string;
  existingSlot?: AttendanceScheduleWithCustomer;
  onSave: (input: { customerId: string; dayOfWeek: number; timeOfDay: string }, editId?: string) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [dayOfWeek, setDayOfWeek] = useState(String(existingSlot?.day_of_week ?? 1));
  const [timeOfDay, setTimeOfDay] = useState(existingSlot?.time_of_day.slice(0, 5) ?? "16:00");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSave(
        { customerId, dayOfWeek: Number(dayOfWeek), timeOfDay },
        existingSlot?.id
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex-1">
        <label className="text-[10px] text-secondary/50">วัน</label>
        <select
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(e.target.value)}
          className="h-9 w-full rounded-lg border border-line/10 bg-card px-2 text-xs text-secondary"
        >
          {DAY_LABELS.map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label className="text-[10px] text-secondary/50">เวลา</label>
        <Input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="h-9 text-xs" />
      </div>
      <Button type="submit" size="sm" disabled={submitting} className="h-9">
        {submitting ? "…" : "บันทึก"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-9">
        ยกเลิก
      </Button>
      {error && <p className="absolute -bottom-5 left-0 text-[10px] text-danger">{error}</p>}
    </form>
  );
}

/* ── Slot Display ── */

function SlotDisplay({
  slot,
  onEdit,
  onDelete,
  onToggle,
}: {
  slot: AttendanceScheduleWithCustomer;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border border-line/10 bg-line/5 px-3 py-2", !slot.active && "opacity-50")}>
      <Calendar className="h-3.5 w-3.5 shrink-0 text-primary-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-secondary">
          ทุกวัน{DAY_LABELS[slot.day_of_week]}
        </p>
        <p className="text-[10px] text-secondary/50">
          เวลา {slot.time_of_day.slice(0, 5)} น.
          {slot.next_occurrence_at && (
            <> · ถัดไป: {new Date(slot.next_occurrence_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7">
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-7 w-7">
          {slot.active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7">
          <Trash2 className="h-3 w-3 text-danger" />
        </Button>
      </div>
    </div>
  );
}

/* ── Student Card ── */

function StudentCard({
  group,
  onReload,
}: {
  group: StudentGroup;
  onReload: () => void;
}) {
  const [addingSlot, setAddingSlot] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const repos = createRepositories(createClient());

  async function handleSave(input: { customerId: string; dayOfWeek: number; timeOfDay: string }, editId?: string) {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const r = createRepositories(supabase);
      const { data: userData } = await supabase.auth.getUser();

      if (editId) {
        await r.attendance.update(editId, input);
      } else {
        await r.attendance.create(input, userData.user?.id ?? null);
      }
      setAddingSlot(false);
      setEditingSlotId(null);
      onReload();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await repos.attendance.remove(id);
    onReload();
  }

  async function handleToggle(slot: AttendanceScheduleWithCustomer) {
    await repos.attendance.toggleActive(slot.id, !slot.active);
    onReload();
  }

  const activeCount = group.slots.filter((s) => s.active).length;
  const hasTwoSlots = group.slots.length >= 2;

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        {/* Student name header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="font-medium text-secondary">{group.customerName}</p>
            <Badge variant={activeCount > 0 ? "success" : "outline"} className="text-[10px]">
              {group.slots.length} คาบ/สัปดาห์
            </Badge>
          </div>
          {!hasTwoSlots && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddingSlot(true)}
              className="h-7 text-[11px] text-primary-accent"
            >
              <Plus className="h-3 w-3" />
              เพิ่มคาบที่ {group.slots.length + 1}
            </Button>
          )}
        </div>

        {/* Time slots */}
        <div className="space-y-2">
          {group.slots.map((slot) =>
            editingSlotId === slot.id ? (
              <SlotEditor
                key={slot.id}
                customerId={group.customerId}
                existingSlot={slot}
                onSave={handleSave}
                onCancel={() => setEditingSlotId(null)}
                submitting={submitting}
              />
            ) : (
              <SlotDisplay
                key={slot.id}
                slot={slot}
                onEdit={() => setEditingSlotId(slot.id)}
                onDelete={() => void handleDelete(slot.id)}
                onToggle={() => void handleToggle(slot)}
              />
            )
          )}
        </div>

        {/* Add new slot inline */}
        {addingSlot && (
          <SlotEditor
            customerId={group.customerId}
            onSave={handleSave}
            onCancel={() => setAddingSlot(false)}
            submitting={submitting}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main Component ── */

export function AttendanceManager() {
  const [schedules, setSchedules] = useState<AttendanceScheduleWithCustomer[] | null>(null);
  const [showGlobalForm, setShowGlobalForm] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formDayOfWeek, setFormDayOfWeek] = useState("1");
  const [formTimeOfDay, setFormTimeOfDay] = useState("16:00");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    const repos = createRepositories(createClient());
    repos.attendance.list().then(setSchedules);
  }

  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (!customerQuery.trim() || formCustomerId) {
      setCustomerResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      createRepositories(createClient()).customers.search(customerQuery.trim(), 5).then(setCustomerResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerQuery, formCustomerId]);

  // Group schedules by customer
  const studentGroups = useMemo<StudentGroup[]>(() => {
    if (!schedules) return [];
    const map = new Map<string, StudentGroup>();
    for (const s of schedules) {
      let group = map.get(s.customer_id);
      if (!group) {
        group = { customerId: s.customer_id, customerName: s.customerName, slots: [] };
        map.set(s.customer_id, group);
      }
      group.slots.push(s);
    }
    return Array.from(map.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [schedules]);

  async function handleGlobalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formCustomerId) {
      setError("กรุณาเลือกน้องที่จะเรียน");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const repos = createRepositories(supabase);
      const { data: userData } = await supabase.auth.getUser();
      await repos.attendance.create(
        { customerId: formCustomerId, dayOfWeek: Number(formDayOfWeek), timeOfDay: formTimeOfDay },
        userData.user?.id ?? null
      );
      setShowGlobalForm(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-secondary">ตารางเรียนรายสัปดาห์</h2>
          <p className="text-xs text-secondary/50">
            แต่ละน้องเรียนสัปดาห์ละ 1-2 ครั้ง ครั้งละ 1 ชั่วโมง — กดปุ่ม ✏️ ในคาบเพื่อแก้ไข กด + เพิ่มคาบที่ 2
          </p>
        </div>
        <Button onClick={() => { setShowGlobalForm(true); setFormCustomerId(""); setFormCustomerName(""); setCustomerQuery(""); }}>
          <Plus className="h-4 w-4" />
          เพิ่มน้องใหม่
        </Button>
      </div>

      {/* Global add form */}
      {showGlobalForm && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>เพิ่มตารางเรียนใหม่</CardTitle>
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowGlobalForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGlobalSubmit} className="space-y-3">
              <div className="relative">
                <Input
                  placeholder="ค้นหาน้อง (ชื่อลูกค้า)"
                  value={formCustomerId ? formCustomerName : customerQuery}
                  onChange={(e) => {
                    setFormCustomerId("");
                    setFormCustomerName("");
                    setCustomerQuery(e.target.value);
                  }}
                  required
                />
                {customerResults.length > 0 && !formCustomerId ? (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-line/10 bg-card shadow-card">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm text-secondary hover:bg-line/5"
                        onClick={() => {
                          setFormCustomerId(c.id);
                          setFormCustomerName(c.name);
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
                    value={formDayOfWeek}
                    onChange={(e) => setFormDayOfWeek(e.target.value)}
                    className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary"
                  >
                    {DAY_LABELS.map((d, i) => (
                      <option key={d} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-secondary/50">เวลา</label>
                  <Input type="time" value={formTimeOfDay} onChange={(e) => setFormTimeOfDay(e.target.value)} />
                </div>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "กำลังบันทึก…" : "เพิ่มตารางเรียน"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Student cards grouped */}
      {schedules === null ? null : studentGroups.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="ยังไม่มีตารางเรียน"
          description="เพิ่มวัน/เวลาเรียนของน้องแต่ละคน ระบบจะเตือนยืนยันการมาเรียนล่วงหน้า 24 ชม. ให้เอง"
        />
      ) : (
        <div className="space-y-3">
          {studentGroups.map((group) => (
            <StudentCard key={group.customerId} group={group} onReload={reload} />
          ))}
        </div>
      )}
    </div>
  );
}
