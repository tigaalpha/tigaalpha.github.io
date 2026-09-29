// Smoke test: exercise the REAL piano-jev edge function source (esbuild-stripped,
// Deno stubbed) and assert every registered task — including the 4 new ones —
// builds a valid question set. Mirrors AGENTS.md's "transpile the real source
// and import it" verification guidance.
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const src = readFileSync("supabase/functions/piano-jev/index.ts", "utf8");
const js = transformSync(src, { loader: "ts", format: "esm" }).code
  .replace(/Deno\.env\.get\("([^"]+)"\)/g, '(globalThis.__env?.["$1"] ?? "")')
  .replace("Deno.serve(", "globalThis.__serve = (")
  + "\nexport { taskEnabled, buildQuestions, buildState };";

const mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64")).catch(e => {
  console.error("IMPORT FAIL:", e.message);
  process.exit(1);
});

const taskEnabled = mod.taskEnabled, buildQuestions = mod.buildQuestions, buildState = mod.buildState;

const TASKS = {
  "teach-rank":        { state: { week: "scale C" }, opts: { candidates: ["tip a", "tip b", "tip c"] } },
  "song-rec":          { state: { level: 3 },        opts: { ids: ["happy-birthday", "ode-to-joy", "minuet-g"] } },
  "chat-precheck":     { state: "can u play mozart", opts: {} },
  "voice-intent":      { state: "open happy birthday", opts: { kinds: ["open_song", "practice", "none"] } },
  "run-classify":      { state: { acc: 72, miss: 9 }, opts: {} },
  "ear-adaptive":      { state: { lastRounds: [1, 0, 1] }, opts: {} },
  "slip-prefilter":    { state: { note: "paid 99" }, opts: {} },
  "feedback-classify": { state: { text: "my kid is stuck" }, opts: {} },
  // ── the 4 new tasks ──
  "sight-adaptive":    { state: { clef: "treble", acc: 88, miss: 2 }, opts: {} },
  "coach-focus":       { state: { avgRoundness: 0.45, wristDroop: 0.2, thumbTuckRatio: 0.1, frames: 20 }, opts: {} },
  "practice-next":     { state: { label: "C major", acc: 91, miss: 1, passed: true }, opts: {} },
  "shop-headline":     { state: { coins: 300, plan: "premium", openedFromShortfall: false }, opts: {} },
};

let fail = 0;
for (const [task, { state, opts }] of Object.entries(TASKS)) {
  const q = buildQuestions(task, opts);
  if (!q || typeof q !== "object" || Object.keys(q).length === 0) { console.log("FAIL", task, "→ empty question set"); fail++; continue; }
  const typesOk = Object.values(q).every(v => v && typeof v.type === "string" && v.instructions && typeof v.instructions.question === "string");
  if (!typesOk) { console.log("FAIL", task, "→ malformed question shape"); fail++; continue; }
  const st = buildState(task, state, opts);
  if (typeof st !== "string" || !st.length) { console.log("FAIL", task, "→ empty state"); fail++; continue; }
  console.log("OK  ", task.padEnd(18), Object.keys(q).join(","));
}
// choice-type questions must have a criteria object with real option keys
const cq = buildQuestions("coach-focus", {}).focus;
if (!cq || cq.type !== "choice" || !cq.criteria || !cq.criteria.roundness) { console.log("FAIL coach-focus criteria shape"); fail++; }
const sq = buildQuestions("shop-headline", {}).package;
if (!sq || !sq.criteria || sq.criteria.p0 == null || sq.criteria.p2 == null) { console.log("FAIL shop-headline criteria shape"); fail++; }
if (fail) { console.log(`\n${fail} FAILURES`); process.exit(1); }
console.log("\nAll 12 Jev tasks build valid question sets ✓");
