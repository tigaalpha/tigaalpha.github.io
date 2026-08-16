// Customer portal session helpers — HMAC-SHA256 signed tokens, secret stored
// in integration_settings (key `portal_secret`, auto-generated on first use).
// Tokens carry { lineUserId, customerId, exp } so portal-me can resolve the
// customer without a DB lookup per request.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface PortalSession {
  lineUserId: string;
  customerId: string;
  exp: number;
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getSecret(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("integration_settings").select("value").eq("key", "portal_secret").maybeSingle();
  if (data?.value) return data.value;
  const secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await admin.from("integration_settings").upsert({ key: "portal_secret", value: secret }, { onConflict: "key" });
  return secret;
}

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDecode(input: string): string {
  return atob(input.replace(/-/g, "+").replace(/_/g, "/"));
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createPortalToken(admin: SupabaseClient, lineUserId: string, customerId: string): Promise<string> {
  const secret = await getSecret(admin);
  const payload = { lineUserId, customerId, exp: Date.now() + TOKEN_TTL_MS };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = await sign(encoded, secret);
  return `${encoded}.${sig}`;
}

export async function verifyPortalToken(admin: SupabaseClient, token: string): Promise<PortalSession | null> {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return null;
    const secret = await getSecret(admin);
    const expected = await sign(encoded, secret);
    if (expected !== sig) return null;
    const payload = JSON.parse(base64UrlDecode(encoded)) as PortalSession;
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!payload.lineUserId || !payload.customerId) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify a LINE LIFF ID token and return the line user id (sub).
 * clientId = the LIFF app's channel ID, stored in integration_settings
 * (`liff_client_id`) — no extra env secret needed.
 */
export async function verifyLiffIdToken(admin: SupabaseClient, idToken: string): Promise<string | null> {
  const { data: cfg } = await admin.from("integration_settings").select("value").eq("key", "liff_client_id").maybeSingle();
  const clientId = cfg?.value;
  if (!clientId) return null;

  const body = new URLSearchParams({ id_token: idToken, client_id: clientId });
  const resp = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) return null;
  const data = await resp.json().catch(() => ({}));
  const sub = (data as { sub?: string }).sub;
  return typeof sub === "string" && sub.startsWith("U") ? sub : null;
}
