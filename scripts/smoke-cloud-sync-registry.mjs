// Every tg_ / tiga_ key the app code mentions must have a decision in cloud-sync.ts (synced / excluded / local / server).
// A new key added without one fails here, so "everything follows the player" cannot silently rot, and a key that must NEVER travel
// (money, plan, Game Power, tokens, test flags...) can never be listed as synced.   Run: node scripts/smoke-cloud-sync-registry.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeClock, makeServer, makeDevice } from "./cloud-sync-harness.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0, passes = 0;
const ok = (n, c, x) => { if (c) passes++; else { fails++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };

const clock = makeClock(), server = makeServer(clock);
const dev = await makeDevice("R", server, clock);
const { classify, SYNC_REGISTRY } = dev.mod;

const SKIP = new Set(["node_modules", "scripts", "bundle", "dist", "studio", "bos", "songs-src", "public", "android", "server", "supabase", "store-assets", "blog", "songs", "landing", ".git", "tigamodel"]);
const files = [];
(function walk(d, depth) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (depth === 0 && SKIP.has(e.name)) continue; if (depth > 0 && SKIP.has(e.name) && ["node_modules", "dist", "bundle"].includes(e.name)) continue; walk(f, depth + 1); }
    else if (/\.(tsx?|jsx?|mjs)$/.test(e.name) && depth <= 1) files.push(f);
  }
})(ROOT, 0);
// tigamodel lives in a sub folder but is bundled into the app
for (const f of fs.readdirSync(path.join(ROOT, "tigamodel")).filter((x) => /\.(js|ts)$/.test(x))) files.push(path.join(ROOT, "tigamodel", f));
if (fs.existsSync(path.join(ROOT, "tigamodel", "knowledge"))) for (const f of fs.readdirSync(path.join(ROOT, "tigamodel", "knowledge")).filter((x) => /\.(js|ts)$/.test(x))) files.push(path.join(ROOT, "tigamodel", "knowledge", f));

const lits = new Map();   // literal -> first file
for (const f of files) {
  if (path.basename(f) === "cloud-sync.ts") continue;
  const src = fs.readFileSync(f, "utf8");
  const re = /["'`]((?:tg|tiga)_[A-Za-z0-9_]*)/g; let m;
  while ((m = re.exec(src))) if (!lits.has(m[1])) lits.set(m[1], path.relative(ROOT, f));
}
// keys written as "tg_" + name (the equip family) are named explicitly in STRATEGY; check them here
for (const k of ["tg_skin", "tg_theme", "tg_sticker", "tg_frame", "tg_keyboard", "tg_charModel", "tg_charHat", "tg_charOutfit", "tg_charWeapon", "tg_charAccessory"]) lits.set(k, "equip family");

const unclassified = [];
for (const [lit, file] of lits) {
  if (lit === "tg_" || lit === "tiga_") continue;   // a bare prefix literal
  const probe = lit.endsWith("_") ? lit + "x" : lit;
  const c = classify(probe);
  if (c === "unclassified") unclassified.push(lit + "  (" + file + ")");
}
console.log("files scanned:", files.length, "literals:", lits.size);
ok("every tg_ / tiga_ literal in the app is classified (" + lits.size + " found)", unclassified.length === 0, unclassified);

// the money / authority list can never be synced
const MONEY = ["tg_coins", "tg_gems", "tg_exp", "tg_streak", "tg_plan", "tg_premium", "tg_game_power", "tg_modelCores", "tg_pvp_rank", "tg_pvp_season", "tg_auth_bk", "tg_anon_id",
  "tg_user_signed_out", "tg_gp_free", "tg_adv_unlockall", "tg_ah_unlockall", "tg_test_hook", "tg_test_forcelogin", "tg_test_myclass_done", "tg_notif_reward_done", "tg_guest_profile", "tg_guest_ms", "tg_attr", "tg_ga",
  "tg_ai_cache_v1", "tg_adv_gfx", "tg_gfx_tier", "tg_msd", "tg_fullscore", "tg_pa_cal_mic", "tg_piano_tune_v1", "tg_chat_idx", "tg_chat_t_x", "tiga_leads", "tg_bio_cred_3", "tg_stitched_u"];
for (const k of MONEY) ok("never synced: " + k, classify(k) !== "synced", classify(k));
for (const k of Object.keys(SYNC_REGISTRY.STRATEGY)) {
  ok("synced key not test / unlockall / money: " + k, !/^tg_test_|unlockall|^tg_(coins|gems|exp|streak|plan|premium|game_power)$/.test(k));
  ok("synced key fits the 64-character limit: " + k, k.length <= 64);
}
// longest per-song cloud key: packs are one row each; legacy per-song rows must also fit with a 40-character song id
for (const [p, ck] of Object.entries(SYNC_REGISTRY.PACKS)) { ok("pack row key short: " + ck, ck.length <= 64); ok("song key fits: " + p, (p + "x".repeat(40)).length <= 64); }
ok("tg_ghost_<40-char id> fits", ("tg_ghost_" + "x".repeat(40)).length <= 64);
// every excluded / local reason is written down
for (const [k, why] of Object.entries({ ...SYNC_REGISTRY.EXCLUDE_WHY, ...SYNC_REGISTRY.LOCAL_WHY })) ok("reason given: " + k, typeof why === "string" && why.length > 3);
// no key is both synced and excluded / local
for (const k of [...Object.keys(SYNC_REGISTRY.EXCLUDE_WHY), ...Object.keys(SYNC_REGISTRY.LOCAL_WHY)]) if (k in SYNC_REGISTRY.STRATEGY) ok("not both synced and local/excluded: " + k, false);

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
