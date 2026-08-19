"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarHeart, Plus, Send, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Event = Tables<"events">;
type Participant = Tables<"event_participants"> & { customerName: string | null };

const TYPE_LABELS: Record<string, string> = { recital: "คอนเสิร์ตนักเรียน", exam: "สอบ", competition: "แข่ง", workshop: "เวิร์กช็อป", other: "อื่นๆ" };
const STATUS_VARIANT: Record<string, "success" | "warning" | "outline"> = { open: "success", draft: "warning", closed: "outline" };

export function EventsManager() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState<string | null>(null);
  const [participantsByEvent, setParticipantsByEvent] = useState<Record<string, Participant[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [customerOptions, setCustomerOptions] = useState<Tables<"customers">[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [newPiece, setNewPiece] = useState("");

  // create form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<Tables<"events">["event_type"]>("recital");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const reload = useCallback(() => {
    createRepositories(createClient())
      .aiOps.listEvents()
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function loadParticipants(eventId: string) {
    const rows = await createRepositories(createClient()).aiOps.listParticipants(eventId);
    setParticipantsByEvent((prev) => ({ ...prev, [eventId]: rows }));
  }

  function toggleExpand(eventId: string) {
    setExpanded((prev) => (prev === eventId ? null : eventId));
    if (expanded !== eventId) loadParticipants(eventId).catch(() => {});
  }

  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    if (q.trim().length < 1) {
      setCustomerOptions([]);
      return;
    }
    const rows = await createRepositories(createClient()).customers.search(q, 8);
    setCustomerOptions(rows);
  }

  async function createEvent() {
    if (!title.trim() || !startTime) return;
    setBusyId("new");
    setError(null);
    try {
      await createRepositories(createClient()).aiOps.createEvent({
        title: title.trim(),
        event_type: eventType,
        start_time: new Date(startTime).toISOString(),
        location: location.trim() || null,
        description: description.trim() || null,
        status: "open",
      });
      setTitle("");
      setStartTime("");
      setLocation("");
      setDescription("");
      setShowForm(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function addParticipant(eventId: string, customerId: string) {
    setBusyId(`${eventId}:add`);
    try {
      await createRepositories(createClient()).aiOps.addParticipant(eventId, customerId, newPiece.trim() || undefined);
      setNewPiece("");
      setCustomerQuery("");
      setCustomerOptions([]);
      await loadParticipants(eventId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function removeParticipant(eventId: string, participantId: string) {
    try {
      await createRepositories(createClient()).aiOps.removeParticipant(participantId);
      await loadParticipants(eventId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  async function notify(event: Event) {
    setNotifyBusy(event.id);
    setError(null);
    try {
      const { error: fnError } = await createClient().functions.invoke("event-notify", { body: { eventId: event.id } });
      if (fnError) {
        setError(await describeFunctionError(fnError));
        return;
      }
      await loadParticipants(event.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งคำเชิญไม่สำเร็จ");
    } finally {
      setNotifyBusy(null);
    }
  }

  async function deleteEvent(event: Event) {
    if (!window.confirm(`ลบกิจกรรม ${event.title}?`)) return;
    try {
      await createRepositories(createClient()).aiOps.deleteEvent(event.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-secondary">งานแสดง / กิจกรรม</h1>
          <p className="text-sm text-secondary/50">คอนเสิร์ตนักเรียน สอบ แข่งขัน เวิร์กช็อป — เพิ่มนักเรียน + ส่งคำเชิญ LINE อัตโนมัติ</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          สร้างกิจกรรม
        </Button>
      </div>

      {error ? <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ชื่อกิจกรรม เช่น คอนเสิร์ตนักเรียนครั้งที่ 3"
              className="w-full rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none focus:border-primary-accent"
            />
            <div className="flex flex-wrap gap-3">
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as Tables<"events">["event_type"])}
                className="rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none"
              />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="สถานที่"
                className="rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none focus:border-primary-accent"
              />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="รายละเอียด (จะไปในข้อความเชิญ)"
              rows={2}
              className="w-full rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none focus:border-primary-accent"
            />
            <Button size="sm" onClick={createEvent} disabled={busyId === "new" || !title.trim() || !startTime}>
              สร้าง
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {events === null ? (
        <Skeleton className="h-48" />
      ) : events.length === 0 ? (
        <EmptyState icon={CalendarHeart} title="ยังไม่มีกิจกรรม" description="สร้างคอนเสิร์ตหรือกิจกรรมแรกเพื่อเชิญนักเรียน" />
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const participants = participantsByEvent[event.id] ?? [];
            return (
              <Card key={event.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-secondary">{event.title}</p>
                        <Badge>{TYPE_LABELS[event.event_type] ?? event.event_type}</Badge>
                        <Badge variant={STATUS_VARIANT[event.status] ?? "outline"}>{event.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-secondary/70">
                        {new Date(event.start_time).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" })}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                      {event.description ? <p className="mt-1 text-sm text-secondary/50">{event.description}</p> : null}
                      {participants.length > 0 ? (
                        <p className="mt-1 text-xs text-secondary/40">{participants.length} คน · {participants.filter((p) => p.status === "confirmed").length} คนยืนยันแล้ว</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button size="sm" onClick={() => notify(event)} disabled={notifyBusy === event.id}>
                        <Send className="h-4 w-4" />
                        ส่งคำเชิญ LINE
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleExpand(event.id)}>
                        <UserPlus className="h-4 w-4" />
                        จัดการนักเรียน
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteEvent(event)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>

                  {expanded === event.id ? (
                    <div className="mt-4 space-y-3 border-t border-line/10 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={customerQuery}
                          onChange={(e) => searchCustomers(e.target.value)}
                          placeholder="ค้นหานักเรียน..."
                          className="w-56 rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none focus:border-primary-accent"
                        />
                        <input
                          value={newPiece}
                          onChange={(e) => setNewPiece(e.target.value)}
                          placeholder="เพลงที่จะเล่น (ไม่บังคับ)"
                          className="w-56 rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none focus:border-primary-accent"
                        />
                        {customerOptions.length > 0 ? (
                          <select
                            onChange={(e) => {
                              if (e.target.value) addParticipant(event.id, e.target.value);
                            }}
                            value=""
                            className="rounded-lg border border-line/20 bg-background px-3 py-2 text-sm text-secondary outline-none"
                          >
                            <option value="">เลือกนักเรียน...</option>
                            {customerOptions.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                      {participants.length === 0 ? (
                        <p className="text-sm text-secondary/50">ยังไม่มีนักเรียนในงานนี้</p>
                      ) : (
                        participants.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
                            <div>
                              <p className="text-sm text-secondary">{p.customerName ?? "นักเรียน"}</p>
                              {p.piece ? <p className="text-xs text-secondary/50">เพลง: {p.piece}</p> : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={p.status === "confirmed" ? "success" : p.status === "declined" ? "danger" : "outline"}>{p.status}</Badge>
                              <Button size="sm" variant="ghost" onClick={() => removeParticipant(event.id, p.id)}>
                                <Trash2 className="h-4 w-4 text-danger" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
