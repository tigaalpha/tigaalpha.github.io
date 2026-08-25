import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/* Stripe webhook: fulfills paid Checkout Sessions — sets the user's plan and
   records a payments row. Deployed with verify_jwt=false (Stripe cannot send
   a Supabase JWT); authentication is the Stripe signature check below.
   Secrets (owner sets in Supabase dashboard, never in code):
     STRIPE_WEBHOOK_SECRET — whsec_... (from the Stripe webhook endpoint)
   Register the endpoint in Stripe as:
     https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/stripe-webhook
   listening to event: checkout.session.completed

   Checked into the repo so it can be reviewed and re-deployed from source.
   Its sibling stripe-checkout only ever existed on the server, which is how
   its price table silently drifted away from the app's. */

async function validSignature(raw: string, sigHeader: string | null, secret: string) {
  try {
    if (!sigHeader) return false;
    const parts = Object.fromEntries(sigHeader.split(",").map(kv => kv.split("=") as [string, string]));
    const t = parts["t"], v1 = parts["v1"];
    if (!t || !v1) return false;
    if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // 5-min replay window
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", k, enc.encode(t + "." + raw));
    const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (hex.length !== v1.length) return false;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
    return diff === 0;
  } catch (_e) { return false; }
}

serve(async (req) => {
  const headers = { "Content-Type": "application/json" };
  try {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const url = Deno.env.get("SUPABASE_URL");
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret || !url || !svc) return new Response(JSON.stringify({ error: "not configured" }), { status: 503, headers });

    const raw = await req.text();
    if (!(await validSignature(raw, req.headers.get("stripe-signature"), secret))) {
      return new Response(JSON.stringify({ error: "bad signature" }), { status: 400, headers });
    }
    const event = JSON.parse(raw);
    if (event.type === "checkout.session.completed") {
      const s = event.data && event.data.object;
      const meta = (s && s.metadata) || {};
      const uid = meta.user_id || (s && s.client_reference_id);
      const plan = meta.plan;
      const days = Math.max(1, parseInt(meta.days || "30", 10));
      if (s && s.payment_status === "paid" && uid && plan) {
        const until = new Date(Date.now() + days * 86400000).toISOString();
        const H = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };
        await fetch(url + "/rest/v1/profiles?id=eq." + uid, {
          method: "PATCH", headers: { ...H, Prefer: "return=minimal" },
          body: JSON.stringify({ plan, plan_until: until, updated_at: new Date().toISOString() }),
        });
        // books stay in THB: prefer our own metadata over Stripe's charge
        // currency (a ¥888 or US$119.99 charge still records its ฿ price)
        const amountTHB = parseInt(meta.amount_thb || "0", 10) || Math.round((s.amount_total || 0) / 100);
        const curNote = meta.currency && meta.currency !== "thb" ? " " + meta.currency + ":" + ((s.amount_total || 0) / 100) : "";
        await fetch(url + "/rest/v1/payments", {
          method: "POST", headers: { ...H, Prefer: "return=minimal" },
          body: JSON.stringify({
            user_id: uid,
            email: (s.customer_details && s.customer_details.email) || null,
            plan, amount: amountTHB, days,
            method: "stripe", status: "approved",
            note: "stripe:" + s.id + curNote, reviewed_at: new Date().toISOString(),
          }),
        });
      }
    }
    return new Response(JSON.stringify({ received: true }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers });
  }
});
