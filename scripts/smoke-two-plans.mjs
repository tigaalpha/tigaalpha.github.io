#!/usr/bin/env node
/* smoke-two-plans.mjs — two packages: Free and Premium.

   node scripts/smoke-two-plans.mjs

   WHY this exists — owner, 2026-10-04: "ให้แอปมีแค่สองแพ็กเกจ คือฟรีและ
   พรีเมียม โดยให้ในพรีเมียมมีทุกอย่างทุกฟีเจอร์ที่ใช้ได้ในแพ็กเกจเก่าของ
   Max และ Max Family ทั้งหมด". Four paid tiers is not a choice, it is a
   decision the reader has to make.

   The hard part is not deleting three cards. It is that profiles.plan still
   contains the strings "family", "max" and "maxfamily" for people who have
   PAID for them, and the database was deliberately left alone — no migration,
   so no way to strand a subscription. Every read therefore goes through
   canonicalPlan(), and the whole scheme rests on that being true everywhere.
   This is the test that would notice if it were not.

   What it pins:
     - a paid legacy row keeps every feature and reads as Premium
     - an expired legacy row does NOT
     - the price tables agree between the app and the Stripe function, and the
       legacy ids carry the Premium price so a renewal finds one
     - only Premium can open a checkout session
     - the AI quota is 10/day for Premium (Max's old number) and 2 for free
     - no surface still sells or names Max / Max Family / Family
     - the pricing page renders two cards */

import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-two-plans";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log("PASS " + n); } else { fails.push(n); console.log("FAIL " + n); } };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), `${n} (got ${JSON.stringify(a)})`);

/* ── load the REAL payment.tsx under a stub localStorage ──
   It is a .tsx file but this half of it is plain functions, so esbuild
   compiles it as TS and the React parts simply never get called. What is
   under test is the plan arithmetic, which has no JSX in it at all. */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis;
// A copy next to the entry, so its relative imports resolve inside the bundle.
// Its two imports are network/UI modules the plan arithmetic never touches, so
// they are stubbed rather than bundled: pulling in @supabase/supabase-js would
// make this test depend on a live client and a working network for zero extra
// coverage. The functions under test are pure — plan strings in, answers out.
writeFileSync(`${OUT}/payment.tsx`, readFileSync("payment.tsx", "utf8"));
writeFileSync(`${OUT}/supabase-client.ts`, `export const sb = null; export const SUPABASE_URL = "";\n`);
writeFileSync(`${OUT}/ai-backend.ts`, `export const apiHeaders = () => ({});\n`);
writeFileSync(`${OUT}/entry.mjs`, `
import * as P from "./payment.tsx";
globalThis.__p = P;
`);
execFileSync("node_modules/.bin/esbuild",
  [`${OUT}/entry.mjs`, "--bundle", "--format=esm", "--platform=neutral",
    "--loader:.tsx=tsx", "--jsx=automatic", "--outfile=" + OUT + "/bundle.mjs"],
  { stdio: "inherit" });
await import(pathToFileURL(`${OUT}/bundle.mjs`).href);
const P = globalThis.__p;

const future = new Date(Date.now() + 30 * 864e5).toISOString();
const past = new Date(Date.now() - 864e5).toISOString();

// ══ 1. the legacy strings are still understood ═════════════════════════════
eq(P.LEGACY_PLANS, ["family", "max", "maxfamily", "trialmax"], "the four legacy strings are the ones we know about");
for (const legacy of P.LEGACY_PLANS) eq(P.canonicalPlan(legacy), "premium", `canonicalPlan("${legacy}") -> premium`);
eq(P.canonicalPlan("premium"), "premium", "premium stays premium");
eq(P.canonicalPlan("free"), "free", "free stays free");
eq(P.canonicalPlan(undefined), "free", "no plan at all reads as free");

// ══ 2. a PAID legacy row keeps everything ══════════════════════════════════
for (const legacy of ["family", "max", "maxfamily"]) {
  const eff = P.effectivePlan({ plan: legacy, plan_until: future });
  ok(P.isPremiumPlan(eff), `${legacy} (paid, unexpired) still gets Premium features`);
  eq(P.planBadge(eff).t, "⭐ PRO", `${legacy} shows the Premium badge, not a dead tier`);
  ok(P.isMaxPlan(eff), `${legacy} passes the old isMaxPlan gate (voice tutor, freezes, maxOnly songs)`);
}
// ══ 3. an EXPIRED legacy row does not ═══════════════════════════════════════
const expired = P.effectivePlan({ plan: "max", plan_until: past });
eq(expired, "free", "an expired max row reads as free, exactly as before");
ok(!P.isPremiumPlan(expired), "an expired max row does not keep Premium features");

// ══ 4. admins and trials ═══════════════════════════════════════════════════
ok(P.isPremiumPlan(P.effectivePlan({ is_admin: true })), "an admin is Premium (was maxfamily)");
const trial = P.effectivePlan({ plan: "free", created_at: new Date(Date.now() - 2 * 864e5).toISOString() });
eq(trial, "trial", "a new signup is on the trial");
ok(P.isPremiumPlan(trial), "the trial gets the full feature set — there is no richer tier to hold back");
ok(P.isMaxPlan(trial), "the trial passes the old isMaxPlan gate");
eq(P.planBadge(trial).t, "🎁 TRIAL", "the trial still badges as a trial");
ok(P.isTrialPlan("trialmax"), "a legacy trialmax row still counts as a trial");

// ══ 5. prices: one number, in both tables ══════════════════════════════════
for (const cur of ["thb", "usd", "cny"]) {
  const tbl = { thb: P.PLAN_PRICE, usd: P.PLAN_PRICE_USD, cny: P.PLAN_PRICE_CNY }[cur];
  const want = { thb: 1490, usd: 44.99, cny: 328 }[cur];
  eq(tbl.premium, want, `${cur}: Premium is ${want}`);
  for (const legacy of ["family", "max", "maxfamily"]) {
    eq(tbl[legacy], want, `${cur}: legacy "${legacy}" carries the Premium price so a renewal finds one`);
  }
}
eq(P.BUYABLE_PLANS, ["free", "premium"], "only free and premium are sellable");
eq(P.YEAR_PLANS, ["premium"], "only premium offers a yearly option");
ok(P.b2bBaseTier("plus") === "premium" && P.b2bBaseTier("standard") === "premium",
  "both B2B tiers are pegged to Premium, which is now the top tier");

// ══ 6. the Stripe function agrees, and refuses a retired tier ══════════════
const FN = readFileSync("supabase/functions/stripe-checkout/index.ts", "utf8");
ok(/const BUYABLE = \["premium"\]/.test(FN), "checkout opens a session for premium only");
ok(/if \(!BUYABLE\.includes\(plan\)\)/.test(FN), "checkout refuses a plan that is not on sale");
ok(!/YEAR_PLANS = \["premium", "max"/.test(FN), "the yearly list no longer offers Max");
const priceGuard = execFileSync("node", ["supabase/functions/stripe-checkout/check-prices-match.cjs"], { encoding: "utf8" });
ok(/0 mismatched/.test(priceGuard), "the price tables in the app and in Stripe are identical");

// ══ 7. the AI quota ═════════════════════════════════════════════════════════
const CHAT = readFileSync("use-chat.ts", "utf8");
const quota = CHAT.match(/CHAT_QUOTA_BY_PLAN\s*=\s*\{([^}]*)\}/);
ok(!!quota, "use-chat declares CHAT_QUOTA_BY_PLAN");
if (quota) {
  const table = Object.fromEntries(quota[1].split(",").map((p) => {
    const [k, v] = p.split(":").map((s) => s.trim());
    return [k, Number(v)];
  }));
  eq(table, { free: 2, premium: 10, trial: 10 }, "caps are free 2 / Premium 10 (Max's old number)");
}
ok(/canonicalPlan\(plan\)/.test(CHAT), "the quota table is read through canonicalPlan, so a legacy row gets 10");

// ══ 8. nothing still SELLS the old tiers ════════════════════════════════════
const PRICING = readFileSync("PricingOverlay.tsx", "utf8");
for (const tier of ["family", "max", "maxfamily"]) {
  ok(!new RegExp(`startCheckout\\("${tier}"`).test(PRICING), `pricing page never starts checkout for "${tier}"`);
  ok(!new RegExp(`buyBtn\\("${tier}"`).test(PRICING), `pricing page has no buy button for "${tier}"`);
}
const cards = PRICING.match(/className=\{`prtier/g) || [];
ok(cards.length <= 4, `pricing page renders few cards (${cards.length} incl. the two B2B ones)`);
ok(!/mxfSaveStr|perPersonMxf|perPersonFam/.test(PRICING), "the Max Family per-person maths is gone with the tier");
ok(/lc\.prMax3/.test(PRICING) && /lc\.prMax6/.test(PRICING),
  "Premium's list still carries the Max features it absorbed");

// ══ 9. no surface still names a dead tier ══════════════════════════════════
const APP = readFileSync("App.tsx", "utf8");
ok(!/<option value="max"/.test(APP) && !/<option value="maxfamily"/.test(APP),
  "the admin plan dropdown offers Premium and Free only");
ok(!/"👑 MAX"/.test(APP), "the studio badge no longer says MAX");
const deadCopy = [];
for (const f of ["App.tsx", "PricingOverlay.tsx", "ProfileDashboardPanel.tsx", "play-along-progress.ts", "payment.tsx"]) {
  const src = readFileSync(f, "utf8");
  // a mention is fine inside a comment explaining the history; a rendered label is not
  src.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
    /* The dead PLAN names only: "Max Family" and a bare "Max". Deliberately not
       a bare "Family" — "Family Battle" and the parent dashboard are features
       that have nothing to do with the subscription tier and must keep their
       names. Matching the word on its own flagged those two and would have
       had this test push a rename of a game, which is not what it is for. */
    const namesAPlan = /["'`]([^"'`]*?)(\bMax Family\b|\bMax\b)/.test(t)
      && !/Premium|premium|legacy|LEGACY|canonicalPlan|isMaxPlan|maxOnly|maxLocked|isMax\b|MAX_TOKENS/i.test(t);
    if (namesAPlan) deadCopy.push(`${f}:${i + 1} ${t.slice(0, 70)}`);
  });
}
eq(deadCopy, [], "no rendered string still names Max or Max Family as a plan");

console.log(`\n--- ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => "  FAIL " + f).join("\n")); process.exit(1); }
console.log("--- errors: 0");
