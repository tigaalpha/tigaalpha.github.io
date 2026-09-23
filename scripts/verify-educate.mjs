/* Headless verification of the game-education engine (owner plan 2026-09-19):
   transpiles the REAL use-educate.ts with esbuild and drives its trigger
   matrix — first-coins, shop intro, rich nudge, pet threshold, chest, per-
   device dismissal, and the PvP loss copy. */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-edu-verify";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execSync(`npx esbuild use-educate.ts --bundle --format=esm --outfile=${OUT}/use-educate.mjs`, { stdio: "pipe" });
const E = await import(pathToFileURL(`${OUT}/use-educate.mjs`).href);

let pass = 0, fail = 0;
function ok(cond, label) { if (cond) { pass++; console.log(`  ok: ${label}`); } else { fail++; console.error(`FAIL: ${label}`); } }

// localStorage stub (module reads it at call time)
globalThis.localStorage = (() => { let m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; })();

// ── priority order ──
let t = E.eduTipFor({ coins: 0, chestAvail: true, firstCoinsSeen: false, shopOpenNow: false });
ok(t && t.kind === "firstCoins", "no coins yet → first-coins tip wins");

// dismissal of firstCoins unlocks the rest
E.markEduSeen("firstCoins");
t = E.eduTipFor({ coins: 0, chestAvail: true, firstCoinsSeen: true, shopOpenNow: false });
ok(t && t.kind === "chest", "chest available → chest tip");

// pet threshold: half of PET_COST_REF
E.markEduSeen("chest");
t = E.eduTipFor({ coins: 800, chestAvail: false, firstCoinsSeen: true, shopOpenNow: false });
ok(t && t.kind === "pet", "coins >= 750 → pet tip");
ok(E.eduTipFor({ coins: 700, chestAvail: false, firstCoinsSeen: true, shopOpenNow: false }) === null, "coins below threshold → nothing");

// shop intro only when the shop is actually open (coins must also be below
// the pet threshold, or the pet tip outranks it — that's the priority order)
E.markEduSeen("pet");
t = E.eduTipFor({ coins: 800, chestAvail: false, firstCoinsSeen: true, shopOpenNow: true });
ok(t && t.kind === "shop", "shop open → shop intro tip");
ok(E.eduTipFor({ coins: 800, chestAvail: false, firstCoinsSeen: true, shopOpenNow: false }) === null, "shop closed (below pet threshold) → nothing");

// rich nudge outranks pet once coins are high
E.markEduSeen("pet");
t = E.eduTipFor({ coins: 5100, chestAvail: false, firstCoinsSeen: true, shopOpenNow: false });
ok(t && t.kind === "rich", "coins >= 5000 → rich nudge");
ok(E.eduTipFor({ coins: 4999, chestAvail: false, firstCoinsSeen: true, shopOpenNow: false }) === null, "4999 → nothing left");

// everything dismissed → quiet
E.markEduSeen("rich"); E.markEduSeen("shop");
ok(E.eduTipFor({ coins: 9999, chestAvail: true, firstCoinsSeen: true, shopOpenNow: true }) === null, "all seen → always quiet");

// ── per-device memory persists ──
ok(E.eduSeen("firstCoins") === true, "dismissal memory persists");

// ── PvP loss copy: all 3 languages, all keys (label interpolated) ──
for (const [l, label] of [["th", "สเกล"], ["en", "scales"], ["zh", "音阶"]]) {
  const c = E.pvpLossCopy(label)[l];
  ok(c && c.title && c.body.includes(label) && c.cta, `pvpLossCopy ${l} complete`);
}

// ── copy integrity ──
for (const l of ["th", "en", "zh"]) {
  const cc = E.EDU_COPY[l];
  ok(cc && cc.firstCoins.title && cc.chest.title && cc.pet.title && cc.shop.title && cc.rich.title, `copy ${l}: all 5 tips present`);
}

rmSync(OUT, { recursive: true, force: true });
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
