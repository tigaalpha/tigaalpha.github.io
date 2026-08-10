"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Check, X, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import type { Tables } from "@/types/database";

type ApprovalRequest = Tables<"approval_requests">;

const TYPE_LABEL: Record<string, string> = {
  cancel_paid_lesson: "ยกเลิกคาบเรียน",
  ad_campaign_spend: "อนุมัติแคมเปญโฆษณา",
  ai_drafted_message: "AI ร่างข้อความ (รอตรวจก่อนส่ง)",
  bulk_sales_status_change: "เปลี่ยนสถานะลูกค้าหลายคน",
};

function describePayload(request: ApprovalRequest): string {
  const p = request.payload as Record<string, unknown>;
  if (request.type === "cancel_paid_lesson") {
    return `คาบเรียน "${p.title ?? "-"}" วันที่ ${p.startTime ? new Date(String(p.startTime)).toLocaleString("th-TH") : "-"}`;
  }
  if (request.type === "ad_campaign_spend") {
    return `แคมเปญ #${p.campaignId ?? "-"}`;
  }
  if (request.type === "ai_drafted_message") {
    return `ส่งถึง: ${p.customerName ?? "-"}`;
  }
  if (request.type === "bulk_sales_status_change") {
    const customerIds = Array.isArray(p.customerIds) ? p.customerIds : [];
    return `${customerIds.length} คน → ${p.toStatus ?? "-"}`;
  }
  return JSON.stringify(p);
}

export function ApprovalsManager() {
  const [requests, setRequests] = useState<ApprovalRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, []);

  async function withAuth() {
    const { createClient } = await import("@/services/supabase/client");
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    return session.access_token;
  }

  async function load() {
    try {
      const token = await withAuth();
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/approvals?status=pending`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        const loaded: ApprovalRequest[] = data.requests ?? [];
        setRequests(loaded);
        setDrafts(
          Object.fromEntries(
            loaded.filter((r) => r.type === "ai_drafted_message").map((r) => [r.id, String((r.payload as Record<string, unknown>).message ?? "")])
          )
        );
      }
    } catch (err) {
      console.error("Failed to load approvals:", err);
    }
  }

  async function resolve(id: string, action: "approve" | "reject", request?: ApprovalRequest) {
    setBusyId(id);
    setError(null);
    try {
      const token = await withAuth();
      const editedPayload =
        action === "approve" && request?.type === "ai_drafted_message" ? { message: drafts[id] ?? "" } : undefined;
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/approvals`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, editedPayload }),
      });
      if (response.ok) {
        setRequests((prev) => (prev ?? []).filter((r) => r.id !== id));
      } else {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "ดำเนินการไม่สำเร็จ");
      }
    } catch (err) {
      console.error("Failed to resolve approval:", err);
      setError("ดำเนินการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary-accent" />
            รออนุมัติ
          </CardTitle>
          <CardDescription>คำขอที่ AI ส่งมาให้ตรวจสอบก่อนดำเนินการจริง (เช่น ยกเลิกคาบเรียนที่จ่ายเงินแล้ว)</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p> : null}
          {requests === null ? (
            <p className="text-sm text-secondary/50">กำลังโหลด…</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-secondary/50">ไม่มีคำขอที่รออนุมัติ</p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="rounded-xl border border-line/10 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="warning">{TYPE_LABEL[request.type] ?? request.type}</Badge>
                    <span className="flex items-center gap-1 text-xs text-secondary/50">
                      <Clock className="h-3 w-3" />
                      {new Date(request.created_at).toLocaleString("th-TH")}
                    </span>
                  </div>
                  <p className="mb-1 text-sm text-secondary">{describePayload(request)}</p>
                  {request.reason ? <p className="mb-3 text-xs text-secondary/60">เหตุผล: {request.reason}</p> : null}
                  {request.type === "ai_drafted_message" ? (
                    <>
                      <Textarea
                        value={drafts[request.id] ?? ""}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [request.id]: e.target.value }))}
                        className="mb-2 min-h-24"
                        placeholder="ข้อความที่ AI ร่างไว้ — แก้ไขได้ก่อนกดอนุมัติ"
                      />
                      {!(request.payload as Record<string, unknown>).hasLineConnection ? (
                        <p className="mb-3 text-xs text-danger">
                          ลูกค้าคนนี้ยังไม่เคยทักแชท LINE มา — ส่งข้อความนี้ให้ไม่ได้จนกว่าลูกค้าจะทักมาก่อน (กดอนุมัติจะไม่สำเร็จ)
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => resolve(request.id, "approve", request)}
                      disabled={busyId === request.id || (request.type === "ai_drafted_message" && !(request.payload as Record<string, unknown>).hasLineConnection)}
                    >
                      <Check className="h-3 w-3" />
                      อนุมัติ{request.type === "ai_drafted_message" ? "และส่ง" : ""}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolve(request.id, "reject", request)} disabled={busyId === request.id}>
                      <X className="h-3 w-3" />
                      ปฏิเสธ
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
