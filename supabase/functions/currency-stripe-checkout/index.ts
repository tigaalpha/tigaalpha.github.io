import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/* Creates a Stripe Checkout Session for a coin or gem package.

   The shop was QR-and-slip only, which meant a card-only buyer could not spend
   money here at all and every purchase needed a human to approve a slip. Same
   rule as the other two checkouts: the client sends only the id of a pending
   `payments` row it already created through submit_currency_purchase(), and the
   price is read back out of that row with the service key. Nothing the browser
   sends can set a price.

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
      return new Response(JSON.stringify({ mode: key.startsWith("sk_live_") ? "live" : "test" }), { headers });
    }

    const requestId = String((body && body.requestId) || "");
    if (!requestId) return new Response(JSON.stringify({ error: "requestId required" }), { status: 400, headers });

    const H = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };
    const rowRes = await fetch(`${url}/rest/v1/payments?id=eq.${encodeURIComponent(requestId)}&select=id,user_id,amount,status,kind,currency_type,currency_amount`, { headers: H });
    const rows = await rowRes.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || row.kind !== "currency") return new Response(JSON.stringify({ error: "purchase not found" }), { status: 404, headers });
    if (row.user_id !== payload.sub) return new Response(JSON.stringify({ error: "not your purchase" }), { status: 403, headers });
    if (row.status !== "pending") return new Response(JSON.stringify({ error: "purchase is " + row.status }), { status: 409, headers });

    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "bad amount on purchase" }), { status: 500, headers });
    }

    const unit = row.currency_type === "gems" ? "Gems" : "Coins";
    const name = `TiGA ${Number(row.currency_amount).toLocaleString("en-US")} ${unit}`;

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("client_reference_id", requestId);
    form.set("success_url", `${SITE}/?coins_paid=1&req=${encodeURIComponent(requestId)}&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${SITE}/?coins_paid=0`);
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "thb");   // packages are priced in baht only
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100))); // satang
    form.set("line_items[0][price_data][product_data][name]", name);
    // `kind` is what verify-stripe-payment and the webhook route on.
    form.set("metadata[kind]", "currency");
    form.set("metadata[payment_id]", requestId);
    form.set("metadata[user_id]", payload.sub);
    form.set("metadata[currency_type]", String(row.currency_type));
    form.set("metadata[currency_amount]", String(row.currency_amount));
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
