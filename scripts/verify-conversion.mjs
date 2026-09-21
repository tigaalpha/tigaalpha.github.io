/* Headless verification of the conversion funnel (owner-approved strategy
   2026-09-19): transpiles the REAL use-conversion.ts with esbuild and drives
   its phase logic with synthetic profiles — welcome / halfway / closing /
   win-back windows, paid-member exclusion, dismissal memory, and the
   song-creation gift flags. */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-conv-verify";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// esbuild-transpile the real source (repo convention: no hand-mirrored copies)
execSync(`npx esbuild use-conversion.ts --bundle --format=esm --outfile=${OUT}/use-conversion.mjs`, { stdio: "pipe" });
// stub the only cross-file import (payment.tsx pulls React/Supabase)
writeFileSync(`${OUT}/payment.mjs`, `export const trialLenDays = (p) => (p && p.founding_member ? 30 : 30);\n`);
// rewrite the import to the stub
const { readFileSync, writeFileSync: w } = await import("node:fs");
let src = readFileSync(`${OUT}/use-conversion.mjs`, "utf8");
src = src.replace(/from\s*"\.\/payment"/, `from "./payment.mjs"`);
w(`${OUT}/use-conversion.mjs`, src);

const C = await import(pathToFileURL(`${OUT}/use-conversion.mjs`).href);

let pass = 0, fail = 0;
let pp = null;
let ps = null;
function ok(cond, label) { if (cond) { pass++; console.log(`  ok: ${label}`); } else { fail++; console.error(`FAIL: ${label}`); } }

const DAY = 86400000;
// ageDays = full days ago PLUS a 2-minute buffer so "day 15" fixtures land
// firmly inside day 15 regardless of test-execution milliseconds.
const prof = (ageDays, founding = false) => ({ created_at: new Date(Date.now() - (ageDays * DAY + 120 * 1000)).toISOString(), founding_member: founding });

// ── trialDay ──
ok(C.trialDay(prof(0)) === 1, "trialDay: signup today = day 1");
ok(C.trialDay(prof(14)) === 15, "trialDay: 14 days ago = day 15");
ok(C.trialDay(prof(31)) === -1, "trialDay: past trial = -1");
ok(C.trialDay(null) === -1, "trialDay: null profile = -1");

// ── welcome window (d1-3) ──
let p = C.convPopupFor(prof(0), "trial");
ok(p && p.kind === "welcome" && p.id === "d0", "day 1 → welcome popup");

// ── gap (d4-14): nothing ──
ok(C.convPopupFor(prof(7), "trial") === null, "day 8 → no popup (quiet phase)");

// ── halfway (d15-28) ──
p = C.convPopupFor(prof(14), "trial");
ok(p && p.kind === "halfway" && p.id === "d15", "day 15 → halfway popup");
ok(C.convPopupFor(prof(27), "trial") && C.convPopupFor(prof(27), "trial").kind === "halfway", "day 28 → still halfway");

// ── closing (d29-30) ──
p = C.convPopupFor(prof(28), "trial");
ok(p && p.kind === "closing" && p.id === "d29", "day 29 → closing popup");
p = C.convPopupFor(prof(29.5), "trial");
ok(p && p.kind === "closing", "day 30 → closing popup");

// ── paid members never see any of it ──
ok(C.convPopupFor(prof(0), "premium") === null, "premium → no popup");
ok(C.convPopupFor(prof(0), "max") === null, "max → no popup");
ok(C.convPopupFor(null, "trial") === null, "null profile → no popup");

// ── win-back: expired trial on free plan ──
p = C.convWinBack(prof(35), "free");
ok(p && p.kind === "winback" && p.id === "wb", "expired + free → win-back popup");
ok(C.convWinBack(prof(10), "free") === null, "still inside trial (free edge) → no win-back");
ok(C.convWinBack(prof(35), "premium") === null, "expired but paying → no win-back");

// ── dismissal memory (per device, once per id) ──
globalThis.localStorage = (() => { let m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; })();
ok(C.convSeen("d15") === false, "dismissal memory: unseen id = false");
C.markConvSeen("d15");
ok(C.convSeen("d15") === true, "dismissal memory: marked id = true");
ok(C.convPopupFor(prof(14), "trial") === null, "dismissed halfway doesn't re-fire");

// ── song-creation gift (decision 1A) ──
ok(C.canUseSongGift() === true, "song gift: available before first use");
C.consumeSongGift();
ok(C.canUseSongGift() === false, "song gift: gone after one use (lifetime)");

// ── copy integrity: every language has every key ──
for (const lang of ["th", "en", "zh"]) {
  const cc = C.CONV_COPY[lang];
  ok(cc && cc.bannerUrgent.includes("{n}") && cc.welcome.title && cc.halfway.title && cc.closing.items && cc.winback.title && cc.closing.cta, `copy ${lang}: all keys present`);
}

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

// convD7 via convPopupFor: only day 5-9 + real proof + unseen + slot free
localStorage.setItem("tg_atip_outcomes", JSON.stringify([{ resolved: true, outcome: { improved: true, delta: 9 } }]));
p = C.convPopupFor(prof(7), "trial");
ok(p && p.id === "d7" && p.kind === "d7proof" && p.proof.bestDelta === 9, "v3: day 8 + proof -> d7proof popup (fills the quiet phase)");
ok(C.convPopupFor(prof(12), "trial") === null, "v3: day 13 -> no d7 popup (outside window)");
localStorage.setItem("tg_atip_outcomes", "[]");
ok(C.convPopupFor(prof(7), "trial") === null, "v3: day 8 without proof -> nothing (no evidence, no pitch)");

// 1-sell-per-day governor
localStorage.setItem("tg_atip_outcomes", JSON.stringify([{ resolved: true, outcome: { improved: true, delta: 9 } }]));
ok(C.sellSlotToday() === 1, "v3: sell slot consumed by the d7 popup");
ok(C.proofPopupEligible(prof(7), "trial") === null, "v3: proof popup blocked when today's slot is used");
localStorage.setItem("tg_sell_day", JSON.stringify({ d: new Date().toDateString(), used: 0 }));
pp = C.proofPopupEligible(prof(7), "trial");
ok(pp && pp.id === "proof" && pp.kind === "proof", "v3: proof popup fires on a freed slot (win moment)");
ok(C.proofPopupEligible(prof(7), "trial") === null, "v3: proof popup capped at once per 7 days");
ok(C.proofPopupEligible(prof(7), "premium") === null, "v3: proof popup never for paying members");
localStorage.setItem("tg_atip_outcomes", JSON.stringify([{ resolved: true, outcome: { improved: true, delta: 2 } }]));
localStorage.setItem("tg_sell_day", JSON.stringify({ d: new Date().toDateString(), used: 0 }));
localStorage.setItem("tg_proof_last", "0");
ok(C.proofPopupEligible(prof(7), "trial") === null, "v3: bestDelta < 5 -> no proof popup (bar is real improvement)");

// personalized copy: real numbers when proof exists, original copy otherwise
ok(C.personalizedBody("d7proof", "en", { improvedCount: 2, bestDelta: 12, sessions: 5 }, "GEN").includes("+12%"), "v3: en body carries the real number");
ok(C.personalizedBody("d7proof", "th", { improvedCount: 1, bestDelta: 12 }, "GEN").includes("+12%") && /[ก-๙]/.test(C.personalizedBody("d7proof", "th", { improvedCount: 1, bestDelta: 12 }, "GEN")), "v3: th body Thai + number");
ok(C.personalizedBody("d7proof", "zh", { improvedCount: 1, bestDelta: 12 }, "GEN").includes("+12%"), "v3: zh body carries the number");
ok(C.personalizedBody("halfway", "en", { improvedCount: 0, bestDelta: null }, "GENERIC") === "GENERIC", "v3: no proof -> honest generic fallback (never a proud zero)");
ok(C.personalizedBody("closing", "en", { improvedCount: 3, bestDelta: 8, sessions: 23 }, null).includes("23 sessions"), "v3: closing personalized names sessions when known");

// post-purchase activation: exactly once, paid only, admins excluded
ok(C.firstPaidActivation("premium") === true, "v3: first paid moment fires activation");
ok(C.firstPaidActivation("premium") === false, "v3: second call - no replay (once per account)");
ok(C.firstPaidActivation("trial") === false && C.firstPaidActivation("free") === false && C.firstPaidActivation("maxfamily") === false, "v3: trial/free/admin never fire activation");
ok(!!(C.ACTIVATION_COPY.th && C.ACTIVATION_COPY.en && C.ACTIVATION_COPY.zh), "v3: activation copy in all 3 languages");

rmSync(OUT, { recursive: true, force: true });
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
