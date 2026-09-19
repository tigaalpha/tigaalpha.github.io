/* Headless verification of the Play Along plan #1/#3/#4/#8 work:
   #1  Mistake Loop — segment bucketing + tempo ladder (mistake-drill.ts,
       plus startDrill/startSongPlay ordering inside the transpiled hook file)
   #3  Boss Battle — HP economics + combo chips + bounty
   #4  Knowledge Drops — fact coverage for every pitch class
   #8  AI Backing — real major/minor progressions + mode detection
   Transpiles the REAL source files with esbuild and imports them — no
   hand-mirrored copies (repo convention). jsdom stubs localStorage/window. */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { JSDOM } from "/tmp/node_modules/jsdom/lib/api.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://tigaalpha.github.io/" });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.CustomEvent = dom.window.CustomEvent;

const OUT = "node_modules/.tmp-pa2-verify";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execSync(`npx esbuild mistake-drill.ts --bundle --format=esm --outfile=${OUT}/mistake-drill.mjs --log-level=silent`, { stdio: "inherit" });
// use-play-along pulls native-updater (import.meta.env) — define the env keys esbuild won't
execSync(`npx esbuild use-play-along.ts --bundle --format=esm --outfile=${OUT}/use-play-along.mjs --log-level=silent --define:import.meta.env={}`, { stdio: "inherit" });
const MD = await import(pathToFileURL(`${OUT}/mistake-drill.mjs`).href);

let pass = 0, fail = 0;
function ok(cond, label) { if (cond) { pass++; console.log(`PASS  ${label}`); } else { fail++; console.log(`FAIL  ${label}`); } }

/* ── #1: buildDrillPlan buckets nearby misses, ranks, caps, keeps play order ── */
{
  const notes = [];
  // cluster A at t=10..12 (3 misses), cluster B at t=30 (1 miss), cluster C at t=50..52 (2 misses)
  notes.push({ t: 10, note: "C5", missed: true }, { t: 11, note: "D5", missed: true }, { t: 12, note: "E5", missed: true });
  notes.push({ t: 30, note: "G4", missed: true });
  notes.push({ t: 50, note: "A4", missed: true }, { t: 52, note: "B4", missed: true });
  notes.push({ t: 20, note: "F5", missed: false }, { t: 40, note: "C6", missed: false });
  const plan = MD.buildDrillPlan(notes, { max: 4 });
  ok(plan && plan.length === 3, `plan: 3 segments from 3 miss clusters (got ${plan && plan.length})`);
  ok(plan[0].start === 10 && plan[0].misses === 3, "segment 1: starts at first miss, counts 3 misses");
  ok(plan.map(s => s.start).join() === "10,30,50", "segments stay in play order after ranking");
  ok(plan[0].notes.join() === "C5,D5,E5", "segment notes deduped in order");
  // cap at 4: 6 clusters → top-4 by misses, back in play order
  const many = [];
  for (let i = 0; i < 6; i++) many.push({ t: i * 20, note: "C5", missed: true });
  const capped = MD.buildDrillPlan(many, { max: 4 });
  ok(capped && capped.length === 4, "plan: capped at max=4");
  // clean run → null (no card rendered)
  ok(MD.buildDrillPlan([{ t: 1, note: "C5", missed: false }]) === null, "plan: clean run returns null");
  ok(MD.buildDrillPlan(null) === null, "plan: null input returns null");
}

/* ── #1: tempo ladder always starts below the song tempo and climbs to exactly 1 ── */
{
  ok(MD.nextDrillTempo(0.75) === 0.85, "ladder: 0.75 → 0.85");
  ok(MD.nextDrillTempo(0.85) === 1, "ladder: 0.85 → 1");
  ok(MD.nextDrillTempo(1) === 1, "ladder: 1 stays 1 (graduate)");
  ok(MD.nextDrillTempo(0.5) === 0.75, "ladder: below first rung climbs to 0.75");
  ok(MD.firstDrillTempo(1) === 0.75, "first rung for a 1× song is 0.75");
  ok(MD.firstDrillTempo(0.5) === 0.5, "first rung never speeds up a slow song");
}

/* ── #3: boss HP economics ── */
{
  ok(MD.bossHpFor(100) === 80, "HP = 80% of notes (dies before the song ends on a good run)");
  ok(MD.bossHpFor(20) === 30, "HP has a floor of 30 for tiny songs");
  ok(MD.bossComboChip(10) === 2 && MD.bossComboChip(9) === 0 && MD.bossComboChip(20) === 2, "combo chip: +2 every 10×");
  ok(MD.bossRewardCoins(3) === 60 && MD.bossRewardCoins(2) === 40 && MD.bossRewardCoins(1) === 20 && MD.bossRewardCoins(0) === 0, "bounty by stars 60/40/20/0");
}

/* ── #4: every pitch class has a fact in all 3 languages ── */
{
  const PCS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  let all = true;
  for (const pc of PCS) {
    const f = MD.knowledgeDropFor(pc + "4");
    if (!f || !f.th || !f.en || !f.zh) { all = false; console.log("  missing fact for", pc); }
  }
  ok(all, "knowledge: all 12 pitch classes have th/en/zh facts");
  ok(MD.knowledgeDropFor("H9") === null, "knowledge: unknown note returns null");
}

/* ── #8: backing progressions + mode detection ── */
{
  const maj = MD.backingProgression("C", false);
  ok(maj.join() === "C,G,A,F", `major C: I–V–vi–IV (got ${maj.join()})`);
  const min = MD.backingProgression("A", true);
  ok(min.join() === "A,F,C,G", `minor A: i–VI–III–VII (got ${min.join()})`);
  ok(MD.backingProgression("X", false).join() === "C,G,A,F", "invalid tonic falls back to C major");
  // detection: a song leaning on Ab (minor 3rd of F) is minor; leaning on A (major 3rd) is major
  const F_MIN = { seq: [["F4", 0], ["G4", 0.5], ["Ab4", 1], ["Ab4", 1.5], ["C5", 2], ["F4", 2.5], ["R", 3]] };
  const F_MAJ = { seq: [["F4", 0], ["G4", 0.5], ["A4", 1], ["A4", 1.5], ["C5", 2], ["F4", 2.5], ["R", 3]] };
  const pMin = MD.smartBackingPlan(F_MIN);
  ok(pMin.minor === true && pMin.chords.join() === "F,C#,G#,D#", `F minor song detected → i–VI–III–VII (got ${pMin.chords.join()})`);
  const pMaj = MD.smartBackingPlan(F_MAJ);
  ok(pMaj.minor === false && pMaj.chords.join() === "F,C,D,A#", `F major song detected → I–V–vi–IV (got ${pMaj.chords.join()})`);
  // empty song → safe default
  const pEmpty = MD.smartBackingPlan({ seq: [] });
  ok(pEmpty && pEmpty.chords.length === 4, "empty song gets a valid default plan");
}

/* ── wiring sanity in the REAL hook source (string-level, esbuild-proven) ── */
{
  const src = await import("node:fs").then(m => m.readFileSync("use-play-along.ts", "utf8"));
  ok(src.includes('from "./mistake-drill"'), "hook imports mistake-drill");
  ok(!src.includes("function armBoss"), "no dead armBoss helper (startSongPlay re-arms the boss itself)");
  ok(src.includes("songTempoRef.current = rung;") && src.indexOf("songTempoRef.current = rung;") > src.indexOf("startSongPlay();"), "startDrill re-applies drill tempo AFTER startSongPlay's reset");
  ok(src.indexOf("drillStartSecRef.current = Math.max(0, seg.start - 0.5);") > src.indexOf("drillStartSecRef.current = null;"), "drill window set AFTER startSongPlay clears it");
  ok(src.includes("drillPlanRef.current"), "HUD climb reads drillPlanRef (no stale closure)");
  ok(src.includes("startDrill(doneSeg, nxt)"), "ladder climb passes the next rung explicitly");
  ok(src.includes("const rung = forcedRung || firstDrillTempo("), "ladder always starts below song tempo");
  ok(src.includes("setBossMax(bossMaxRef.current);"), "boss max synced for the HUD bar");
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
