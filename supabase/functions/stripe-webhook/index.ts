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

    /* Owner-only configuration self-check.

       In live mode Stripe offers no "send test event" button — fake events are
       a sandbox-only feature — so the usual way to discover that the signing
       secret was pasted wrong is a real customer paying and the fulfilment
       silently not firing. This reports the SHAPE of the secret (present,
       prefix, length, stray whitespace), never the secret itself, which is
       enough to catch every realistic paste error: a truncated copy, a
       leading space, or the wrong string entirely.

       It is not a public probe. This function runs with verify_jwt=false so
       that Stripe can reach it, which means anyone can POST here; the check is
       therefore gated on the project service key, which only the owner and the
       server ever hold. Without that header this is dead code to the outside
       world. */
    if (req.headers.get("x-config-check") === svc) {
      return new Response(JSON.stringify({
        secret_present: true,
        starts_with_whsec: secret.startsWith("whsec_"),
        length: secret.length,
        has_edge_whitespace: secret !== secret.trim(),
      }), { headers });
    }

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
      if (s && s.payment_status === "paid") {
        const H = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };
        const ref = "stripe:" + s.id;
        /* Both fulfilment paths — this webhook and the app's verify-on-return
           call — run these same two functions. They key off the Checkout
           Session id and do nothing on a second run, so whichever arrives
           first does the work and the other is a no-op. */
        const rpc = (fn: string, args: Record<string, unknown>) =>
          fetch(url + "/rest/v1/rpc/" + fn, { method: "POST", headers: H, body: JSON.stringify(args) });

        if (meta.kind === "currency" && meta.payment_id) {
          await rpc("fulfill_currency_purchase", { p_id: meta.payment_id, p_ref: ref });
        } else if (uid && plan) {
          // books stay in THB: prefer our own metadata over Stripe's charge
          // currency (a ¥888 or US$119.99 charge still records its ฿ price)
          const amountTHB = parseInt(meta.amount_thb || "0", 10) || Math.round((s.amount_total || 0) / 100);
          await rpc("fulfill_plan_purchase", {
            p_uid: uid, p_plan: plan, p_days: days, p_amount: amountTHB, p_ref: ref,
            p_email: (s.customer_details && s.customer_details.email) || null,
          });
        }
      }
    }
    return new Response(JSON.stringify({ received: true }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers });
  }
});
