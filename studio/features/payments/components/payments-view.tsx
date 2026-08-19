"use client";

import { useEffect, useState } from "react";
import {
  HandCoins,
  Plus,
  Search,
  X,
  Copy,
  Check,
  QrCode,
  CheckCircle2,
  Clock3,
  FileWarning,
  RefreshCw,
  ExternalLink,
  Landmark,
  Banknote,
  Send,
} from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, describeFunctionError, formatCurrency } from "@/lib/utils";
import type { PaymentWithCustomer } from "@/services/repositories/payments.repository";
import type { TransferSlipWithPayment } from "@/services/repositories/transfer-slips.repository";
import type { Tables } from "@/types/database";
import { SlipReviewDialog } from "./slip-review-dialog";

type PaymentStatus = Tables<"payments">["status"];
type SlipStatus = Tables<"transfer_slips">["match_status"];
type BadgeVariant = "default" | "secondary" | "success" | "warning" | "danger" | "outline";

const PAY_STATUS_UI: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "รอชำระ", variant: "warning" },
  paid: { label: "จ่ายแล้ว", variant: "success" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
};

const SLIP_STATUS_UI: Record<SlipStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "รอตรวจ", variant: "outline" },
  matched: { label: "ตรงกับใบแจ้งชำระ", variant: "success" },
  unmatched: { label: "ไม่ตรงกับใบแจ้งชำระ", variant: "danger" },
  not_a_slip: { label: "ไม่ใช่สลิป", variant: "secondary" },
};

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

export function PaymentsView() {
  const [pending, setPending] = useState<PaymentWithCustomer[] | null>(null);
  const [history, setHistory] = useState<PaymentWithCustomer[] | null>(null);
  const [slips, setSlips] = useState<TransferSlipWithPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // slip review dialog — owner clicks a slip / the attention card to eyeball
  // the photo the customer sent and mark it checked.
  const [reviewSlips, setReviewSlips] = useState<TransferSlipWithPayment[] | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);

  // create-payment form
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Tables<"customers">[] | null>(null);
  const [customer, setCustomer] = useState<Tables<"customers"> | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedPaymentResult | null>(null);

  // verify (owner/admin confirms money arrived)
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyNote, setVerifyNote] = useState("");
  const [busyVerify, setBusyVerify] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const repos = createRepositories(createClient());
    const [all, slipList] = await Promise.all([repos.payments.listAll(100), repos.transferSlips.listRecent(30)]);
    setPending(all.filter((p) => p.status === "pending"));
    setHistory(all.filter((p) => p.status !== "pending"));
    setSlips(slipList);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  // customer search for the create form (2+ characters, debounced lightly)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      createRepositories(createClient())
        .customers.search(q)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("คัดลอกไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาตให้เข้าถึงคลิปบอร์ด");
    }
  }

  function paymentMessage(p: PaymentWithCustomer): string {
    return `โอนเข้าบัญชี ${p.promptpay_target} จำนวน ${Number(p.amount).toLocaleString("th-TH")} บาท (อ้างอิง ${p.reference_code})`;
  }

  async function handleCreate() {
    if (!customer) {
      setError("เลือกลูกค้าก่อน");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("กรอกจำนวนเงินให้ถูกต้อง (มากกว่า 0)");
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
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
      setCustomer(null);
      setQuery("");
      setAmount("");
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างใบแจ้งชำระไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  }

  async function handleVerify(paymentId: string) {
    setBusyVerify(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const { error: fnError } = await supabase.functions.invoke("verify-payment", {
        body: { paymentId, note: verifyNote.trim() || undefined },
      });
      if (fnError) {
        setError(await describeFunctionError(fnError));
        setBusyVerify(false);
        return;
      }
      setNotice("ยืนยันการชำระเงินแล้ว — บันทึกรายได้ใน Accounting และแจ้งลูกค้าทาง LINE เรียบร้อย");
      setVerifyingId(null);
      setVerifyNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยืนยันการชำระเงินไม่สำเร็จ");
    } finally {
      setBusyVerify(false);
    }
  }

  async function handleVerifyFromSlip(paymentId: string): Promise<boolean> {
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const { error: fnError } = await supabase.functions.invoke("verify-payment", { body: { paymentId } });
      if (fnError) {
        setError(await describeFunctionError(fnError));
        return false;
      }
      setNotice("ยืนยันการชำระเงินแล้ว — บันทึกรายได้ใน Accounting และแจ้งลูกค้าทาง LINE เรียบร้อย");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยืนยันการชำระเงินไม่สำเร็จ");
      return false;
    }
  }

  function openSlipReview(list: TransferSlipWithPayment[], index: number) {
    setReviewSlips(list);
    setReviewIndex(index);
  }

  const pendingTotal = (pending ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const now = new Date();
  const paidThisMonth = (history ?? [])
    .filter((p) => p.status === "paid" && p.paid_at && new Date(p.paid_at).getFullYear() === now.getFullYear() && new Date(p.paid_at).getMonth() === now.getMonth())
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const slipsAttention = (slips ?? []).filter((s) => s.match_status === "unmatched" || s.match_status === "pending").length;

  const loading = pending === null || history === null || slips === null;

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <Card>
          <CardContent className={cn("flex items-start justify-between gap-3 pt-6 text-sm", error ? "text-danger" : "text-success")}>
            <span>{error ?? notice}</span>
            <button onClick={() => { setError(null); setNotice(null); }} className={cn("shrink-0 text-xs", error ? "text-danger/70" : "text-success/70")}>
              ปิด
            </button>
          </CardContent>
        </Card>
      )}

      {/* stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10">
              <Clock3 className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-secondary/50">รอชำระ (pending)</p>
              <p className="truncate text-lg font-semibold text-secondary">
                {(pending ?? []).length} ใบ · {loading ? "…" : formatCurrency(pendingTotal)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-secondary/50">จ่ายแล้วเดือนนี้</p>
              <p className="truncate text-lg font-semibold text-secondary">{loading ? "…" : formatCurrency(paidThisMonth)}</p>
            </div>
          </CardContent>
        </Card>
        <button
          type="button"
          onClick={() => {
            const attention = (slips ?? []).filter((s) => s.match_status === "pending" || s.match_status === "unmatched");
            if (attention.length > 0) openSlipReview(attention, 0);
          }}
          disabled={loading || slipsAttention === 0}
          className={cn("w-full text-left", slipsAttention > 0 ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0" : "cursor-default opacity-90")}
        >
          <Card className="h-full">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", slipsAttention > 0 ? "bg-danger/10" : "bg-primary/10")}>
                <FileWarning className={cn("h-5 w-5", slipsAttention > 0 ? "text-danger" : "text-primary-accent")} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-secondary/50">สลิปรอตรวจ / ไม่ตรง</p>
                <p className="truncate text-lg font-semibold text-secondary">{loading ? "…" : slipsAttention + " ใบ"}</p>
                {slipsAttention > 0 && !loading && <p className="text-xs text-primary-accent">กดเพื่อดูสลิปและตรวจ →</p>}
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* create payment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary-accent" />
            สร้างใบแจ้งชำระ
          </CardTitle>
          <CardDescription>ลูกค้าโอนเงินเข้าบัญชีสตูดิโอโดยตรง (พร้อมเพย์/ธนาคาร) — ไม่มีค่าธรรมเนียม แล้วเจ้าของยืนยันเมื่อเงินเข้าจริง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  <img src={created.qrUrl} alt="PromptPay QR" className="h-36 w-36 rounded-xl border border-line/10 bg-white p-1.5" />
                ) : (
                  <div className="flex h-36 w-36 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line/10 text-center text-xs text-secondary/50">
                    <QrCode className="h-6 w-6" />
                    ตั้งค่า PromptPay ใน Settings ก่อน หรือใช้เลขที่แสดง
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-secondary/70">
                    <Banknote className="mr-1 inline h-4 w-4" />
                    {formatCurrency(created.amount)} บาท
                  </p>
                  <Button variant="outline" size="sm" onClick={() => copyText(created.instructions, "created")}>
                    {copied === "created" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === "created" ? "คัดลอกแล้ว" : "คัดลอกข้อความแจ้งลูกค้า"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>
                    สร้างใบแจ้งชำระอีกใบ
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ค้นหาลูกค้า (ชื่อหรือเบอร์โทร)…"
                />
                {customer ? (
                  <div className="mt-2 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-secondary">
                    <span>
                      <b>{customer.name}</b>
                      {customer.phone ? <span className="ml-2 text-secondary/50">{customer.phone}</span> : null}
                    </span>
                    <button onClick={() => { setCustomer(null); setQuery(""); setResults(null); }} className="text-secondary/50 hover:text-secondary">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  results !== null && results.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line/10 bg-card shadow-lg">
                      {results.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setCustomer(c); setResults(null); setQuery(""); }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-secondary hover:bg-line/5"
                        >
                          <span>{c.name}</span>
                          {c.phone ? <span className="text-xs text-secondary/50">{c.phone}</span> : null}
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
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
              <Button className="w-full sm:w-auto" onClick={handleCreate} disabled={creating || !customer || !amount.trim()}>
                {creating ? "กำลังสร้าง…" : "สร้างใบแจ้งชำระ"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* pending list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-warning" />
            รอชำระ
            <Badge variant="warning">{pending?.length ?? "…"}</Badge>
          </CardTitle>
          <CardDescription>เงินยังไม่เข้าบัญชี — ตรวจยอดในแอปธนาคารก่อนกดยืนยัน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Skeleton className="h-24" />
          ) : pending && pending.length > 0 ? (
            pending.map((p) => (
              <div key={p.id} className="rounded-xl border border-line/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-secondary">{p.customerName}</p>
                    <p className="text-xs text-secondary/50">
                      {p.reference_code} · {new Date(p.created_at).toLocaleString("th-TH")}
                    </p>
                    {p.note ? <p className="mt-1 text-sm text-secondary/70">📝 {p.note}</p> : null}
                    {p.promptpay_target ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-secondary/50">
                        <Landmark className="h-3.5 w-3.5" /> {p.promptpay_target}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="text-lg font-semibold text-secondary">{formatCurrency(Number(p.amount))}</p>
                    {p.qr_url || p.qr_base64 ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.qr_url ?? p.qr_base64 ?? ""}
                        alt="PromptPay QR"
                        className="h-24 w-24 rounded-lg border border-line/10 bg-white p-1"
                      />
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyText(paymentMessage(p), p.id)}>
                    {copied === p.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === p.id ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}
                  </Button>
                  {verifyingId === p.id ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <Input
                        className="h-8 min-w-40 flex-1"
                        value={verifyNote}
                        onChange={(e) => setVerifyNote(e.target.value)}
                        placeholder="หมายเหตุยืนยัน (ไม่บังคับ)"
                      />
                      <Button size="sm" onClick={() => handleVerify(p.id)} disabled={busyVerify}>
                        {busyVerify ? "กำลังยืนยัน…" : "ยืนยันเงินเข้า ✓"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setVerifyingId(null); setVerifyNote(""); }}>
                        ยกเลิก
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => setVerifyingId(p.id)}>
                      <CheckCircle2 className="h-4 w-4" />
                      ยืนยันเงินเข้า
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon={HandCoins} title="ไม่มีใบแจ้งชำระค้าง" description="เมื่อสร้างใบแจ้งชำระแล้วจะแสดงที่นี่" />
          )}
        </CardContent>
      </Card>

      {/* paid / cancelled */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            จ่ายแล้ว / ยกเลิก
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Skeleton className="h-24" />
          ) : history && history.length > 0 ? (
            history.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/10 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-secondary">{p.customerName}</p>
                  <p className="text-xs text-secondary/50">
                    {p.reference_code}
                    {p.paid_at ? ` · จ่ายเมื่อ ${new Date(p.paid_at).toLocaleDateString("th-TH")}` : ` · สร้าง ${new Date(p.created_at).toLocaleDateString("th-TH")}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="font-semibold text-secondary">{formatCurrency(Number(p.amount))}</p>
                  <Badge variant={PAY_STATUS_UI[p.status].variant}>{PAY_STATUS_UI[p.status].label}</Badge>
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon={HandCoins} title="ยังไม่มีประวัติการชำระ" />
          )}
        </CardContent>
      </Card>

      {/* transfer slips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-primary-accent" />
            สลิปโอนเงิน
            <Badge variant={slipsAttention > 0 ? "danger" : "outline"}>{slips?.length ?? "…"}</Badge>
          </CardTitle>
          <CardDescription>สลิปที่ลูกค้าส่งมาทาง LINE — AI อ่านยอดและอ้างอิงให้อัตโนมัติ ใบที่ไม่ตรงต้องตรวจเอง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Skeleton className="h-24" />
          ) : slips && slips.length > 0 ? (
            slips.map((s) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => openSlipReview([s], 0)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSlipReview([s], 0);
                  }
                }}
                className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-xl border border-line/10 p-4 transition hover:border-primary/30 hover:bg-line/5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {s.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.image_url} alt="สลิป" className="h-14 w-14 shrink-0 rounded-lg border border-line/10 object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-line/10 text-secondary/40">
                      <Banknote className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-secondary">{s.customerName ?? "ลูกค้าไม่ทราบชื่อ"}</p>
                    <p className="text-sm text-secondary/70">
                      {s.extracted_amount != null ? formatCurrency(Number(s.extracted_amount)) : "—"} บาท
                      {s.extracted_reference ? <span className="ml-2 text-secondary/50">อ้างอิง {s.extracted_reference}</span> : null}
                    </p>
                    <p className="text-xs text-secondary/50">
                      {new Date(s.created_at).toLocaleString("th-TH")}
                      {s.paymentReference ? ` · ใบแจ้งชำระ ${s.paymentReference}` : " · ยังไม่ผูกใบแจ้งชำระ"}
                    </p>
                    {s.image_url ? (
                      <a
                        href={s.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 flex items-center gap-1 text-xs text-primary-accent underline"
                      >
                        เปิดสลิปเต็ม <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="mt-0.5 text-xs text-secondary/40">กดเพื่อตรวจ</p>
                    )}
                  </div>
                </div>
                <Badge variant={SLIP_STATUS_UI[s.match_status].variant}>{SLIP_STATUS_UI[s.match_status].label}</Badge>
              </div>
            ))
          ) : (
            <EmptyState icon={Search} title="ยังไม่มีสลิป" description="สลิปที่ลูกค้าส่งทาง LINE จะแสดงที่นี่" />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => load().catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"))}>
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </Button>
      </div>

      {reviewSlips && (
        <SlipReviewDialog
          slips={reviewSlips}
          initialIndex={reviewIndex}
          onClose={() => setReviewSlips(null)}
          onChanged={() => load().catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"))}
          onVerifyPayment={handleVerifyFromSlip}
        />
      )}
    </div>
  );
}
