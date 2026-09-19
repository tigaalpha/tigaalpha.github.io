/* smoke-camera-game.mjs — the camera-coach GAME LAYER (fun pass).
   Proves on REAL code: combo tiers, score clamp/floor, rank bands,
   full gameStep sim (solve mission → stars, praise at combo 12, rank-up,
   pause when hands leave, grace-protected combo reset, decay, mission
   cycling, missionView, 3-language praise). Repo convention: esbuild the
   real source, import it — never a mirrored copy.

   Run: node tigamodel/scripts/smoke-camera-game.mjs */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const out = path.join(root, "node_modules", ".tmp-tigamodel-camg");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
execSync(`npx esbuild camera-coach-game.ts --bundle --format=esm --outfile=${JSON.stringify(path.join(out, "game.js"))} --log-level=error`, { cwd: root, stdio: "pipe" });
const G = await import(url.pathToFileURL(path.join(out, "game.js")).href);

let fails = 0;
const check = (name, cond) => { if (!cond) { fails++; console.log("FAIL: " + name); } };

// combo tiers
check("tier ×2 at combo 12", G.comboTier(12).mult === 2);
check("tier ×3 at combo 30", G.comboTier(30).mult === 3);
check("tier ×4 at combo 60", G.comboTier(60).mult === 4);
check("tier ×1 below 12", G.comboTier(11).mult === 1);

// score mechanics
check("start 40", G.scoreStart() === 40);
let s = G.scoreStart();
for (let i = 0; i < 100; i++) s = G.updateScore(s, true);
check("clamps at 100", s === 100);
for (let i = 0; i < 200; i++) s = G.updateScore(s, false);
check("floors at 0", s === 0);
check("rank bands", G.scoreRank(95).icon === "👑" && G.scoreRank(10).icon === "🎯");

// full gameStep simulation — hold-15s mission, 30fps
const g = G.freshGameState();
const events = [];
for (let i = 0; i < 16 * 30; i++) events.push(...G.gameStep(g, { hasHands: true, good: true, wristOk: true, bothGood: false }, 33.3, i * 33.3));
check("mission solved within window", events.some(e => e.type === "solved"));
check("stars +3 per solve", g.stars === 3);
check("praise fires at combo 12", events.some(e => e.type === "praise" && e.text.includes("×2")));
check("rank-up fires while climbing", events.some(e => e.type === "rank"));
check("rank reached top band", g.rankIdx === 0);
check("mission cycles to next", g.chIdx === 1);

// pause when hands leave view — no decay, no punishment for looking away
const sb = g.score, cb = g.combo;
for (let i = 0; i < 60; i++) G.gameStep(g, { hasHands: false, good: false, wristOk: false, bothGood: false }, 33.3, 1e6 + i);
check("pause: score frozen", g.score === sb);
check("pause: combo frozen", g.combo === cb);

// bad frames: grace protects combo briefly, then reset + decay
for (let i = 0; i < 20; i++) G.gameStep(g, { hasHands: true, good: false, wristOk: false, bothGood: false }, 33.3, 2e6 + i);
check("combo resets after grace", g.combo === 0);
check("score decays on bad frames", g.score < sb);

// missionView + praise texts
const mv = G.missionView(g, 0);
check("missionView complete", !!mv.ch && typeof mv.prog === "number" && mv.secLeft >= 0);
for (const lang of ["th", "en", "zh"]) check("praise text " + lang, G.missionSolvedPraise(lang).length > 3);

fs.rmSync(out, { recursive: true, force: true });
console.log(fails === 0 ? `smoke-camera-game: ALL ${17 + 2} CHECKS PASSED` : `smoke-camera-game: ${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
