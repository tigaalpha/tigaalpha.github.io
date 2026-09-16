import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/* Confirms a School Plan Pro card payment by asking Stripe directly, rather
   than waiting for a webhook. The app calls this when the buyer lands back on
   ?school_paid=1&req=&session_id=.

   The session id comes from the browser, so it is not trusted on its own: the
   session is fetched from Stripe with the secret key and is only accepted when
   Stripe itself says payment_status is "paid" AND the session's own metadata
   names this request id. That pairing is what stops someone replaying any
   other paid session id against their own unpaid request.

   Secrets (owner sets in Supabase dashboard, never in code):
     STRIPE_SECRET_KEY — sk_live_... / sk_test_...
*/

const SITE = "https://tigaalpha.github.io";
const ALLOW = [SITE, "http://localhost:5173", "http://localhost:8080", "http://localhost:4173"];
function cors(origin: string | null) {
  const allow = origin && ALLOW.includes(origin) ? origin : SITE;
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
function jwtPayload(h: string | null) {
  try { return JSON.parse(atob((h || "").replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch (_e) { return null; }
}

serve(async (req) => {
  const headers = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const payload = jwtPayload(req.headers.get("authorization"));
    if (!payload || payload.role !== "authenticated" || !payload.sub) {
      return new Response(JSON.stringify({ error: "Sign in required" }), { status: 401, headers });
    }
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!key || !url || !svc) return new Response(JSON.stringify({ error: "not configured" }), { status: 503, headers });

    const { requestId, sessionId } = await req.json();
    if (!requestId || !sessionId) return new Response(JSON.stringify({ error: "requestId and sessionId required" }), { status: 400, headers });

    const H = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };
    const rowRes = await fetch(`${url}/rest/v1/school_payment_requests?id=eq.${encodeURIComponent(requestId)}&select=id,requester_id,amount,status`, { headers: H });
    const rows = await rowRes.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return new Response(JSON.stringify({ error: "request not found" }), { status: 404, headers });
    if (row.requester_id !== payload.sub) return new Response(JSON.stringify({ error: "not your request" }), { status: 403, headers });
    // Landing on the success URL twice must not be an error — the first visit
    // already did the work, so report the same answer instead of failing.
    if (row.status === "paid") return new Response(JSON.stringify({ status: "paid" }), { headers });

    const sres = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(String(sessionId)), {
      headers: { "Authorization": "Bearer " + key },
    });
    const s = await sres.json();
    if (!sres.ok) throw new Error((s && s.error && s.error.message) || ("Stripe " + sres.status));

    const meta = (s && s.metadata) || {};
    const belongs = String(meta.request_id || s.client_reference_id || "") === String(requestId);
    if (s.payment_status !== "paid" || !belongs) {
      return new Response(JSON.stringify({ status: "unpaid" }), { headers });
    }

    await fetch(`${url}/rest/v1/school_payment_requests?id=eq.${encodeURIComponent(requestId)}`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ status: "paid", reviewed_at: new Date().toISOString(), stripe_session_id: String(sessionId) }),
    });

    return new Response(JSON.stringify({ status: "paid" }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers });
  }
});
