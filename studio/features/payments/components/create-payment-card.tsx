"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, HandCoins, QrCode, Send } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, describeFunctionError, formatCurrency } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface CreatedPaymentResult {
  paymentId: string;
  amount: number;
  accountNumber?: string;
  bank?: string;
  accountName?: string;
  promptpayTarget?: string;
  referenceCode: string;
  qrUrl: string | null;
  instructions: string;
  notified: boolean;
}

interface CreatePaymentCardProps {
  customer: Pick<Tables<"customers">, "id" | "name" | "phone" | "line_user_id">;
  /** Called after a payment is created successfully (e.g. to refresh lists). */
  onCreated?: () => void;
}

/**
 * จุดขายบนหน้านักเรียน — สร้างใบแจ้งชำระ 1 คลิก แล้วระบบส่งข้อความ+QR ไป LINE
 * ลูกค้าอัตโนมัติ (สร้างผ่าน create-payment ซึ่ง notifyCustomer=true) เหลือแค่รอเงินเข้า
 */
export function CreatePaymentCard({ customer, onCreated }: CreatePaymentCardProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedPaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("คัดลอกไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาตให้เข้าถึงคลิปบอร์ด");
    }
  }

  async function handleCreate() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("กรอกจำนวนเงินให้ถูกต้อง (มากกว่า 0)");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke("create-payment", {
        body: { customerId: customer.id, amount: n, note: note.trim() || undefined },
      });
      if (fnError) {
        setError(await describeFunctionError(fnError));
        setCreating(false);
        return;
      }
      const result = data as CreatedPaymentResult;
      // QR lives in storage (qr_url) when the upload succeeded; fall back to
      // the base64 copy stored on the payments row so the preview always shows.
      let qrSrc = result.qrUrl;
      if (!qrSrc) {
        const row = await createRepositories(createClient()).payments.findById(result.paymentId);
        qrSrc = row?.qr_base64 ?? null;
      }
      setCreated({ ...result, qrUrl: qrSrc });
      setAmount("");
      setNote("");
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างใบแจ้งชำระไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HandCoins className="h-4 w-4 text-primary-accent" />
          สร้างใบแจ้งชำระ
        </CardTitle>
        <CardDescription>
          {customer.line_user_id ? "สร้างแล้วส่งข้อความและ QR ไป LINE ลูกค้าอัตโนมัติ" : "ลูกค้ารายนี้ยังไม่มี LINE เชื่อม — สร้างแล้วคัดลอกข้อความส่งเอง"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}

        {created ? (
          <div className="space-y-4 rounded-xl border border-success/20 bg-success/5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-secondary">
                  สร้างใบแจ้งชำระแล้ว — อ้างอิง {created.referenceCode}
                  {created.notified ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-success">
                      <Send className="h-3.5 w-3.5" /> ส่ง LINE ให้ลูกค้าแล้ว
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-secondary/70">{created.instructions}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {created.qrUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={created.qrUrl} alt="PromptPay QR" className="h-32 w-32 rounded-xl border border-line/10 bg-white p-1.5" />
              ) : (
                <div className="flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line/10 text-center text-xs text-secondary/50">
                  <QrCode className="h-6 w-6" />
                  ตั้งค่า PromptPay ใน Settings ก่อน หรือใช้เลขที่แสดง
                </div>
              )}
              <div className="flex flex-col gap-2">
                <p className="text-sm text-secondary/70">{formatCurrency(created.amount)} บาท</p>
                <Button variant="outline" size="sm" onClick={() => copyText(created.instructions)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>
                  สร้างใบแจ้งชำระอีกใบ
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-secondary/60">จำนวนเงิน (บาท)</label>
                <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="เช่น 27000" inputMode="numeric" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-secondary/60">หมายเหตุ (ไม่บังคับ)</label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น คอร์ส 20 ชม. รอบ 2" />
              </div>
            </div>
            <Button className={cn("w-full sm:w-auto")} onClick={handleCreate} disabled={creating || !amount.trim()}>
              {creating ? "กำลังสร้าง…" : "สร้างใบแจ้งชำระ"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
