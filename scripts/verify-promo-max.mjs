/* Headless verification of the PROMOTION plan split (owner decision 2026-10-04):
   the first 10,000 signups get a seven-day trial at MAX; everyone after the
   cap gets the same seven days at PREMIUM.

   Bundles the REAL payment.tsx with esbuild and drives the real functions —
   effectivePlan, promoTrialPlan, isMaxPlan, isTrialPlan, trialLenDays,
   trialDaysLeft, planBadge — with synthetic profiles. This is the one place
   the promotion's whole value is decided (promoTrialPlan), so it is checked
   directly rather than inferred from the funnel.

   Why it matters enough to have its own file: the split is a boolean on a
   profile row, and both halves fail silently if it is wrong. Too wide and
   every signup past 10,000 gets uncapped AI free forever; too narrow and the
   people the promotion was aimed at get Premium and never hear about Max. */
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
ok(P.TRIAL_MAX === "trialmax", "TRIAL_MAX is its own plan string (not a flag on free)");
const paymentSrc = readFileSync("payment.tsx", "utf8");
ok(/export const TRIAL_DAYS_STANDARD = 7/.test(paymentSrc) && /export const TRIAL_DAYS_FOUNDING = 7/.test(paymentSrc),
  "both trial lengths are 7 (the split is tier, not length)");

// ── WHICH trial each cohort gets ───────────────────────────────────────────
ok(P.promoTrialPlan(promoMember()) === P.TRIAL_MAX, "promotion member → TRIAL_MAX");
ok(P.promoTrialPlan(afterCap()) === "trial", "post-cap signup → plain trial (Premium)");
ok(P.effectivePlan(promoMember()) === P.TRIAL_MAX, "effectivePlan: promotion member is on the Max trial");
ok(P.effectivePlan(afterCap()) === "trial", "effectivePlan: post-cap signup is on the Premium trial");

// ── WHAT each cohort actually gets to use ──────────────────────────────────
// This is the assertion that matters: the two cohorts must NOT resolve to the
// same entitlements, or the promotion is a no-op.
ok(P.isMaxPlan(P.effectivePlan(promoMember())) === true, "promotion member gets Max features");
ok(P.isMaxPlan(P.effectivePlan(afterCap())) === false, "post-cap signup does NOT get Max features (this is the cap doing its job)");
ok(P.isMaxPlan(P.effectivePlan(afterCap())) !== P.isMaxPlan(P.effectivePlan(promoMember())),
  "the two cohorts have genuinely different entitlements");

// ── a real purchase always outranks the trial ──────────────────────────────
// These fixtures put created_at ONE day back, so the profile is genuinely
// inside its trial: that is the only state in which "which wins?" is a real
// question. A profile created 90 days ago is simply free, and asserting
// anything else about it tests nothing.
ok(P.effectivePlan({ ...promoMember(1), plan: "max", plan_until: daysAgo(-365) }) === "max",
  "a live Max subscription outranks the promotion trial");
ok(P.effectivePlan({ ...afterCap(1), plan: "max", plan_until: daysAgo(-365) }) === "max",
  "a live Max subscription outranks the plain trial too");
ok(P.effectivePlan({ ...promoMember(1), plan: "max", plan_until: daysAgo(1) }) === P.TRIAL_MAX,
  "a LAPSED subscription falls back to the promotion trial, not to free");
ok(P.effectivePlan({ ...promoMember(1), plan: "max", plan_until: daysAgo(1) }) !== "free",
  "the fallback is the trial, not a hole in the floor");
ok(P.effectivePlan({ is_admin: true }) === "maxfamily", "admins still resolve to maxfamily");
ok(P.effectivePlan(null) === "free", "null profile → free");

// ── the trial ends at seven days for BOTH cohorts ──────────────────────────
ok(P.trialLenDays(promoMember()) === 7 && P.trialLenDays(afterCap()) === 7, "both cohorts get 7 days");
for (const [label, mk] of [["promotion", promoMember], ["post-cap", afterCap]]) {
  ok(P.effectivePlan(mk(0)) !== "free" && P.effectivePlan(mk(6)) !== "free" && P.effectivePlan(mk(7)) === "free",
    `${label}: inside the trial through day 7, free from day 8`);
  ok(P.trialDaysLeft(mk(0)) === 7 && P.trialDaysLeft(mk(6)) === 1 && P.trialDaysLeft(mk(7)) === -1,
    `${label}: countdown reads 7 → 1 → expired`);
}

// ── isTrialPlan covers BOTH tiers — this is the whole point of it ──────────
// Every "is the countdown running / should the funnel fire" question uses this
// instead of `plan === "trial"`. A version that missed TRIAL_MAX would leave
// the first 10,000 with Max access and no sales moment whatsoever.
ok(P.isTrialPlan("trial") === true, "isTrialPlan: plain trial");
ok(P.isTrialPlan(P.TRIAL_MAX) === true, "isTrialPlan: promotion trial");
ok(P.isTrialPlan("free") === false && P.isTrialPlan("max") === false && P.isTrialPlan("premium") === false && P.isTrialPlan("maxfamily") === false,
  "isTrialPlan: false for every real plan");
ok(P.isTrialPlan(null) === undefined || P.isTrialPlan(undefined) === false || P.isTrialPlan(undefined) === undefined,
  "isTrialPlan: does not throw on undefined");

// ── the badge tells the truth about both facts ─────────────────────────────
ok(P.planBadge(P.TRIAL_MAX).t.includes("MAX"), "promotion badge names Max");
ok(P.planBadge(P.TRIAL_MAX).t.includes("TRIAL"), "promotion badge still says it is a trial");
ok(P.planBadge("trial").t === "🎁 TRIAL", "plain trial badge unchanged");

rmSync(OUT, { recursive: true, force: true });
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
