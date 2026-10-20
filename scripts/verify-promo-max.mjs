/* Headless verification of the promotion + plan ladder (owner decisions:
   2026-10-04 "the first 10,000 signups try the expensive plan", then the
   two-package simplification "แค่สองแพ็กเกจ ฟรี กับ พรีเมียม" — shipped in
   c640d995, which superseded this file's original MAX-vs-PREMIUM split).

   Where the design landed: ONE seven-day trial for everyone (promoTrialPlan
   no longer branches on founding_member), one paid tier — Premium — holding
   everything Max / Max Family used to gate, and the four legacy plan strings
   still sitting in profiles.plan folding into Premium through canonicalPlan()
   so a paid-for row is never stranded. PROMO_MAX_USERS and the
   founding_member column stay as history (the trigger still writes it); the
   app no longer reads them to decide entitlements.

   Bundles the REAL payment.tsx with esbuild and drives the real functions —
   effectivePlan, promoTrialPlan, isMaxPlan, isTrialPlan, trialLenDays,
   trialDaysLeft, canonicalPlan, planBadge — with synthetic profiles.

   Why it matters enough to have its own file: every one of these fails
   SILENTLY if it is wrong. Too wide and free accounts get paid features;
   too narrow and a paying member (or a trial still counting down) is told
   they have nothing — the two failure modes the fold and isTrialPlan's
   legacy branch exist to prevent. */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-promo-verify";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execSync(`npx esbuild payment.tsx --bundle --format=esm --platform=node --outfile=${OUT}/payment.mjs`, { stdio: "pipe" });

// localStorage, because payment.tsx reads it in getPlan()/isMaxPlan() fallback.
globalThis.localStorage = (() => { let m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; })();

const P = await import(pathToFileURL(`${OUT}/payment.mjs`).href);

let pass = 0, fail = 0;
function ok(cond, label) { if (cond) { pass++; console.log(`  ok: ${label}`); } else { fail++; console.error(`FAIL: ${label}`); } }

const DAY = 86400000;
const daysAgo = (n) => new Date(Date.now() - (n * DAY + 120 * 1000)).toISOString();
// founding_member=true is what the handle_new_user() trigger sets for the
// first PROMO_MAX_USERS signups; false is everyone after the cap.
const promoMember = (ageDays = 0) => ({ created_at: daysAgo(ageDays), founding_member: true });
const afterCap = (ageDays = 0) => ({ created_at: daysAgo(ageDays), founding_member: false });

// ── the cap itself ────────────────────────────────────────────────────────
ok(P.PROMO_MAX_USERS === 10000, "PROMO_MAX_USERS is 10,000");
ok(!("TRIAL_MAX" in P), "TRIAL_MAX is gone as an exported tier (two-package redesign)");
ok(P.LEGACY_PLANS.join() === "family,max,maxfamily,trialmax", "the four legacy plan strings are still named for the fold");
ok(P.canonicalPlan("trialmax") === "premium" && P.canonicalPlan("max") === "premium" && P.canonicalPlan("maxfamily") === "premium" && P.canonicalPlan("family") === "premium",
  "every legacy paid row folds into Premium — a paid-for subscription is never stranded");
const paymentSrc = readFileSync("payment.tsx", "utf8");
ok(/export const TRIAL_DAYS_STANDARD = 7/.test(paymentSrc) && /export const TRIAL_DAYS_FOUNDING = 7/.test(paymentSrc),
  "both trial lengths are 7 (the split is tier, not length)");

// ── WHICH trial each cohort gets ───────────────────────────────────────────
// One answer for everyone since c640d995 — pinning that the founding_member
// flag genuinely stops mattering is the redesign's own regression test.
ok(P.promoTrialPlan(promoMember()) === "trial", "promotion member → the one trial");
ok(P.promoTrialPlan(afterCap()) === "trial", "post-cap signup → the same trial");
ok(P.promoTrialPlan(promoMember()) === P.promoTrialPlan(afterCap()), "founding_member no longer changes which trial you get");
ok(P.effectivePlan(promoMember()) === "trial", "effectivePlan: promotion member is on the trial");
ok(P.effectivePlan(afterCap()) === "trial", "effectivePlan: post-cap signup is on the same trial");

// ── WHAT each cohort actually gets to use ──────────────────────────────────
// One tier means both cohorts resolve to the SAME entitlements — that is the
// design, not a bug, and this is where a silent regression back to a split
// (or a fold that went missing) would show up first. The funnel still has
// somewhere to go only by NOT being free.
ok(P.isMaxPlan(P.effectivePlan(promoMember())) === true, "promotion member gets the full feature set");
ok(P.isMaxPlan(P.effectivePlan(afterCap())) === true, "post-cap signup gets the SAME full feature set (one tier)");
ok(P.isMaxPlan(P.effectivePlan(afterCap())) === P.isMaxPlan(P.effectivePlan(promoMember())),
  "both cohorts have genuinely identical entitlements — by design");
ok(P.isMaxPlan("free") === false, "free is not Max (the trial funnel still has somewhere to go)");

// ── a real purchase always outranks the trial ──────────────────────────────
// These fixtures put created_at ONE day back, so the profile is genuinely
// inside its trial: that is the only state in which "which wins?" is a real
// question. A profile created 90 days ago is simply free, and asserting
// anything else about it tests nothing.
ok(P.effectivePlan({ ...promoMember(1), plan: "max", plan_until: daysAgo(-365) }) === "premium",
  "a live legacy Max row folds into Premium — kept, not dropped");
ok(P.isMaxPlan(P.effectivePlan({ ...promoMember(1), plan: "max", plan_until: daysAgo(-365) })) === true,
  "and that folded row still unlocks everything");
ok(P.effectivePlan({ ...afterCap(1), plan: "max", plan_until: daysAgo(-365) }) === "premium",
  "the fold is the same for anyone holding one");
ok(P.effectivePlan({ ...promoMember(1), plan: "max", plan_until: daysAgo(1) }) === "trial",
  "a LAPSED subscription falls back to the trial, not to free");
ok(P.effectivePlan({ ...promoMember(1), plan: "max", plan_until: daysAgo(1) }) !== "free",
  "the fallback is the trial, not a hole in the floor");
ok(P.effectivePlan({ is_admin: true }) === "premium", "admins resolve to Premium (maxfamily is history)");
ok(P.effectivePlan(null) === "free", "null profile → free");

// ── the trial ends at seven days for BOTH cohorts ──────────────────────────
ok(P.trialLenDays(promoMember()) === 7 && P.trialLenDays(afterCap()) === 7, "both cohorts get 7 days");
for (const [label, mk] of [["promotion", promoMember], ["post-cap", afterCap]]) {
  ok(P.effectivePlan(mk(0)) !== "free" && P.effectivePlan(mk(6)) !== "free" && P.effectivePlan(mk(7)) === "free",
    `${label}: inside the trial through day 7, free from day 8`);
  ok(P.trialDaysLeft(mk(0)) === 7 && P.trialDaysLeft(mk(6)) === 1 && P.trialDaysLeft(mk(7)) === -1,
    `${label}: countdown reads 7 → 1 → expired`);
}

// ── isTrialPlan covers BOTH flavours of row that carry a countdown ─────────
// Every "is the countdown running / should the funnel fire" question uses this
// instead of `plan === "trial"`. The legacy branch matters exactly as long as
// founding_member rows exist: a first-10,000 account mid-trial still carries
// "trialmax" in profiles.plan and must keep its countdown (c640d995 comment:
// folding it first answers the wrong question).
ok(P.isTrialPlan("trial") === true, "isTrialPlan: plain trial");
ok(P.isTrialPlan("trialmax") === true, "isTrialPlan: a legacy founding-member row mid-trial still counts");
ok(P.isTrialPlan("free") === false && P.isTrialPlan("premium") === false && P.isTrialPlan("max") === false && P.isTrialPlan("maxfamily") === false && P.isTrialPlan("family") === false,
  "isTrialPlan: false for every real plan");
ok(P.isTrialPlan(null) === undefined || P.isTrialPlan(undefined) === false || P.isTrialPlan(undefined) === undefined,
  "isTrialPlan: does not throw on undefined");

// ── the badge tells the truth about both facts ─────────────────────────────
// Two badges exist now: the trial and Premium. The fold happens BEFORE the
// badge ever sees the string, so no legacy id can resurrect a MAX badge.
ok(P.planBadge("trial").t === "🎁 TRIAL", "plain trial badge unchanged");
ok(P.planBadge("premium").t === "⭐ PRO", "premium badge names Pro");
ok(P.planBadge("max").t === "⭐ PRO" && P.planBadge("trialmax").t === "⭐ PRO" && P.planBadge("maxfamily").t === "⭐ PRO" && P.planBadge("family").t === "⭐ PRO",
  "every legacy paid string badges as Premium — folded first, no MAX badge left");
ok(P.planBadge("free") === null, "free carries no badge (nothing is pretended)");

rmSync(OUT, { recursive: true, force: true });
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
