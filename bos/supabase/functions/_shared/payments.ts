// Shared PromptPay payment logic — used by BOTH the create-payment /
// verify-payment edge functions (called from a future Payments page) and
// the AI tools (create_payment_link / mark_payment_paid in tools.ts), so
// the two entry points can never drift apart.
//
// Money-adjacent rules live here once:
//   * the studio's PromptPay target comes from integration_settings key
//     `payment_config` ({ promptpay_id, name?, bank?, income_category? })
//   * a payment can only be marked paid by an owner/admin (enforced by the
//     callers via requireOwnerOrAdmin) — the AI itself can never do it
//   * marking paid records the income transaction, moves the customer to
//     won/renewed, and notifies them on LINE

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import qrcode from "npm:qrcode-generator@1.4.4";
import { promptPayPayload, sanitizeAmount } from "./promptpay.ts";
import { push as linePush } from "./line.ts";

export interface PaymentConfig {
  promptpay_id: string;
  name?: string;
  bank?: string;
  income_category?: string;
}

export async function getPaymentConfig(admin: SupabaseClient): Promise<PaymentConfig> {
  const { data } = await admin.from("integration_settings").select("value").eq("key", "payment_config").maybeSingle();
  const v = data?.value as PaymentConfig | null;
  if (v && typeof v.promptpay_id === "string" && v.promptpay_id.trim().length > 0) {
    return { promptpay_id: v.promptpay_id, name: v.name, bank: v.bank, income_category: v.income_category };
  }
  throw new Error(
    "ยังไม่ได้ตั้งค่าพร้อมเพย์ — เจ้าของร้านต้องกรอกเลขพร้อมเพย์ (เบอร์มือถือหรือเลขบัตรประชาชน 13 หลัก) ใน Settings → Payment Config ก่อน (key: payment_config)"
  );
}

export function buildPromptPayQr(config: PaymentConfig, amount: number): { payload: string; qrBase64: string } {
  const payload = promptPayPayload(config.promptpay_id, amount);
  if (!payload) throw new Error("เลขพร้อมเพย์ไม่ถูกต้อง — กรุณาตรวจสอบค่า payment_config ใน Settings");
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  return { payload, qrBase64: qr.createDataURL(6, 12) };
}

export function makeReferenceCode(): string {
  return "PP" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

async function uploadQrToStorage(admin: SupabaseClient, qrBase64: string, referenceCode: string): Promise<string | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    if (!url) return null;
    const bin = atob(qrBase64.split(",")[1] ?? "");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try {
      await admin.storage.createBucket("payment-qrs", { public: true });
    } catch {
      // bucket already exists — fine
    }
    const path = `payments/${referenceCode}.png`;
    const { error } = await admin.storage.from("payment-qrs").upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) return null;
    return `${url}/storage/v1/object/public/payment-qrs/${path}`;
  } catch {
    return null; // storage is a convenience (LINE image); DB base64 + text instructions still work
  }
}

export interface CreatePaymentInput {
  customerId: string;
  amount: number;
  courseId?: string | null;
  note?: string | null;
}

export interface CreatedPayment {
  paymentId: string;
  amount: number;
  promptpayTarget: string;
  referenceCode: string;
  qrUrl: string | null;
  instructions: string;
}

export async function createPayment(admin: SupabaseClient, input: CreatePaymentInput): Promise<CreatedPayment> {
  const amount = sanitizeAmount(input.amount);
  if (amount === null) throw new Error("จำนวนเงินไม่ถูกต้อง — ต้องเป็นตัวเลขที่มากกว่า 0 และไม่เกิน 1,000,000 บาท");

  const { data: customer, error: custErr } = await admin.from("customers").select("id, name").eq("id", input.customerId).maybeSingle();
  if (custErr || !customer) throw new Error("ไม่พบลูกค้าที่ระบุ");

  if (input.courseId) {
    const { data: course, error: courseErr } = await admin.from("courses").select("id, customer_id").eq("id", input.courseId).maybeSingle();
    if (courseErr || !course) throw new Error("ไม่พบคอร์สที่ระบุ");
    if (course.customer_id !== customer.id) throw new Error("คอร์สนี้ไม่ใช่ของลูกค้ารายนี้");
  }

  const config = await getPaymentConfig(admin);
  const { payload, qrBase64 } = buildPromptPayQr(config, amount);
  const referenceCode = makeReferenceCode();

  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      customer_id: customer.id,
      course_id: input.courseId ?? null,
      amount,
      promptpay_target: config.promptpay_id,
      promptpay_payload: payload,
      qr_base64: qrBase64,
      reference_code: referenceCode,
      note: input.note ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  const qrUrl = await uploadQrToStorage(admin, qrBase64, referenceCode);
  if (qrUrl) await admin.from("payments").update({ qr_url: qrUrl }).eq("id", payment.id);

  const displayTarget = config.promptpay_id;
  return {
    paymentId: payment.id,
    amount,
    promptpayTarget: displayTarget,
    referenceCode,
    qrUrl,
    instructions:
      `ชำระผ่านพร้อมเพย์ ${displayTarget} จำนวน ${amount.toLocaleString("th-TH")} บาท ` +
      `(อ้างอิง ${referenceCode}) — โอนตรงเข้าบัญชีของสตูดิโอ ไม่มีค่าธรรมเนียม แล้วแจ้งให้ทราบ ทางเราจะยืนยันเมื่อได้รับเงิน`,
  };
}

export interface ConfirmPaymentInput {
  paymentId: string;
  confirmedBy: string;
  note?: string | null;
}

export async function confirmPayment(admin: SupabaseClient, input: ConfirmPaymentInput): Promise<{ payment: unknown; transaction: unknown }> {
  const { data: payment, error: payErr } = await admin.from("payments").select("*").eq("id", input.paymentId).maybeSingle();
  if (payErr || !payment) throw new Error("ไม่พบใบชำระเงินที่ระบุ");
  if (payment.status !== "pending") throw new Error("ใบชำระเงินนี้ถูกจัดการไปแล้ว (สถานะปัจจุบัน: " + payment.status + ")");

  const amount = Number(payment.amount);
  const config = await getPaymentConfig(admin);

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await admin
    .from("payments")
    .update({ status: "paid", paid_at: now, confirmed_by: input.confirmedBy })
    .eq("id", payment.id)
    .select("*")
    .single();
  if (updateErr) throw updateErr;

  // 1. income transaction — same ledger the Accounting page reads
  const { data: transaction, error: txErr } = await admin
    .from("transactions")
    .insert({
      type: "income",
      category: config.income_category || "ค่าเรียนเปียโน/ดนตรี",
      amount,
      description: input.note || `ชำระ PromptPay ${payment.reference_code}`,
      transaction_date: now.slice(0, 10),
      payment_method: "โอนเงิน",
      customer_id: payment.customer_id,
      course_id: payment.course_id,
      created_by: input.confirmedBy,
    })
    .select("*")
    .single();
  if (txErr) throw txErr;

  // 2. move the customer forward in the pipeline (only if still mid-funnel)
  const { data: customer } = await admin.from("customers").select("id, name, sales_status, line_user_id").eq("id", payment.customer_id).maybeSingle();
  if (customer && !["won", "lost", "renewed"].includes(customer.sales_status)) {
    const toStatus = customer.sales_status === "renew_pending" ? "renewed" : "won";
    const { error: statusErr } = await admin
      .from("customers")
      .update({ sales_status: toStatus, last_contact_at: now })
      .eq("id", customer.id)
      .eq("sales_status", customer.sales_status);
    if (!statusErr) {
      await admin.from("sales_status_history").insert({
        customer_id: customer.id,
        from_status: customer.sales_status,
        to_status: toStatus,
        note: `ชำระเงินผ่าน PromptPay แล้ว (${payment.reference_code})`,
      });
    }
  }

  // 3. notify the customer on LINE (thanks + confirmation)
  if (customer?.line_user_id) {
    linePush(
      customer.line_user_id,
      `✅ ได้รับการชำระเงินแล้ว ${amount.toLocaleString("th-TH")} บาท ขอบคุณมากค่ะ${customer.name ? " คุณ" + customer.name : ""} 🙏`
    ).catch(() => {});
  }

  await admin.from("notifications").insert({
    type: "payment_received",
    title: "ได้รับชำระเงิน PromptPay",
    body: `${customer?.name ?? "ลูกค้า"} ชำระ ${amount.toLocaleString("th-TH")} บาท (${payment.reference_code}) — บันทึกรายได้แล้ว`,
    customer_id: payment.customer_id,
  });

  return { payment: updated, transaction };
}
