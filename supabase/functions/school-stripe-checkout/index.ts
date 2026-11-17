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

   CURRENCY (2026-11-17): the card is charged in the currency the row says (charge_currency / charge_amount, written by the database from its own
   price table: baht for Thai, yuan for Chinese, US dollars for every other language, the one rule of payment.tsx currencyOf). A row without those
   fields is a baht row and is charged exactly as before. `amount` stays the baht list price (the books). The client may send `expect` (the figure
   it displayed) and `cur`; they are only compared, never used as the amount: a mismatch refuses the sale, the same rule stripe-checkout follows.
   The session metadata must never carry `plan` or `kind`: stripe-webhook fulfils any paid session that has a user_id and a plan.
   A dollar / yuan session is a CARD session: payment_method_types is pinned to card for it (see the comment at the form), so a method the Stripe
   dashboard has switched on that settles later (bank debit, vouchers) can never be offered for it: verify-school-payment only accepts a session that is
   paid when the buyer comes back, and no webhook handles school sessions. A baht session is left exactly as it has always been.

   Secrets (owner sets in Supabase dashboard, never in code):
     STRIPE_SECRET_KEY — sk_live_... / sk_test_...
*/

// smallest units per major unit: all three are two-decimal currencies (satang, cents, fen). A currency that is not listed is refused, never guessed.
const MINOR: Record<string, number> = { thb: 100, usd: 100, cny: 100 };

const SITE = "https://tigaalpha.github.io";
const ALLOW = [SITE, "https://www.tigaalpha.com", "https://tigaalpha.com", "http://localhost:5173", "http://localhost:8080", "http://localhost:4173"];
// the buyer comes back to the domain they paid from (www.tigaalpha.com or the old github.io), never bounced to the other one
function siteOf(req: Request) { const o = req.headers.get("origin"); return o && ALLOW.includes(o) && o.startsWith("https://") ? o : SITE; }
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
    // select=* on purpose: a row made before the currency migration has no charge_* fields and simply reads as baht, so this works on either side of the SQL
    const rowRes = await fetch(`${url}/rest/v1/school_payment_requests?id=eq.${encodeURIComponent(requestId)}&select=*`, { headers: H });
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

    // what the card is charged: the row's own currency and price (written by the database), baht + amount for a row that has neither
    const cur = String(row.charge_currency || "thb").toLowerCase();
    if (!MINOR[cur]) return new Response(JSON.stringify({ error: "bad currency on request" }), { status: 500, headers });
    const charge = cur === "thb" ? amount : Number(row.charge_amount);
    if (!Number.isFinite(charge) || charge <= 0) {
      return new Response(JSON.stringify({ error: "bad amount on request" }), { status: 500, headers });
    }
    // Never charge a price the buyer was not shown. `cur` / `expect` are what the modal displayed: compared here, never used as the amount.
    // The currency is compared first: two amounts in different currencies cannot be compared at all.
    const shownCur = body && typeof body.cur === "string" ? body.cur.toLowerCase() : "";
    if (shownCur && shownCur !== cur) {
      console.error("school-stripe-checkout refused: currency_mismatch " + JSON.stringify({ requestId, shown: shownCur, computed: cur }));
      return new Response(JSON.stringify({ error: "currency_mismatch", shown: shownCur, computed: cur }), { status: 409, headers });
    }
    const shown = body && body.expect;
    if (typeof shown === "number" && Number.isFinite(shown) && Math.abs(shown - charge) > 0.011) {
      console.error("school-stripe-checkout refused: price_mismatch " + JSON.stringify({ requestId, shown, computed: charge, currency: cur }));
      return new Response(JSON.stringify({ error: "price_mismatch", shown, computed: charge, currency: cur }), { status: 409, headers });
    }

    const tierLabel = row.tier === "school_plus" ? "Plus" : "Standard";
    const name = `TiGA School Plan ${tierLabel} — ${row.seats} seats (${row.cycle === "year" ? "1 year" : "1 month"})`;

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("client_reference_id", requestId);
    // session_id is what verify-school-payment re-checks against Stripe on return.
    form.set("success_url", `${siteOf(req)}/?school_paid=1&req=${encodeURIComponent(requestId)}&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${siteOf(req)}/?school_paid=0`);
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", cur);   // thb unless the row says usd / cny
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(charge * MINOR[cur]))); // satang / cents / fen
    form.set("line_items[0][price_data][product_data][name]", name);
    form.set("metadata[request_id]", requestId);
    form.set("metadata[user_id]", payload.sub);
    form.set("metadata[seats]", String(row.seats));
    form.set("metadata[tier]", String(row.tier));
    form.set("metadata[amount_thb]", String(amount));
    if (cur !== "thb") {
      form.set("metadata[currency]", cur); form.set("metadata[charge_amount]", String(charge));
      // card only for a dollar / yuan session (the button says "Pay by card"). Without this the session offers whatever the Stripe dashboard has enabled for the
      // currency, and a method that settles days later leaves payment_status "unpaid" at the redirect, which verify-school-payment answers with "unpaid" and no
      // webhook ever completes. A baht session is NOT touched (byte for byte what it has always sent).
      form.set("payment_method_types[0]", "card");
    }

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
