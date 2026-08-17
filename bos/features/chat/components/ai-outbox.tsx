"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, X, RefreshCw, Inbox as InboxIcon, Loader2 } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

type OutboxRow = Tables<"ai_outbox"> & {
  customers: { name: string } | null;
};

const FEATURE_LABELS: Record<string, string> = {
  outbound_nurture: "AI ทักลูกค้า",
  lesson_reminder: "เตือนคาบเรียน",
  broadcast: "Broadcast",
  customer_memory: "สรุปความจำ",
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: "รอตรวจ",
  sent: "ส่งแล้ว",
  rejected: "ปฏิเสธ",
  failed: "ล้มเหลว",
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function AiOutbox() {
  const [pending, setPending] = useState<OutboxRow[] | null>(null);
  const [history, setHistory] = useState<OutboxRow[] | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function load() {
    const supabase = createClient();
    supabase
      .from("ai_outbox")
      .select("*, customers(name)")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setPending((data ?? []) as unknown as OutboxRow[]));
    supabase
      .from("ai_outbox")
      .select("*, customers(name)")
      .in("status", ["sent", "rejected", "failed"])
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory((data ?? []) as unknown as OutboxRow[]));
  }

  useEffect(() => {
    load();
  }, []);

  async function act(outboxId: string, action: "approve" | "reject" | "edit", extra?: { message?: string; note?: string }) {
    setActingId(outboxId);
    setError(null);
    setBanner(null);
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke("chat-review", {
        body: { outboxId, action, ...extra },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setBanner({ type: "success", text: action === "approve" ? "ส่งให้ลูกค้าแล้ว ✅" : action === "reject" ? "ปฏิเสธแล้ว (บันทึกเหตุผลไว้สอน AI)" : "แก้ไขแล้ว — ยังรออนุมัติ" });
      setEditId(null);
      setRejectId(null);
      load();
    } catch (err) {
      setBanner({ type: "error", text: await describeFunctionError(err) });
    } finally {
      setActingId(null);
    }
  }

  if (pending === null || history === null) return <Skeleton className="h-[400px]" />;

  return (
    <div className="space-y-4">
      {banner ? (
        <div className={cn("rounded-xl px-4 py-2 text-sm", banner.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
          {banner.text}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-secondary">
          รอตรวจ ({pending.length}) — ข้อความที่ AI ร่างไว้ รอคุณอนุมัติ/แก้/ปฏิเสธ
        </h3>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> รีโหลด
        </Button>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line/20 p-10">
          <EmptyState icon={InboxIcon} title="ไม่มีข้อความรอตรวจ" description="AI ยังไม่ร่างข้อความใหม่อะไร หรือคุณตรวจหมดแล้ว" />
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((row) => (
            <div key={row.id} className="rounded-2xl border border-line/10 bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{FEATURE_LABELS[row.feature] ?? row.feature}</Badge>
                {row.message_type === "flex" ? <Badge variant="outline">การ์ด Flex</Badge> : null}
                <span className="text-sm font-medium text-secondary">{row.customers?.name ?? "ลูกค้า"}</span>
                {row.reason ? <span className="text-xs text-secondary/50">— {row.reason}</span> : null}
                <span className="ml-auto text-xs text-secondary/40">{formatTime(row.created_at)}</span>
              </div>

              <div className="mt-2 whitespace-pre-wrap rounded-xl bg-line/5 p-3 text-sm text-secondary">
                {row.message_type === "flex" ? "🎹 การ์ดเตือนคาบเรียน (กดอนุมัติเพื่อส่งเป็น Flex Message)" : row.message}
              </div>

              {editId === row.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-[72px]" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => act(row.id, "edit", { message: editText })} disabled={actingId === row.id}>
                      {actingId === row.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} บันทึก (กลับรอตรวจ)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditId(null)} disabled={actingId === row.id}>
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : rejectId === row.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="บอก AI ว่าทำไมไม่ดี (จะถูกนำไปสอนรอบถัดไป) เช่น 'อย่าใช้คำว่า ด่วน เกินไป'…"
                    className="min-h-[72px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" onClick={() => act(row.id, "reject", { note: rejectNote })} disabled={actingId === row.id}>
                      {actingId === row.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} ปฏิเสธ + สอน
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRejectId(null)} disabled={actingId === row.id}>
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => act(row.id, "approve")} disabled={actingId === row.id}>
                    {actingId === row.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                    อนุมัติแล้วส่ง
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditId(row.id);
                      setEditText(row.message);
                      setRejectId(null);
                    }}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> แก้ไข
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRejectId(row.id);
                      setEditId(null);
                    }}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> ปฏิเสธ
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 ? (
        <div className="pt-4">
          <h3 className="mb-2 text-sm font-medium text-secondary/70">ประวัติล่าสุด</h3>
          <div className="space-y-1.5">
            {history.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-line/3 px-3 py-2 text-xs text-secondary/60">
                <Badge variant="outline">{FEATURE_LABELS[row.feature] ?? row.feature}</Badge>
                <Badge variant={row.status === "sent" ? "success" : row.status === "rejected" ? "warning" : "danger"}>
                  {STATUS_LABELS[row.status] ?? row.status}
                </Badge>
                <span className="max-w-[300px] truncate">{row.message}</span>
                {row.rejected_note ? <span className="text-danger/70">← {row.rejected_note}</span> : null}
                <span className="ml-auto text-secondary/40">{formatTime(row.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
