import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/* Creates a Stripe Checkout Session for a School Plan Pro (B2B) request.

   The client never sends an amount. It sends only the id of a row it already
   created through school_submit_payment_request(), and the amount is read back
   out of that row with the service key — the same rule the consumer checkout
   follows, for the same reason: a seat count typed into a browser must not be
   able to set its own price.

   The consumer flow leans on the Stripe webhook to fulfil. This one does not:
   its success URL carries the session id back to the app, which calls
   verify-school-payment to re-check the session against Stripe directly. A
   school sale is a handful of transactions a month and a missed webhook would
   strand a paying institution, so it verifies on return rather than waiting.

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
    if (!key) return new Response(JSON.stringify({ error: "Stripe not configured", mode: "none" }), { status: 503, headers });
    if (!url || !svc) return new Response(JSON.stringify({ error: "not configured" }), { status: 503, headers });

    const body = await req.json();
    if (body && body.probe === true) {
      // Live keys come in two shapes: the standard secret key (sk_live_) and a
      // restricted key (rk_live_), which is what Stripe nudges you toward for
      // least privilege. Checking only sk_live_ would report a perfectly good
      // restricted key as "test" and keep the card button hidden for good.
      const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");
      return new Response(JSON.stringify({ mode: live ? "live" : "test" }), { headers });
    }

    const requestId = String((body && body.requestId) || "");
    if (!requestId) return new Response(JSON.stringify({ error: "requestId required" }), { status: 400, headers });

    const H = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };
    const rowRes = await fetch(`${url}/rest/v1/school_payment_requests?id=eq.${encodeURIComponent(requestId)}&select=id,requester_id,institution_name,tier,seats,cycle,amount,status`, { headers: H });
    const rows = await rowRes.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return new Response(JSON.stringify({ error: "request not found" }), { status: 404, headers });
    // The row must belong to the caller. Without this anyone signed in could
    // pay against — and therefore read the details of — another school's request.
    if (row.requester_id !== payload.sub) {
      return new Response(JSON.stringify({ error: "not your request" }), { status: 403, headers });
    }
    if (row.status === "paid") return new Response(JSON.stringify({ error: "already paid" }), { status: 409, headers });

    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "bad amount on request" }), { status: 500, headers });
    }

    const tierLabel = row.tier === "school_plus" ? "Plus" : "Standard";
    const name = `TiGA School Plan ${tierLabel} — ${row.seats} seats (${row.cycle === "year" ? "1 year" : "1 month"})`;

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("client_reference_id", requestId);
    // session_id is what verify-school-payment re-checks against Stripe on return.
    form.set("success_url", `${SITE}/?school_paid=1&req=${encodeURIComponent(requestId)}&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${SITE}/?school_paid=0`);
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "thb");   // B2B seats are priced in baht only
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100))); // satang
    form.set("line_items[0][price_data][product_data][name]", name);
    form.set("metadata[request_id]", requestId);
    form.set("metadata[user_id]", payload.sub);
    form.set("metadata[seats]", String(row.seats));
    form.set("metadata[tier]", String(row.tier));
    form.set("metadata[amount_thb]", String(amount));

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error((d && d.error && d.error.message) || ("Stripe " + r.status));
    return new Response(JSON.stringify({ url: d.url }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers });
  }
});
