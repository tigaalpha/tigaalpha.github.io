"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, ExternalLink, CheckCircle2, FileWarning, Banknote, ShieldAlert } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { TransferSlipWithPayment } from "@/services/repositories/transfer-slips.repository";
import type { Tables } from "@/types/database";

type SlipStatus = Tables<"transfer_slips">["match_status"];

const SLIP_STATUS_UI: Record<SlipStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "danger" | "outline" }> = {
  pending: { label: "รอตรวจ", variant: "warning" },
  matched: { label: "ตรงกับใบแจ้งชำระ", variant: "success" },
  unmatched: { label: "ไม่ตรงกับใบแจ้งชำระ", variant: "danger" },
  not_a_slip: { label: "ไม่ใช่สลิป", variant: "secondary" },
};

interface SlipReviewDialogProps {
  /** Slips to browse in this dialog (normally the ones needing attention). */
  slips: TransferSlipWithPayment[];
  initialIndex: number;
  onClose: () => void;
  /** Called after the owner marks a slip reviewed or verifies a payment — parent reloads its lists. */
  onChanged: () => void;
  /** Verify a linked pending payment (owner confirms the money arrived). Returns true on success. */
  onVerifyPayment: (paymentId: string) => Promise<boolean>;
}

export function SlipReviewDialog({ slips, initialIndex, onClose, onChanged, onVerifyPayment }: SlipReviewDialogProps) {
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), Math.max(slips.length - 1, 0)));
  const [busy, setBusy] = useState<string | null>(null); // "mark" | "verify"
  const [error, setError] = useState<string | null>(null);

  const current = slips[index];
  if (!current) return null;
  const slip: TransferSlipWithPayment = current;

  async function markReviewed(status: SlipStatus) {
    setBusy("mark");
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("transfer_slips")
        .update({ match_status: status })
        .eq("id", slip.id);
      if (updateErr) throw updateErr;
      onChanged();
      if (index + 1 < slips.length) setIndex(index + 1);
      else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกสถานะสลิปไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function handleVerify() {
    if (!slip.payment_id) return;
    setBusy("verify");
    setError(null);
    try {
      const ok = await onVerifyPayment(slip.payment_id);
      if (!ok) return; // parent shows its own error/notice
      onChanged();
      if (index + 1 < slips.length) setIndex(index + 1);
      else onClose();
    } finally {
      setBusy(null);
    }
  }

  const canVerify = slip.payment_id !== null && slip.paymentStatus === "pending" && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="relative my-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-line/10 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-line/10 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileWarning className="h-5 w-5 shrink-0 text-primary-accent" />
            <h2 className="truncate font-semibold text-secondary">ตรวจสลิป — {slip.customerName ?? "ลูกค้า"}</h2>
            {slips.length > 1 && <span className="shrink-0 text-xs text-secondary/50">({index + 1}/{slips.length})</span>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-secondary/60 hover:bg-line/10 hover:text-secondary" aria-label="ปิด">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* body */}
        <div className="grid gap-0 md:grid-cols-[1fr_280px]">
          {/* image */}
          <div className="flex max-h-[52vh] min-h-64 items-center justify-center overflow-hidden bg-white p-3 md:max-h-[60vh]">
            {slip.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={slip.image_url}
                alt="สลิปโอนเงินของลูกค้า"
                className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-center text-sm text-secondary/50">
                <Banknote className="h-10 w-10" />
                ไม่มีรูปสลิป
                <span className="max-w-56 text-xs">สลิปนี้ส่งมาก่อนระบบเริ่มเก็บบันทึกรูป (อ่านยอดได้จากข้อมูลด้านขวา)</span>
              </div>
            )}
          </div>

          {/* details + actions */}
          <div className="flex flex-col gap-4 border-t border-line/10 p-5 md:border-l md:border-t-0">
            {error && <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger">{error}</p>}

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-secondary/50">สถานะ</span>
                <Badge variant={SLIP_STATUS_UI[slip.match_status].variant}>{SLIP_STATUS_UI[slip.match_status].label}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-secondary/50">ยอดที่อ่านได้</span>
                <span className="font-semibold text-secondary">
                  {slip.extracted_amount != null ? formatCurrency(Number(slip.extracted_amount)) : "—"} บาท
                </span>
              </div>
              {slip.extracted_reference ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary/50">อ้างอิง</span>
                  <span className="font-mono text-xs text-secondary">{slip.extracted_reference}</span>
                </div>
              ) : null}
              {slip.extracted_date ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary/50">วันที่โอน</span>
                  <span className="text-xs text-secondary">{new Date(slip.extracted_date).toLocaleString("th-TH")}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="text-secondary/50">ส่งเมื่อ</span>
                <span className="text-xs text-secondary">{new Date(slip.created_at).toLocaleString("th-TH")}</span>
              </div>
              {slip.paymentReference ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-secondary/50">ใบแจ้งชำระ</span>
                  <span className="font-mono text-xs text-secondary">{slip.paymentReference}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              {canVerify && (
                <Button size="sm" onClick={handleVerify} disabled={busy !== null}>
                  {busy === "verify" ? "กำลังยืนยัน…" : "ยืนยันเงินเข้า ✓"}
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
              {slip.match_status !== "matched" && (
                <div className="grid grid-cols-1 gap-2">
                  <Button size="sm" onClick={() => markReviewed("matched")} disabled={busy !== null}>
                    ✓ ตรวจแล้ว — ตรงกับยอด
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => markReviewed("unmatched")} disabled={busy !== null}>
                      ไม่ตรง
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => markReviewed("not_a_slip")} disabled={busy !== null}>
                      <ShieldAlert className="h-4 w-4" /> ไม่ใช่สลิป
                    </Button>
                  </div>
                </div>
              )}
              {slip.match_status === "matched" && (
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-4 w-4" /> ตรวจแล้ว — ยอดตรงกับใบแจ้งชำระ
                </p>
              )}
              {slip.image_url && (
                <a
                  href={slip.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center justify-center gap-1 rounded-xl border border-line/10 px-3 py-2 text-xs text-secondary/70 hover:bg-line/5"
                >
                  เปิดภาพเต็มจอ <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* footer nav */}
        {slips.length > 1 && (
          <div className="flex items-center justify-between border-t border-line/10 px-5 py-3">
            <Button size="sm" variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0 || busy !== null}>
              <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
            </Button>
            <span className={cn("text-xs text-secondary/50")}>
              สลิปที่ต้องตรวจ {slips.length} ใบ
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIndex((i) => Math.min(slips.length - 1, i + 1))}
              disabled={index === slips.length - 1 || busy !== null}
            >
              ถัดไป <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
