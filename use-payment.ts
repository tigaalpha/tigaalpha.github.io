import { useState, useEffect } from "react";
import { isPremium, getPlan, effectivePlan, setPlanLS, setPremiumLS, CURRENCY_BY_LANG, planPriceByCur, yearPriceByCur, yearPrice, PLAN_PRICE } from "./payment";
import { getAC, playUi } from "./music-engine";
import { sb, SUPABASE_URL } from "./supabase-client";
import { apiHeaders } from "./ai-backend";
/* ── use-payment.ts ──
   Owns PianoApp's payment/plan state and handlers: the live premium/plan
   (kept in sync with the server-authoritative profile), the pricing-modal
   open flag, the two checkout-modal payloads (consumer + School Plan Pro),
   the billing-cycle toggle, the PromptPay display config, and the Stripe
   success-redirect banners for both the consumer and school flows.
   Extracted from PianoApp verbatim as part of the Phase 3 Category B
   (closure/hook) extraction — no logic changes. First hook extracted,
   deliberately chosen as the lowest-blast-radius target to validate the
   pattern: the hook returns every value/setter/handler under its ORIGINAL
   name, so every other place in PianoApp that already referenced these
   identifiers (JSX, other handlers, other effects) needs zero changes —
   only the single destructuring call site changes.
   mascot()/requireLogin() are PianoApp closures (not top-level, not
   exported), so they're threaded in as params, same convention used
   throughout Phase 2 for PianoApp-internal callbacks. ── */
export function usePayment({ profile, session, setProfile, lang, mascot, requireLogin }) {
  const [premium, setPremium] = useState(isPremium());
  const [plan, setPlan] = useState(getPlan());   // free | premium | family | max — switchable any time
  // keep the live plan/premium in sync with the authoritative server profile
  useEffect(() => {
    const active = effectivePlan(profile);
    setPlan(active); setPremium(active !== "free");
    try { setPlanLS(active); } catch (e) {}
  }, [profile]);

  const [pricingOpen, setPricingOpen] = useState(false);
  const [checkout, setCheckout] = useState(null);   // {plan, amount} → PromptPay payment modal
  const [schoolCheckout, setSchoolCheckout] = useState(null); // {tier} → School Plan Pro (B2B) checkout modal
  const [schoolPayReturn, setSchoolPayReturn] = useState<null|"pending"|"paid"|"error">(null); // ?school_paid=1 return state
  const [billCycle, setBillCycle] = useState("month"); // pricing view: month | year
  const [payCfg, setPayCfg] = useState(null);       // { promptpay, name, bank } from app_settings
  const [stripeReturn, setStripeReturn] = useState<null|"pending"|"done">(null); // ?paid=1 return state

  // Detect Stripe success redirect (?paid=1) — clear URL param, refresh profile after webhook delay
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("paid") !== "1") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("paid");
    window.history.replaceState({}, "", url.pathname + (url.search || ""));
    setStripeReturn("pending");
    playUi("levelup");
    // Give Stripe webhook ~4s to update the profile, then re-fetch
    const t = setTimeout(() => {
      sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle()
        .then(({ data }) => { if (data) { setProfile(data); } setStripeReturn("done"); });
      setTimeout(() => setStripeReturn(null), 4000);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  // Detect School Plan Pro Stripe success redirect (?school_paid=1&req=&session_id=) —
  // clear the URL params, then verify server-side with Stripe (no webhook dependency,
  // unlike the consumer flow above — verify-school-payment re-checks the session
  // directly using the secret key before ever marking the request "paid").
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("school_paid") == null) return;
    const reqId = p.get("req"), sessionId = p.get("session_id");
    const url = new URL(window.location.href);
    url.searchParams.delete("school_paid"); url.searchParams.delete("req"); url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.pathname + (url.search || ""));
    if (p.get("school_paid") !== "1" || !reqId || !sessionId) return;
    setSchoolPayReturn("pending");
    fetch(SUPABASE_URL + "/functions/v1/verify-school-payment", {
      method: "POST", headers: { ...apiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: reqId, sessionId }),
    }).then(r => r.json()).then(j => {
      setSchoolPayReturn(j && j.status === "paid" ? "paid" : "error");
      playUi(j && j.status === "paid" ? "levelup" : "click");
    }).catch(() => setSchoolPayReturn("error"));
  }, []);

  // load the shop's PromptPay config (for the checkout QR)
  useEffect(() => {
    if (!session) return;
    sb.from("app_settings").select("value").eq("key", "payment").maybeSingle()
      .then(({ data }) => setPayCfg((data && data.value) || null), () => {});
  }, [session]);

  // Switch to any plan at any time (upgrade/downgrade). Demo activation — wire a
  // real gateway (Omise / LINE Pay / Stripe) per tier for production.
  function choosePlan(p) {
    const paid = p !== "free";
    setPlanLS(p); setPlan(p);
    setPremiumLS(paid); setPremium(paid);
    if (paid) { setPricingOpen(false); getAC(); playUi("levelup"); mascot("celebrate", 3200); }
    else { playUi("click"); }
  }
  // open the checkout modal — carries THB amount (for slip records) + display currency
  function startCheckout(planId, cycle = "month") {
    if (requireLogin()) return; // buying a plan means tying it to a real account
    playUi("click"); setPricingOpen(false);
    const yr = cycle === "year";
    const cur = CURRENCY_BY_LANG[lang] || "thb";
    const disp = yr ? yearPriceByCur(cur, planId) : planPriceByCur(cur, planId);
    setCheckout({ plan: planId, amount: yr ? yearPrice(planId) : (PLAN_PRICE[planId] || 0), disp, cur, cycle, days: yr ? 365 : 30 });
  }
  function activatePremium() { choosePlan("premium"); }
  return { premium, setPremium, plan, setPlan, pricingOpen, setPricingOpen, checkout, setCheckout, schoolCheckout, setSchoolCheckout, billCycle, setBillCycle, payCfg, stripeReturn, schoolPayReturn, choosePlan, startCheckout, activatePremium };
}
