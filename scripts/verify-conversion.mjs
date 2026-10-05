/* Headless verification of the conversion funnel (owner decision 2026-10-04):
   transpiles the REAL use-conversion.ts with esbuild and drives its phase
   logic with synthetic profiles — the seven-day ladder (welcome d1-3, first-week
   proof d5-6, last-day closing d7), paid-member exclusion, dismissal memory,
   and the song-creation gift flags.

   Rewritten for the 7-day Max trial. It used to assert the 30-day ladder
   (welcome d1-3 / halfway d15-28 / closing d29-30) against a hard-coded
   trialLenDays of 30; both the stub and the day fixtures below now match what
   payment.tsx actually ships, so a future change to TRIAL_DAYS_STANDARD fails
   this file loudly instead of silently testing a ladder that no longer exists.

   The stub is derived from the REAL payment.tsx constants below rather than
   typed in by hand — see TRIAL_DAYS_FROM_SOURCE. */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-conv-verify";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Read the REAL trial length out of payment.tsx so the stub can never drift.
const paymentSrc = readFileSync("payment.tsx", "utf8");
const grab = (name) => {
  const m = paymentSrc.match(new RegExp(`export const ${name}\\s*=\\s*(\\d+)`));
  if (!m) throw new Error(`verify-conversion: cannot read ${name} from payment.tsx`);
  return Number(m[1]);
};
const TRIAL_DAYS_FROM_SOURCE = grab("TRIAL_DAYS_STANDARD");
const FOUNDING_DAYS_FROM_SOURCE = grab("TRIAL_DAYS_FOUNDING");

// esbuild-transpile the real source (repo convention: no hand-mirrored copies)
execSync(`npx esbuild use-conversion.ts --bundle --format=esm --outfile=${OUT}/use-conversion.mjs`, { stdio: "pipe" });
// Stub the only cross-file import (payment.tsx pulls React/Supabase). Both
// helpers the funnel imports have to exist here: trialLenDays for the day
// maths, and isTrialPlan for "are they inside a trial of EITHER tier" — the
// promotion cohort's TRIAL_MAX is a second plan string, and a stub missing it
// would make the funnel look like it only ever ran for Premium trials.
/* The promotion cohort's second plan string. payment.tsx renamed this on
   2026-10-04, when the two-plan change folded "trialmax" into Premium and left
   it as a private constant (`TRIAL_MAX_LEGACY`, no longer exported). This
   script still grepped for the old `export const TRIAL_MAX`, so it threw
   before a single assertion ran — which means the whole conversion funnel had
   been silently unverified in CI since that refactor. Read the name that
   exists now; the assertion below it is unchanged. */
const TRIAL_MAX_LITERAL = (paymentSrc.match(/const TRIAL_MAX_LEGACY\s*=\s*"([^"]+)"/) || [])[1];
if (!TRIAL_MAX_LITERAL) throw new Error("verify-conversion: cannot read TRIAL_MAX_LEGACY from payment.tsx");
// PLAN_PRICE is read out of the real source too: the funnel's quoted prices
// are generated from it, so a stub with made-up numbers would make every
// price assertion below pass no matter what payment.tsx actually says.
const grabPrices = () => {
  const tbl = paymentSrc.match(/export const PLAN_PRICE\s*=\s*\{([^}]+)\}/);
  if (!tbl) throw new Error("verify-conversion: cannot read PLAN_PRICE from payment.tsx");
  const out = {};
  for (const m of tbl[1].matchAll(/(\w+)\s*:\s*(\d+)/g)) out[m[1]] = Number(m[2]);
  return out;
};
const PRICES = grabPrices();
console.log(`\n  (real PLAN_PRICE: premium=${PRICES.premium}, max=${PRICES.max})`);
writeFileSync(`${OUT}/payment.mjs`,
  `export const TRIAL_MAX = ${JSON.stringify(TRIAL_MAX_LITERAL)};\n` +
  `export const PLAN_PRICE = ${JSON.stringify(PRICES)};\n` +
  `export const trialLenDays = (p) => (p && p.founding_member ? ${FOUNDING_DAYS_FROM_SOURCE} : ${TRIAL_DAYS_FROM_SOURCE});\n` +
  `export const isTrialPlan = (p) => p === "trial" || p === TRIAL_MAX;\n`);
// rewrite the import to the stub
let src = readFileSync(`${OUT}/use-conversion.mjs`, "utf8");
src = src.replace(/from\s*"\.\/payment"/, `from "./payment.mjs"`);
writeFileSync(`${OUT}/use-conversion.mjs`, src);

const C = await import(pathToFileURL(`${OUT}/use-conversion.mjs`).href);

let pass = 0, fail = 0;
let p = null;
let ps = null;
function ok(cond, label) { if (cond) { pass++; console.log(`  ok: ${label}`); } else { fail++; console.error(`FAIL: ${label}`); } }

const DAY = 86400000;
// ageDays = full days ago PLUS a 2-minute buffer so "day 7" fixtures land
// firmly inside day 7 regardless of test-execution milliseconds.
const prof = (ageDays, founding = false) => ({ created_at: new Date(Date.now() - (ageDays * DAY + 120 * 1000)).toISOString(), founding_member: founding });

console.log(`\n  (real payment.tsx: TRIAL_DAYS_STANDARD=${TRIAL_DAYS_FROM_SOURCE}, TRIAL_DAYS_FOUNDING=${FOUNDING_DAYS_FROM_SOURCE})`);
ok(TRIAL_DAYS_FROM_SOURCE === 7 && FOUNDING_DAYS_FROM_SOURCE === 7, "payment.tsx ships a 7-day trial for everyone");

// ── trialDay ──
ok(C.trialDay(prof(0)) === 1, "trialDay: signup today = day 1");
ok(C.trialDay(prof(6)) === 7, "trialDay: 6 days ago = day 7 (the last day)");
ok(C.trialDay(prof(7)) === -1, "trialDay: past trial = -1");
ok(C.trialDay(null) === -1, "trialDay: null profile = -1");

// ── welcome window (d1-3) ──
p = C.convPopupFor(prof(0), "trial");
ok(p && p.kind === "welcome" && p.id === "d0", "day 1 → welcome popup");
ok(C.convPopupFor(prof(2), "trial") && C.convPopupFor(prof(2), "trial").kind === "welcome", "day 3 → still welcome");

// ── gap (d4): nothing, without proof ──
ok(C.convPopupFor(prof(3), "trial") === null, "day 4 → no popup (quiet phase)");

// ── closing: the LAST day exactly, never the day before ──
p = C.convPopupFor(prof(5), "trial");
ok(p === null, "day 6 → NOT the closing popup (the day before is not the last day)");
p = C.convPopupFor(prof(6), "trial");
ok(p && p.kind === "closing" && p.id === "closing", "day 7 → closing popup");
p = C.convPopupFor(prof(6.5), "trial");
ok(p && p.kind === "closing", "day 7, later in the day → still closing");
ok(C.convPopupFor(prof(7), "trial") === null, "day 8 → trial over, no popup");

// ── paid members never see any of it ──
ok(C.convPopupFor(prof(0), "premium") === null, "premium → no popup");
ok(C.convPopupFor(prof(0), "max") === null, "max → no popup");
ok(C.convPopupFor(prof(6), "max") === null, "paid max on day 7 → no popup");
ok(C.convPopupFor(null, "trial") === null, "null profile → no popup");

// ── the promotion cohort (TRIAL_MAX) walks the SAME ladder ────────────────
// The first 10,000 signups sit on a second plan string. If the funnel only
// matched plain "trial" they would get a Max entitlement and no sales moment
// at all — free AI for a week, which is the opposite of the promotion.
const promo = "trialmax";
ok(C.convPopupFor(prof(0), promo) && C.convPopupFor(prof(0), promo).kind === "welcome", "promo day 1 → welcome popup");
ok(C.convPopupFor(prof(6), promo) && C.convPopupFor(prof(6), promo).kind === "closing", "promo day 7 → closing popup");
ok(C.convPopupFor(prof(8), promo) === null, "promo day 8 → nothing (trial over)");
ok(C.convWinBack(prof(8), promo) === null, "promo day 8 + still on the trial plan string → no win-back");

// ── win-back: expired trial on free plan ──
p = C.convWinBack(prof(8), "free");
ok(p && p.kind === "winback" && p.id === "wb", "expired + free → win-back popup");
ok(C.convWinBack(prof(2), "free") === null, "still inside trial (free edge) → no win-back");
ok(C.convWinBack(prof(8), "premium") === null, "expired but paying → no win-back");

// ── dismissal memory (per device, once per id) ──
globalThis.localStorage = (() => { let m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; })();
ok(C.convSeen("closing") === false, "dismissal memory: unseen id = false");
C.markConvSeen("closing");
ok(C.convSeen("closing") === true, "dismissal memory: marked id = true");
ok(C.convPopupFor(prof(6), "trial") === null, "dismissed closing doesn't re-fire");

// ── song-creation gift (decision 1A) ──
ok(C.canUseSongGift() === true, "song gift: available before first use");
C.consumeSongGift();
ok(C.canUseSongGift() === false, "song gift: gone after one use (lifetime)");

// ── copy integrity: every language, the ONE tier, and the real prices ──────
/* This block used to loop over two tables — "promo/Max" and "standard/Premium"
   — and assert that each named its own tier and never quoted the other's price.
   The 2026-10-04 two-plan change made that impossible by design:
   STANDARD_COPY is now literally CONV_COPY (one table), and every legacy key in
   PLAN_PRICE carries the Premium price (1490) so an existing subscriber's
   renewal still finds one. Both tables are one table, and "the other tier's
   price" is this tier's price.

   The failure it was written to prevent is still real and still worth pinning —
   telling someone to keep a plan they cannot buy — so it is asserted directly
   instead of through a tier/price cross-check that can no longer discriminate. */
const MAX_PRICE = PRICES.max.toLocaleString("en-US");
const STD_PRICE = PRICES.premium.toLocaleString("en-US");
ok(C.STANDARD_COPY === C.CONV_COPY,
  "the promo and standard copy tables are the same object (two-plan change)");
ok(C.convCheckoutTier(promo) === "premium" && C.convCheckoutTier("trial") === "premium" && C.convCheckoutTier("max") === "premium",
  "the funnel only ever opens checkout for Premium, whatever plan string the member holds");
for (const lang of ["th", "en", "zh"]) {
  const cc = C.CONV_COPY[lang];
  ok(cc && cc.bannerUrgent.includes("{n}") && cc.welcome.title && cc.closing.items && cc.winback.title && cc.closing.cta,
    `copy ${lang}: all keys present`);
  ok(cc && cc.closing.alt && cc.winbackAlt && cc.d7proof.title && cc.proof.title,
    `copy ${lang}: alt + winbackAlt + both proof kinds present`);
  const priced = JSON.stringify(cc);
  ok(priced.includes("Premium"), `copy ${lang}: names the one sellable tier`);
  ok(priced.includes(STD_PRICE), `copy ${lang}: quotes the real Premium price ${STD_PRICE}`);
  ok(!(/"max"|"family"|"maxfamily"/).test(priced),
    `copy ${lang}: never offers a plan id that cannot be bought (max/family/maxfamily)`);
  ok(cc.closing.body.includes(STD_PRICE), `copy ${lang}: last-day body carries the Premium price`);
}

// ── day 7 must state the CONSEQUENCE, not only the price (owner 2026-10-05) ──
/* "ถ้าไม่จ่ายเงิน … คุณจะเหลือแพ็กเกจฟรี และไม่สามารถใช้สิ่งที่เคยใช้ได้ในโปร".
   The old copy only ever said "to keep Premium, pay X" — it never said what
   not paying costs, which is the half of the message that actually decides.

   The trap this block guards, and why `loss` is its own field rather than more
   `body`: personalizedBody() REPLACES closing.body wholesale for any learner
   with proof data (improvedCount >= 1) — i.e. most day-7 members who practised
   at all. A warning folded into `body` would be silently dropped for exactly
   the members with the most to lose, and would only ever survive on the thin
   no-proof fallback. So both halves are pinned here: it is a separate field,
   and App really renders it (a copy field nobody renders promises nothing). */
const FREE_WORD = { th: "ฟรี", en: "Free", zh: "免费" };
const proofish = { improvedCount: 3, bestDelta: 12, sessions: 4 };
for (const lang of ["th", "en", "zh"]) {
  const cl = C.CONV_COPY[lang].closing;
  ok(!!cl.loss && cl.loss.length > 10, `day-7 ${lang}: copy states what you lose if you don't pay`);
  ok(cl.loss.includes(FREE_WORD[lang]), `day-7 ${lang}: the loss line names the Free plan the member is left on`);
  ok(!/\d/.test(cl.loss), `day-7 ${lang}: the loss line carries no price literal (price comes from PLAN_PRICE via body/cta)`);
  const personalized = C.personalizedBody("closing", lang, proofish, cl.body, "trial");
  ok(personalized && personalized !== cl.body,
    `day-7 ${lang}: proof data really does rewrite the closing body (so \`loss\` cannot live inside it)`);
  ok(!personalized.includes(cl.loss),
    `day-7 ${lang}: the loss sentence is absent from the rewritten body — which is why it is a separate field`);
}
const APP = readFileSync("App.tsx", "utf8");
ok(/convPopup\.kind === "closing"\s*&&\s*c\.loss\s*&&/.test(APP),
  "App renders the day-7 loss line inside the closing popup");
ok(APP.includes("convpop-loss"), "App uses the .convpop-loss class");
ok(readFileSync("app-styles.ts", "utf8").includes(".convpop-loss{"), "app-styles.ts defines .convpop-loss");

// ── the copy selector picks the right table, and so does the checkout tier ──
// A hardcoded "max" checkout would send a post-cap member to a plan page for
// something they were never given — the promotion quietly costing real sales.
ok(C.convCopyFor("th", promo) === C.CONV_COPY.th, "convCopyFor: a legacy 'trialmax' member gets the one shared table");
ok(C.convCopyFor("th", "trial") === C.STANDARD_COPY.th, "convCopyFor: post-cap signup gets the same table");
ok(C.convCopyFor("en", promo) === C.CONV_COPY.en, "convCopyFor: english promotion copy");
ok(C.convCopyFor("xx", promo) === C.CONV_COPY.en, "convCopyFor: unknown language falls back to english");
/* The three helpers below deliberately IGNORE their plan argument — the
   two-plan change kept the signatures so no caller had to change. A member
   still carrying a legacy string must hear about the plan they can actually
   buy, and be quoted the Premium price. Asserting that they ignore the
   argument is what stops a second tier quietly reappearing here. */
ok(C.convCheckoutTier(promo) === "premium", "convCheckoutTier: a legacy 'trialmax' member's checkout opens Premium, not Max");
ok(C.convCheckoutTier("trial") === "premium", "convCheckoutTier: trial checkout opens Premium");
ok(C.convCheckoutTier("max") === "premium", "convCheckoutTier: non-trial defaults to Premium, never silently Max");
ok(C.trialPriceThb(promo) === STD_PRICE && C.trialPriceThb("trial") === STD_PRICE,
  "trialPriceThb: every plan string is quoted the one real Premium price, formatted from PLAN_PRICE");
ok(C.trialTierName(promo) === "Premium" && C.trialTierName("trial") === "Premium",
  "trialTierName: the plan argument is ignored — everyone is told Premium");

// ══ v3: Personalized Proof Funnel ══
ok(typeof C.proofStats === "function" && typeof C.proofPopupEligible === "function" && typeof C.firstPaidActivation === "function" && typeof C.personalizedBody === "function" && typeof C.logConvEvent === "function" && !!C.ACTIVATION_COPY, "v3 exports present");

// proofStats: reads the real outcome rows; honest nulls when empty
localStorage.setItem("tg_atip_outcomes", JSON.stringify([
  { resolved: true, outcome: { improved: true, delta: 12 } },
  { resolved: true, outcome: { improved: false, delta: -2 } },
  { resolved: false },
]));
ps = C.proofStats();
ok(ps.resolved === 2 && ps.improvedCount === 1 && ps.bestDelta === 12 && ps.totalDelta === 12, "proofStats: counts resolved/improved/best from real rows");
localStorage.setItem("tg_atip_outcomes", "[]");
ps = C.proofStats();
ok(ps.improvedCount === 0 && ps.bestDelta === null, "proofStats: empty data -> honest zeros/nulls");

// convD7 via convPopupFor: day 5-6 + real proof + unseen + slot free
localStorage.setItem("tg_atip_outcomes", JSON.stringify([{ resolved: true, outcome: { improved: true, delta: 9 } }]));
p = C.convPopupFor(prof(4), "trial");
ok(p && p.id === "d7" && p.kind === "d7proof" && p.proof.bestDelta === 9, "v3: day 5 + proof -> d7proof popup");
ok(C.convPopupFor(prof(3), "trial") === null, "v3: day 4 + proof -> no d7 popup (window opens at d5)");
// Day 7 belongs to the closing popup even when there is proof to show: two
// sales popups on one day is the nudge fatigue the sell gate exists to stop.
// (Clear the dismissal memory first — the test above deliberately dismissed
// "closing", and a dismissed last-day popup must stay dismissed.)
localStorage.removeItem("tg_conv_seen");
ok(C.convPopupFor(prof(6), "trial") && C.convPopupFor(prof(6), "trial").kind === "closing", "v3: day 7 + proof -> closing still wins over d7proof");
C.markConvSeen("closing");
ok(C.convPopupFor(prof(6), "trial") === null, "v3: day 7 dismissed -> nothing, and d7proof does not take over its slot");
localStorage.setItem("tg_atip_outcomes", "[]");
ok(C.convPopupFor(prof(4), "trial") === null, "v3: day 5 without proof -> nothing (no evidence, no pitch)");

// 1-sell-per-day governor
localStorage.setItem("tg_atip_outcomes", JSON.stringify([{ resolved: true, outcome: { improved: true, delta: 9 } }]));
p = C.convPopupFor(prof(4), "trial");
ok(C.sellSlotToday() === 1, "v3: sell slot consumed by the d7 popup");
ok(C.proofPopupEligible(prof(4), "trial") === null, "v3: proof popup blocked when today's slot is used");
localStorage.setItem("tg_sell_day", JSON.stringify({ d: new Date().toDateString(), used: 0 }));
let pp = C.proofPopupEligible(prof(4), "trial");
ok(pp && pp.id === "proof" && pp.kind === "proof", "v3: proof popup fires on a freed slot (win moment)");
ok(C.proofPopupEligible(prof(4), "trial") === null, "v3: proof popup capped at once per 7 days");
ok(C.proofPopupEligible(prof(4), "premium") === null, "v3: proof popup never for paying members");
localStorage.setItem("tg_atip_outcomes", JSON.stringify([{ resolved: true, outcome: { improved: true, delta: 2 } }]));
localStorage.setItem("tg_sell_day", JSON.stringify({ d: new Date().toDateString(), used: 0 }));
localStorage.setItem("tg_proof_last", "0");
ok(C.proofPopupEligible(prof(4), "trial") === null, "v3: bestDelta < 5 -> no proof popup (bar is real improvement)");

// personalized copy: real numbers when proof exists, original copy otherwise
ok(C.personalizedBody("d7proof", "en", { improvedCount: 2, bestDelta: 12, sessions: 5 }, "GEN", promo).includes("+12%"), "v3: en body carries the real number");
ok(C.personalizedBody("d7proof", "th", { improvedCount: 1, bestDelta: 12 }, "GEN", promo).includes("+12%") && /[ก-๙]/.test(C.personalizedBody("d7proof", "th", { improvedCount: 1, bestDelta: 12 }, "GEN", promo)), "v3: th body Thai + number");
ok(C.personalizedBody("d7proof", "zh", { improvedCount: 1, bestDelta: 12 }, "GEN", promo).includes("+12%"), "v3: zh body carries the number");
ok(C.personalizedBody("closing", "en", { improvedCount: 0, bestDelta: null }, "GENERIC", promo) === "GENERIC", "v3: no proof -> honest generic fallback (never a proud zero)");
ok(C.personalizedBody("closing", "en", { improvedCount: 3, bestDelta: 8, sessions: 23 }, null, promo).includes("23 sessions"), "v3: closing personalized names sessions when known");
for (const lang of ["th", "en", "zh"]) {
  const promoBody = C.personalizedBody("closing", lang, { improvedCount: 2, bestDelta: 11, sessions: 4 }, null, promo);
  ok(promoBody.includes(STD_PRICE) && promoBody.includes("Premium"),
    `v3: ${lang} a legacy 'trialmax' member's closing body quotes Premium at ${STD_PRICE}, never a plan that cannot be bought`);
  const stdBody = C.personalizedBody("closing", lang, { improvedCount: 2, bestDelta: 11, sessions: 4 }, null, "trial");
  ok(stdBody.includes(STD_PRICE) && stdBody.includes("Premium") && !stdBody.includes("Max"),
    `v3: ${lang} post-cap closing body quotes Premium at ${STD_PRICE} and never mentions Max`);
}

// post-purchase activation: exactly once, paid only, admins excluded
ok(C.firstPaidActivation("premium") === true, "v3: first paid moment fires activation");
ok(C.firstPaidActivation("premium") === false, "v3: second call - no replay (once per account)");
ok(C.firstPaidActivation("trial") === false && C.firstPaidActivation("free") === false && C.firstPaidActivation("maxfamily") === false, "v3: trial/free/admin never fire activation");
ok(!!(C.ACTIVATION_COPY.th && C.ACTIVATION_COPY.en && C.ACTIVATION_COPY.zh), "v3: activation copy in all 3 languages");

rmSync(OUT, { recursive: true, force: true });
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
