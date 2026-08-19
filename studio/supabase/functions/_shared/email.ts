// Shared email helper — Resend via plain REST (no SDK, same fetch-based
// style as line.ts / calendar.ts). Used by email-send / email-campaign
// edge functions, by create-payment / verify-payment for invoice + receipt
// emails, and by the CEO Agent's send_email action.
//
// Secrets: RESEND_API_KEY (Supabase Edge Function secret). The sender
// address comes from integration_settings key `email_from_address` (set in
// Settings > Integrations — Email) and falls back to Resend's test sender
// until a real domain is verified there.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface EmailResult {
  ok: boolean;
  message: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function getEmailFromAddress(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("integration_settings").select("value").eq("key", "email_from_address").maybeSingle();
  const v = data?.value as string | undefined;
  return v?.trim() || "onboarding@resend.dev";
}

/**
 * Send one email. Never throws on a delivery failure — returns {ok, message}
 * so callers can treat email as a convenience on top of the primary channel
 * (LINE) without ever breaking a payment or booking flow.
 */
export async function sendEmail(admin: SupabaseClient, input: { to: string; subject: string; html?: string; text?: string }): Promise<EmailResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, message: "RESEND_API_KEY ยังไม่ได้ตั้งค่า — เพิ่มใน Supabase Secrets (ดู Settings > Integrations > Email)" };

  const to = input.to.trim();
  if (!to || !EMAIL_RE.test(to)) return { ok: false, message: "อีเมลผู้รับไม่ถูกต้อง" };
  if (!input.subject.trim()) return { ok: false, message: "ต้องมีหัวข้ออีเมล (subject)" };

  const from = await getEmailFromAddress(admin);
  const body: Record<string, unknown> = { from, to, subject: input.subject };
  if (input.html) body.html = input.html;
  if (input.text) body.text = input.text;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    return { ok: false, message: `Resend ปฏิเสธการส่ง (${response.status}): ${detail}` };
  }
  return { ok: true, message: `ส่งอีเมลถึง ${to} แล้ว` };
}
