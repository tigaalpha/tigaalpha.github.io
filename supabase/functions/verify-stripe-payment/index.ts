import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/* Confirms a card payment by asking Stripe directly, instead of only waiting
   for the webhook.

   The webhook is still the primary path and still does the same work. This is
   the safety net behind it: if STRIPE_WEBHOOK_SECRET is missing or wrong, if
   the endpoint is unregistered, or if a delivery simply fails, the buyer has
   been charged and nothing happens — which is the worst failure this system
   can have. So the app calls this when the buyer lands back on the site, and
   whichever path arrives first fulfils the order.

   Both paths run the same two SQL functions, which key off the Checkout
   Session id and do nothing the second time, so a race between them is safe.

   The session id comes from the browser and is not trusted on its own: the
   session is fetched from Stripe with the secret key, and is only accepted
   when Stripe says payment_status is "paid" AND the session's own metadata
   names the caller as its user. That pairing is what stops someone replaying
   another person's paid session id against their own account.

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

    const { sessionId } = await req.json();
    if (!sessionId) return new Response(JSON.stringify({ error: "sessionId required" }), { status: 400, headers });

    const sres = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(String(sessionId)), {
      headers: { "Authorization": "Bearer " + key },
    });
    const s = await sres.json();
    if (!sres.ok) throw new Error((s && s.error && s.error.message) || ("Stripe " + sres.status));

    const meta = (s && s.metadata) || {};
    if (String(meta.user_id || "") !== String(payload.sub)) {
      return new Response(JSON.stringify({ error: "not your session" }), { status: 403, headers });
    }
    if (s.payment_status !== "paid") {
      return new Response(JSON.stringify({ status: "unpaid" }), { headers });
    }

    const H = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };
    const ref = "stripe:" + s.id;
    const rpc = async (fn: string, args: Record<string, unknown>) => {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
      const j = await r.json();
      if (!r.ok) throw new Error((j && (j.message || j.error)) || (fn + " failed"));
      return j;
    };

    if (meta.kind === "currency") {
      const out = await rpc("fulfill_currency_purchase", { p_id: meta.payment_id, p_ref: ref });
      return new Response(JSON.stringify({ status: "paid", kind: "currency", result: out }), { headers });
    }

    // Plan purchase. The amount recorded is our own THB figure from the
    // session metadata, not Stripe's charge amount, so a ¥ or US$ sale still
    // lands in the books in baht — same rule the webhook follows.
    const out = await rpc("fulfill_plan_purchase", {
      p_uid: payload.sub,
      p_plan: meta.plan,
      p_days: Math.max(1, parseInt(String(meta.days || "30"), 10)),
      p_amount: parseInt(String(meta.amount_thb || "0"), 10) || Math.round((s.amount_total || 0) / 100),
      p_ref: ref,
      p_email: (s.customer_details && s.customer_details.email) || null,
    });
    return new Response(JSON.stringify({ status: "paid", kind: "plan", result: out }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers });
  }
});
