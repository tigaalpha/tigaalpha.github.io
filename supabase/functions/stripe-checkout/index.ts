import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/* Creates a Stripe Checkout Session for a plan. Amount and duration are
   computed HERE from the plan id + currency — the client can never set its
   own price. Currencies mirror the app language (th→thb, en→usd, zh→cny);
   every currency is payable by card worldwide.
   Secrets (owner sets in Supabase dashboard, never in code):
     STRIPE_SECRET_KEY — sk_live_... / sk_test_...

   ── PRICES MUST MATCH payment.tsx ──
   This table is the SAME price list the app shows on its pricing cards:
   PLAN_PRICE / PLAN_PRICE_USD / PLAN_PRICE_CNY in payment.tsx. They drifted
   apart once and it was expensive in both directions — a Thai Max Family
   buyer saw ฿9,999 and this file charged ฿4,919 (฿59,131 short on the yearly
   plan), while Premium showed ฿1,490 and charged ฿1,499, i.e. more than was
   advertised. Two consequences, so two defences:
     1. the tables below are copied from payment.tsx verbatim, and the yearly
        rounding rule matches yearPriceByCur() exactly (2 dp for USD, whole
        units for THB/CNY — this file used to round everything to 2 dp, which
        by itself put the ¥ and ฿ yearly totals a fraction out);
     2. the client sends the price it DISPLAYED as `expect`, and a session is
        refused outright if it disagrees with what is computed here. The price
        is still server-side and unspoofable — `expect` is never used as the
        amount, only compared against it — but a future edit to one table and
        not the other now fails loudly instead of silently charging the wrong
        person the wrong money. */
const PRICES: Record<string, Record<string, number>> = {
  thb: { premium: 1490,  family: 2900,  max: 3999,   maxfamily: 9999   },
  usd: { premium: 44.99, family: 89.99, max: 119.99, maxfamily: 149.99 },
  cny: { premium: 328,   family: 648,   max: 888,    maxfamily: 1088   },
};
const LABELS: Record<string, string> = { premium: "TiGA AI Premium", family: "TiGA AI Family", max: "TiGA AI Max", maxfamily: "TiGA AI Max Family" };
const YEAR_PLANS = ["premium", "max", "maxfamily"];
const SITE = "https://tigaalpha.github.io";

// yearly = 12 months − 3%, rounded the way yearPriceByCur() rounds
const yearOf = (cur: string, monthly: number) => {
  const n = monthly * 12 * 0.97;
  return cur === "usd" ? Math.round(n * 100) / 100 : Math.round(n);
};

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
    if (!key) return new Response(JSON.stringify({ error: "Stripe not configured" }), { status: 503, headers });

    const { plan, cycle, cur, expect } = await req.json();
    const currency = ["thb", "usd", "cny"].includes(cur) ? cur : "thb";
    const monthly = PRICES[currency][plan];
    if (!monthly) return new Response(JSON.stringify({ error: "Unknown plan" }), { status: 400, headers });
    const yearly = cycle === "year" && YEAR_PLANS.includes(plan);
    const amount = yearly ? yearOf(currency, monthly) : monthly;
    const days = yearly ? 365 : 30;
    // ฿ equivalent from OUR OWN table — the webhook records THB for the books
    const thbMonthly = PRICES.thb[plan];
    const amountTHB = yearly ? yearOf("thb", thbMonthly) : thbMonthly;

    // Never charge a price the buyer was not shown. `expect` is the figure on
    // the pricing card they clicked; if the two tables have drifted apart this
    // refuses the sale instead of quietly billing a different number.
    if (typeof expect === "number" && Number.isFinite(expect) && Math.abs(expect - amount) > 0.011) {
      return new Response(JSON.stringify({
        error: "price_mismatch",
        detail: `The app showed ${expect} ${currency.toUpperCase()} but checkout computed ${amount}. Refusing to charge a price that was not displayed — the price tables in payment.tsx and stripe-checkout have drifted apart.`,
        shown: expect, computed: amount, currency,
      }), { status: 409, headers });
    }

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("client_reference_id", payload.sub);
    form.set("success_url", SITE + "/?paid=1");
    form.set("cancel_url", SITE + "/?paid=0");
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", currency);
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100))); // satang / cents / fen
    form.set("line_items[0][price_data][product_data][name]", (LABELS[plan] || plan) + (yearly ? " (1 year)" : " (1 month)"));
    form.set("metadata[user_id]", payload.sub);
    form.set("metadata[plan]", plan);
    form.set("metadata[days]", String(days));
    form.set("metadata[amount_thb]", String(amountTHB));
    form.set("metadata[currency]", currency);

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
