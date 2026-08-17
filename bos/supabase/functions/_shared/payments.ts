// Shared bank-transfer payment logic — used by BOTH the create-payment /
// verify-payment edge functions (called from the Payments page,
// app/(workspace)/payments) and the AI tools (create_payment_link /
// mark_payment_paid in tools.ts), so the two entry points can never drift
// apart.
//
// Payment method: direct bank transfer (โอนตรงเข้าบัญชี) — the customer
// transfers straight into the studio's account (bank + account number in
// integration_settings key `payment_config`). When a PromptPay id is also
// configured, a scanable QR is offered as an extra convenience — but the
// account transfer is always the primary instruction.
//
// Money-adjacent rules live here once:
//   * the studio's account comes from integration_settings key
//     `payment_config` ({ account_number, bank?, name?, promptpay_id?,
//     income_category? })
//   * a payment can only be marked paid by an owner/admin (enforced by the
//     callers via requireOwnerOrAdmin) — the AI itself can never do it
//   * marking paid records the income transaction, moves the customer to
//     won/renewed, and notifies them on LINE

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import qrcode from "npm:qrcode-generator@1.4.4";
import { promptPayPayload, sanitizeAmount } from "./promptpay.ts";
import { push as linePush, pushImage } from "./line.ts";

export interface PaymentConfig {
  /** Studio bank account number — the primary transfer destination. */
  account_number?: string;
  /** e.g. "SCB" / "ธนาคารไทยพาณิชย์". */
  bank?: string;
  /** Account holder name as shown on the statement. */
  name?: string;
  /** Optional PromptPay id (mobile or 13-digit) — enables the scanable QR as an extra. */
  promptpay_id?: string;
  income_category?: string;
}

export async function getPaymentConfig(admin: SupabaseClient): Promise<PaymentConfig> {
  const { data } = await admin.from("integration_settings").select("value").eq("key", "payment_config").maybeSingle();
  const v = data?.value as PaymentConfig | null;
  if (v) {
    const accountNumber = typeof v.account_number === "string" ? v.account_number.trim() : "";
    const promptpayId = typeof v.promptpay_id === "string" ? v.promptpay_id.trim() : "";
    if (accountNumber.length > 0 || promptpayId.length > 0) {
      return { account_number: accountNumber || undefined, bank: v.bank, name: v.name, promptpay_id: promptpayId || undefined, income_category: v.income_category };
    }
  }
  throw new Error(
    "ยังไม่ได้ตั้งค่าบัญชีรับเงิน — เจ้าของร้านต้องกรอกเลขบัญชีธนาคาร (key: payment_config ใน Settings → Payment Config) ก่อน"
  );
}

export function buildPromptPayQr(config: PaymentConfig, amount: number): { payload: string; qrBase64: string } {
  const payload = promptPayPayload(config.promptpay_id ?? "", amount);
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
  /** When true (staff-triggered path only), push the payment details — and
   *  the PromptPay QR image when available — to the customer's LINE
   *  automatically. The AI's create_payment_link tool never sets this:
   *  that conversation is already on LINE, so the chat reply itself is the
   *  notification and a second push would read as spam. */
  notifyCustomer?: boolean;
}

export interface CreatedPayment {
  paymentId: string;
  amount: number;
  accountNumber?: string;
  bank?: string;
  accountName?: string;
  promptpayTarget?: string;
  referenceCode: string;
  qrUrl: string | null;
  instructions: string;
  /** True when the payment details were pushed to the customer's LINE. */
  notified: boolean;
}

export async function createPayment(admin: SupabaseClient, input: CreatePaymentInput): Promise<CreatedPayment> {
  const amount = sanitizeAmount(input.amount);
  if (amount === null) throw new Error("จำนวนเงินไม่ถูกต้อง — ต้องเป็นตัวเลขที่มากกว่า 0 และไม่เกิน 1,000,000 บาท");

  const { data: customer, error: custErr } = await admin.from("customers").select("id, name, line_user_id").eq("id", input.customerId).maybeSingle();
  if (custErr || !customer) throw new Error("ไม่พบลูกค้าที่ระบุ");

  if (input.courseId) {
    const { data: course, error: courseErr } = await admin.from("courses").select("id, customer_id").eq("id", input.courseId).maybeSingle();
    if (courseErr || !course) throw new Error("ไม่พบคอร์สที่ระบุ");
    if (course.customer_id !== customer.id) throw new Error("คอร์สนี้ไม่ใช่ของลูกค้ารายนี้");
  }

  const config = await getPaymentConfig(admin);

  // QR is an optional extra when a PromptPay id is configured — the direct
  // bank transfer below is always the primary instruction.
  let payload: string | null = null;
  let qrBase64: string | null = null;
  if (config.promptpay_id) {
    try {
      const built = buildPromptPayQr(config, amount);
      payload = built.payload;
      qrBase64 = built.qrBase64;
    } catch {
      // PromptPay misconfigured — fall back to account transfer only
    }
  }

  const referenceCode = makeReferenceCode();
  const target = config.account_number ? `${config.bank ?? ""} ${config.account_number}`.trim() : (config.promptpay_id ?? "");

  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      customer_id: customer.id,
      course_id: input.courseId ?? null,
      amount,
      promptpay_target: target,
      promptpay_payload: payload,
      qr_base64: qrBase64,
      reference_code: referenceCode,
      note: input.note ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  let qrUrl: string | null = null;
  if (qrBase64) {
    qrUrl = await uploadQrToStorage(admin, qrBase64, referenceCode);
    if (qrUrl) await admin.from("payments").update({ qr_url: qrUrl }).eq("id", payment.id);
  }

  // Primary instruction: transfer straight into the studio account.
  const accountLine = config.account_number
    ? `โอนเข้าบัญชี ${config.bank ?? ""} เลขที่ ${config.account_number}${config.name ? " ชื่อ " + config.name : ""}`
    : `พร้อมเพย์ ${config.promptpay_id}`;
  const qrLine = qrUrl ? ` หรือสแกน QR ที่ส่งให้` : "";
  const instructions =
    `${accountLine}${qrLine} จำนวน ${amount.toLocaleString("th-TH")} บาท ` +
    `(อ้างอิง ${referenceCode}) — โอนตรงเข้าบัญชีของสตูดิโอ ไม่มีค่าธรรมเนียม แล้วแจ้งให้ทราบ ทางเราจะยืนยันเมื่อได้รับเงิน`;

  // Staff-triggered payments (notifyCustomer) push the details straight to
  // the customer's LINE — QR image when one exists, text otherwise. The AI
  // chat path never passes this flag (see CreatePaymentInput).
  let notified = false;
  if (input.notifyCustomer && customer.line_user_id) {
    try {
      if (qrUrl) {
        await pushImage(customer.line_user_id, qrUrl, instructions);
      } else {
        await linePush(customer.line_user_id, instructions);
      }
      notified = true;
    } catch {
      // Customer blocked the OA / LINE not configured — the payment row
      // still exists and the page's copy button covers manual forwarding.
    }
  }

  return {
    paymentId: payment.id,
    amount,
    accountNumber: config.account_number,
    bank: config.bank,
    accountName: config.name,
    promptpayTarget: config.promptpay_id,
    referenceCode,
    qrUrl,
    instructions,
    notified,
  };
}

export interface ConfirmPaymentInput {
  paymentId: string;
  /** Staff id when confirmed by a human; null when auto-confirmed from a transfer slip. */
  confirmedBy: string | null;
  note?: string | null;
  /** True when the slip vision flow matched it (feature #1) — adjusts the notification wording. */
  auto?: boolean;
  slipImageUrl?: string | null;
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
    .update({
      status: "paid",
      paid_at: now,
      confirmed_by: input.confirmedBy,
      slip_verified_at: input.auto ? now : null,
      ...(input.slipImageUrl ? { slip_image_url: input.slipImageUrl } : {}),
    })
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
      description: input.note || (input.auto ? `ชำระเงิน ${payment.reference_code} (ยืนยันอัตโนมัติจากสลิป)` : `ชำระเงิน ${payment.reference_code}`),
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
        note: `ชำระเงินแล้ว (${payment.reference_code})`,
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
    title: "ได้รับชำระเงิน",
    body: `${customer?.name ?? "ลูกค้า"} ชำระ ${amount.toLocaleString("th-TH")} บาท (${payment.reference_code}) — ${input.auto ? "ยืนยันอัตโนมัติจากสลิป" : "บันทึกรายได้แล้ว"}`,
    customer_id: payment.customer_id,
  });

  // Feature #11: when this customer arrived through a referral and just
  // paid, remind the owner to grant the promised reward.
  if (customer?.id) {
    const { data: referral } = await admin
      .from("referrals")
      .select("id, referral_code, referrer_customer_id")
      .eq("referred_customer_id", customer.id)
      .eq("reward_granted", false)
      .maybeSingle();
    if (referral) {
      await admin.from("referrals").update({ reward_granted: true }).eq("id", referral.id);
      await admin.from("notifications").insert({
        type: "referral_created",
        title: "ลูกค้าจากรีเฟอรัลชำระเงินแล้ว",
        body: `ลูกค้าที่ถูกแนะนำด้วยโค้ด ${referral.referral_code} จ่ายเงินแล้ว — อย่าลืมมอบส่วนลด/ของขวัญให้ผู้แนะนำ`,
        customer_id: referral.referrer_customer_id,
      });
    }
  }

  return { payment: updated, transaction };
}

/**
 * Auto-confirm from a transfer slip (feature #1). The caller (line-webhook)
 * has already matched the slip to this exact payment via matchSlipToPayment;
 * this runs the same confirmPayment pipeline with a null "confirmed by" so
 * the ledger shows it was system-verified, and refreshes the customer's
 * lead score (a paid customer is the hottest kind).
 */
export async function confirmPaymentBySlip(admin: SupabaseClient, input: { paymentId: string; slipImageUrl?: string | null }): Promise<{ payment: unknown; transaction: unknown }> {
  const result = await confirmPayment(admin, { paymentId: input.paymentId, confirmedBy: null, auto: true, slipImageUrl: input.slipImageUrl ?? null });
  const { data: payment } = await admin.from("payments").select("customer_id").eq("id", input.paymentId).maybeSingle();
  if (payment?.customer_id) {
    try {
      await admin.rpc("recompute_lead_score", { p_customer: payment.customer_id });
    } catch {
      // lead score is a soft signal — never let it fail the caller
    }
  }
  return result;
}
