/* Regression test for the 2026-09-21 crash report:
   "หน้าสรุปผลหลังฝึก Scale มันขึ้น error" + "ครู TIGA พูดว่า" rendering wrong.

   Root cause: runTeachingLoopForPractice() returned a raw Promise (runOnce()
   is async), so finishPractice() read .response off the Promise → undefined
   → tigaTip was null on EVERY result, and the async restructure had to keep
   the result reveal safe when the drill is finished mid-render.

   This test transpiles the REAL use-practice-mode.ts hook (esbuild, no
   hand-mirrored copies — repo convention) and drives a complete G-major
   scale drill to its result screen, then asserts:
     1. finishPractice() does not throw (the old code threw nothing but
        silently dropped the verdict; the async restructure must not throw),
     2. practiceResult carries a real tigaTip with text + strategy,
     3. PracticeOverlay renders that verdict markup ("TIGA Model วิเคราะห์"),
     4. the result screen still shows score/streak (result not blank),
     5. the loop works for a guest too (aiLoading false, no network call).
*/
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

const OUT = "node_modules/.tmp-finish-practice";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/* Stub the heavy App.tsx imports (gamification side) — the hook expects a
   handful of plain functions; provide recording doubles. */
writeFileSync(`${OUT}/app-stubs.js`, `
export const EARN = { practice: 20 };
export function takeEarn() { return true; }
export function logPractice() {}
export function scoreDynamics(v) { return v && v.length ? { ok: 1, miss: 0 } : null; }
export function pathDoneSet() { return new Set(); }
export function markPathDone() {}
export function markPathAccuracy() {}
export function pathTier(a) { return a >= 90 ? "gold" : a >= 75 ? "silver" : a >= 70 ? "bronze" : null; }
export const PATH_PASS_ACCURACY = 70;
export function bossDoneSet() { return new Set(); }
export function markBossDone() {}
export const BOSS_PASS_ACCURACY = 70;
export function getDueReviews() { return { stages: [], practice: [], total: 0 }; }
export function bumpMemoryStreak() { return { bumped: false, count: 0, tierUp: false }; }
`);

/* Transpile the hook: rewrite its relative sibling imports to in-tree stubs
   before esbuild runs (esbuild aliases must be bare package names, and
   relative paths can't be aliased — so patch the source text).
   web.js + PracticeOverlay get the same treatment: web.js bundles its whole
   tigamodel tree standalone (with a stubbed ../supabase-client sibling), and
   PracticeOverlay's import is rewritten to that copy. */
import { readFileSync } from "node:fs";
let hookSrc = readFileSync("use-practice-mode.ts", "utf8");
hookSrc = hookSrc
  .replace('from "./App"', `from "${process.cwd()}/${OUT}/app-stubs.js"`)
  .replace('from "./music-engine"', `from "${process.cwd()}/${OUT}/music-engine-stub.js"`)
  .replace('from "./piano-guard"', `from "${process.cwd()}/piano-guard.ts"`)
  .replace('from "./tigamodel/web"', `from "${process.cwd()}/${OUT}/ovroot/web.js"`)
  .replace('from "./shared-infra"', `from "${process.cwd()}/${OUT}/infra-stub.js"`)
  .replace('from "./ai-chat-context"', `from "${process.cwd()}/${OUT}/infra-stub.js"`)
  .replace('from "./ai-backend"', `from "${process.cwd()}/${OUT}/infra-stub.js"`);
writeFileSync(`${OUT}/use-practice-mode.testable.ts`, hookSrc);
writeFileSync(`${OUT}/music-engine-stub.js`, `/* minimal stand-in for the pieces of music-engine the hook imports:
   audio output + listener lifecycle, no real audio (jsdom) */
export const PITCH_TOL_CENTS = 95;
export const TUNE_OFFSET_CAP = 45;
export const DUP_WINDOW_MS = 140;
export function fingersForNotes() { return null; }
export function pcOf(n) { const m = /^([A-G]#?)/.exec(n || ""); const NN = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]; return m ? NN.indexOf(m[1]) : -1; }
export function centsFromPC() { return 0; }
export function getAC() { return new (globalThis.AudioContext)(); }
export function playPianoNote() {}
export function playUi() {}
export function stopPracticeListeners() {}
export async function startMidiListener() { return false; }
export async function startMicListener() { return true; }
export const THEORY_REF = "";
export const INTERVAL_FEEL = {};
export const TRIAD_FEEL = {};
export const SEVENTH_FEEL = {};
export function progressionChordLabels() { return []; }
export function Piano() { return null; }
`);
writeFileSync(`${OUT}/infra-stub.js`, `/* shared-infra / ai-chat-context / ai-backend pieces the hook uses */
export function logActivity() {}
export function dayKey(d) { const x = d || new Date(); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
export function recordMemory(label, acc) { try { const m = JSON.parse(localStorage.getItem("tg_memory") || "null") || { recent: [] }; m.recent = [{ label, acc, t: dayKey() }, ...(m.recent || []).filter(r => r.label !== label)].slice(0, 12); localStorage.setItem("tg_memory", JSON.stringify(m)); } catch (e) {} }
export async function fetchChatCompletion() { return ""; }
`);
/* web.js FIRST (the hook's rewritten import points at its output).
   The copied tree imports "../supabase-client" — the stub must exist at that
   relative location (OUT/supabase-client.js) before bundling. */
writeFileSync(`${OUT}/supabase-client.js`, `export const sb = { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }), auth: { getSession: async () => ({ data: { session: null } }) } };
export default sb;\n`);
execSync(
  `cp -r tigamodel ${OUT}/tmsrc && npx esbuild ${OUT}/tmsrc/web.js --bundle --outfile=${OUT}/ovroot/web.js --format=esm --platform=browser --external:react --external:react-dom`,
  { stdio: "pipe" }
);
execSync(
  `npx esbuild ${OUT}/use-practice-mode.testable.ts --bundle --outfile=${OUT}/hook/use-practice-mode.js --format=esm --platform=browser --loader:.ts=ts --jsx=automatic --external:react --external:react-dom`,
  { stdio: "pipe" }
);
{
  let ovSrc = readFileSync("PracticeOverlay.tsx", "utf8").replace('from "./tigamodel/web"', `from "${process.cwd()}/${OUT}/ovroot/web.js"`)
    /* i18n + music-engine live at the project root — point at the REAL files
       (esbuild bundles their trees; music-engine's React import is external) */
    .replace('from "./i18n"', `from "${process.cwd()}/i18n.ts"`)
    .replace('from "./music-engine"', `from "${process.cwd()}/${OUT}/music-engine-stub.js"`);
  writeFileSync(`${OUT}/PracticeOverlay.testable.tsx`, ovSrc);
  execSync(
    `npx esbuild ${OUT}/PracticeOverlay.testable.tsx --bundle --outfile=${OUT}/ovroot/PracticeOverlay.js --format=esm --platform=browser --loader:.tsx=tsx --jsx=automatic --external:react --external:react-dom`,
    { stdio: "pipe" }
  );
}

/* jsdom-lite globals the hook/overlay need at import time (audio engine) */
const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
globalThis.window = globalThis;
try { globalThis.navigator = globalThis.navigator || {}; } catch (e) { /* node ≥21 navigator is getter-only */ }
globalThis.AudioContext = class { constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; } resume() { return Promise.resolve(); } createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } createOscillator() { return { frequency: { value: 0, setValueAtTime() {} }, type: "", connect() {}, start() {}, stop() {} }; } };
globalThis.webkitAudioContext = globalThis.AudioContext;
globalThis.requestMIDIAccess = undefined;

const React = (await import("react")).default;
const { renderToStaticMarkup } = await import("react-dom/server");

const web = await import(pathToFileURL(`${OUT}/ovroot/web.js`).href);
const { PracticeOverlay } = await import(pathToFileURL(`${OUT}/ovroot/PracticeOverlay.js`).href);
const hookMod = await import(pathToFileURL(`${OUT}/hook/use-practice-mode.js`).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; console.log("  ✗ " + name + (extra ? " — " + extra : "")); } };

/* Minimal harness: render the hook via a probe component and expose its API. */
function makeHarness({ isGuest = true } = {}) {
  const api = {};
  const lastSeq = { current: null };
  let setChordStyleFn = () => {};
  function Probe() {
    const [hand, setHand] = React.useState("right");
    const [chordStyle, setChordStyle] = React.useState("broken");
    setChordStyleFn = setChordStyle;
    const clearSeq = () => { lastSeq.current = null; };
    Object.assign(api, hookMod.usePracticeMode({
      hand, chordStyle, setChordStyle, lastSeq, clearSeq,
      earnCoins: () => {}, gainExp: () => {}, grantPracticeGem: null,
      isGuest, lang: "th", bumpWeekly: null,
    }));
    return null;
  }
  const root = React.createElement(Probe);
  React.createElement(root.type); // touch for lint symmetry
  return { api, lastSeq, setChordStyle: (s) => setChordStyleFn(s) };
}

/* react render driver that re-renders until the hook settles */
function renderProbe({ isGuest }) {
  let latest = null;
  function Probe() {
    const [hand, setHand] = React.useState("right");
    const [chordStyle, setChordStyle] = React.useState("broken");
    latest = { hand, setHand, chordStyle, setChordStyle };
    const api = hookMod.usePracticeMode({
      hand, chordStyle, setChordStyle, lastSeq: seqRef.current, clearSeq: () => { seqRef.current.current = null; },
      earnCoins: () => {}, gainExp: () => {}, grantPracticeGem: null,
      isGuest, lang: "th", bumpWeekly: null,
    });
    apiRef.current = api;
    return null;
  }
  const seqRef = { current: { current: null } };
  const apiRef = { current: null };
  return { seqRef, apiRef };
}

console.log("finishPractice end-to-end (real hook + real teaching loop):");

/* ── 1. the wrapper is truly async now and resolves to the loop result ── */
{
  const r = await web.runTeachingLoopForPractice({ accuracy: 100, repeatedErrors: 0, pauses: 1, rhythmScore: 93, speedRatio: null, weekAgoAccuracy: null });
  ok("runTeachingLoopForPractice resolves (not a Promise-pass-through)", r && typeof r === "object" && r.response && typeof r.response.text === "string");
  ok("verdict text non-empty", r && r.response && r.response.text.length > 10);
  ok("strategy chosen", r && r.decision && !!r.decision.strategy_id);

  /* language-mode contract (owner request): the verdict speaks the app's language */
  const rTh = await web.runTeachingLoopForPractice({ accuracy: 100, repeatedErrors: 0, pauses: 0, rhythmScore: 95 }, { lang: "th" });
  ok("th verdict is Thai", /[ก-๙]/.test(rTh.response.text), rTh.response.text.slice(0, 40));
  const rEn = await web.runTeachingLoopForPractice({ accuracy: 100, repeatedErrors: 0, pauses: 0, rhythmScore: 95 }, { lang: "en" });
  ok("en verdict is English (no Thai glyphs)", !/[ก-๙]/.test(rEn.response.text) && /[a-z]/i.test(rEn.response.text), rEn.response.text.slice(0, 40));
  const rZh = await web.runTeachingLoopForPractice({ accuracy: 100, repeatedErrors: 0, pauses: 0, rhythmScore: 95 }, { lang: "zh" });
  ok("zh verdict is Chinese (no Thai glyphs)", !/[ก-๙]/.test(rZh.response.text) && /[一-龥]/.test(rZh.response.text), rZh.response.text.slice(0, 40));
  /* struggling path too (the simplify strategy branch) */
  const rZh2 = await web.runTeachingLoopForPractice({ accuracy: 40, repeatedErrors: 4, pauses: 1, rhythmScore: 40 }, { lang: "zh" });
  ok("zh struggle verdict is Chinese", /[一-龥]/.test(rZh2.response.text) && !/[ก-๙]/.test(rZh2.response.text), rZh2.response.text.slice(0, 40));
  /* unknown lang falls back to Thai, never crashes */
  const rX = await web.runTeachingLoopForPractice({ accuracy: 100, repeatedErrors: 0, pauses: 0, rhythmScore: 95 }, { lang: "xx" });
  ok("unknown lang → Thai fallback", /[ก-๙]/.test(rX.response.text));
}

/* ── 2. full hook flow: complete a G-major harmonic scale, finish, inspect ── */
const isGuest = true;
let api = null;
const seqHolder = { current: null };
function Probe() {
  const [hand] = React.useState("right");
  const [chordStyle] = React.useState("broken");
  api = hookMod.usePracticeMode({
    hand, chordStyle, setChordStyle: () => {}, lastSeq: seqHolder, clearSeq: () => {},
    earnCoins: () => {}, gainExp: () => {}, grantPracticeGem: null,
    isGuest, lang: "th", bumpWeekly: null,
  });
  return null;
}
/* Render the probe with react-dom/server once to initialize hook state. Note:
   server rendering runs the hook body once (useState/useRef work; useEffect
   and set-state are no-ops server-side), which is enough to make
   startPractice() usable — it reads refs, not state. */
renderToStaticMarkup(React.createElement(Probe));

/* a realistic G-major harmonic scale from buildStageDemoSeq (scale mode) */
seqHolder.current = {
  notes: ["G3", "A3", "B3", "C4", "D4", "E4", "F#4", "G4"],
  mode: "scale",
  fingers: [1, 2, 3, 1, 2, 3, 4, 5],
  label: "โนนเมเจอร์ (Harmonic) สเกล (Scale)",
  key: "G",
  stageId: "stage-test",
  bossGroup: null,
};
api.startPractice();

/* play every target note in order via the screen-tap path (freq: null) */
const targets = api.practiceTargetRef.current.slice();
ok("drill loaded (up+down expansion = 15 notes)", targets.length === 15, "got " + targets.length);
for (const n of targets) {
  api.handlePlayedNote({ note: n, freq: null, source: "screen" });
}
ok("finishPractice ran without throwing", true);

/* the async teaching loop + result reveal lands a microtask later */
await new Promise(r => setTimeout(r, 50));
const res = api.practiceResultRef ? null : null; // refs are internal; read via returned state snapshot instead
/* the hook returns practiceResult from useState — our server probe copied the
   api object AFTER the last render; because setPracticeResult is a no-op on
   the server, drive the state through a client-style double render instead. */
console.log(`  (practiceResult via server probe: ${api.practiceResult ? "set" : "state-noop-on-ssr — checking via client render"})`);

/* ── 3. client-side probe: same flow but with real state updates ── */
{
  let api2 = null;
  const seq2 = { current: null };
  let bump = null;
  function Probe2() {
    const [, force] = React.useReducer(x => x + 1, 0);
    bump = force;
    const [hand] = React.useState("right");
    const [chordStyle] = React.useState("broken");
    api2 = hookMod.usePracticeMode({
      hand, chordStyle, setChordStyle: () => {}, lastSeq: seq2, clearSeq: () => {},
      earnCoins: () => {}, gainExp: () => {}, grantPracticeGem: null,
      isGuest: true, lang: "th", bumpWeekly: null,
    });
    return null;
  }
  /* minimal act-based driver without react-dom/client (keep it dependency-light):
     call the hook body manually through the same reducer pattern React uses —
     simplest reliable path is react-dom/client with jsdom, installed already. */
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><div id=h></div>", { url: "https://x/", pretendToBeVisual: true });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  try { globalThis.navigator = dom.window.navigator; } catch (e) {}
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("h"));
  root.render(React.createElement(Probe2));
  await new Promise(r => setTimeout(r, 60));

  seq2.current = {
    notes: ["G3", "A3", "B3", "C4", "D4", "E4", "F#4", "G4"],
    mode: "scale",
    fingers: [1, 2, 3, 1, 2, 3, 4, 5],
    label: "โนนเมเจอร์ (Harmonic) สเกล (Scale)",
    key: "G",
    stageId: "stage-test",
    bossGroup: null,
  };
  api2.startPractice();
  await new Promise(r => setTimeout(r, 30));
  for (const n of api2.practiceTargetRef.current.slice()) {
    api2.handlePlayedNote({ note: n, freq: null, source: "screen" });
  }
  await new Promise(r => setTimeout(r, 120)); // async loop + result reveal
  const r2 = api2.practiceResult;
  ok("practiceResult set after finish", !!r2);
  if (r2) {
    ok("accuracy 100%", r2.accuracy === 100, "got " + r2.accuracy);
    ok("tigaTip present (THE bug)", !!r2.tigaTip && typeof r2.tigaTip.text === "string" && r2.tigaTip.text.length > 5, JSON.stringify(r2.tigaTip && r2.tigaTip.text || null).slice(0, 80));
    ok("tigaTip has strategy id", !!r2.tigaTip && !!r2.tigaTip.strategyId);
    ok("guest: aiLoading false", r2.aiLoading === false);

    /* ── 4. the overlay renders the verdict markup ── */
    const lc = { practiceResultTitle: "เยี่ยมมาก!", practiceNewBest: "สถิติใหม่!", practiceAcc: "ความแม่นยำ", practiceStreakLbl: "คอมโบสูงสุด", practiceCoachSays: "ครู TIGA พูดว่า", practiceRestart: "เริ่มใหม่", practiceExit: "ออก", close: "ปิด", memoryStreakLbl: "สตรีคความจำ", memoryStreakTierUp: "เลื่อนขั้น!", pathUnlockedTitle: "ปลดล็อก!", bossDefeatedTitle: "ชนะบอส!" };
    const html = renderToStaticMarkup(React.createElement(PracticeOverlay, {
      practiceModeRef: { current: "scale" }, chordStyle: "broken",
      practiceTarget: [], practiceHitIdxs: [], practiceFingers: [], lang: "th",
      practiceLabel: r2.label, exitPractice: () => {}, practiceSrc: null, practiceTune: null,
      hand: "right", setHand: () => {}, practiceIdx: 0, practiceHeard: null, practiceMiss: 0,
      practiceStreak: 0, practiceResult: r2, restartPractice: () => {}, practiceHandlerRef: { current: () => {} },
      switchPracticeChordStyle: () => {}, chordGroupSize: 0,
    }));
    ok("overlay renders result title", html.includes("เยี่ยมมาก!"));
    ok("overlay shows score 100%", html.includes("100%"));
    ok("overlay renders TIGA verdict header", html.includes("TIGA Model วิเคราะห์"), "markup: " + html.slice(0, 200));
    ok("overlay renders verdict text", r2.tigaTip && html.includes(r2.tigaTip.text.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    ok("NO crash-boundary artifacts", !html.includes("Something went wrong"));
  }
  root.unmount();
}

/* ── 5. failing drill still produces a verdict (loop's teach path) ── */
{
  let api3 = null;
  const seq3 = { current: null };
  function Probe3() {
    const [hand] = React.useState("right");
    const [chordStyle] = React.useState("broken");
    api3 = hookMod.usePracticeMode({
      hand, chordStyle, setChordStyle: () => {}, lastSeq: seq3, clearSeq: () => {},
      earnCoins: () => {}, gainExp: () => {}, grantPracticeGem: null,
      isGuest: true, lang: "th", bumpWeekly: null,
    });
    return null;
  }
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><div id=h3></div>", { url: "https://x/", pretendToBeVisual: true });
  const savedWindow = globalThis.window, savedDoc = globalThis.document;
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  try { globalThis.navigator = dom.window.navigator; } catch (e) {}
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(dom.window.document.getElementById("h3"));
  root.render(React.createElement(Probe3));
  await new Promise(r => setTimeout(r, 60));
  seq3.current = { notes: ["C4", "D4", "E4", "F4"], mode: "seq", fingers: [], label: "เมโลดี้ทดสอบ", key: "C", stageId: null, bossGroup: null };
  api3.startPractice();
  await new Promise(r => setTimeout(r, 30));
  /* play 2 right + 2 wrong */
  api3.handlePlayedNote({ note: "C4", freq: null, source: "screen" });
  api3.handlePlayedNote({ note: "D4", freq: null, source: "screen" });
  api3.handlePlayedNote({ note: "F#4", freq: null, source: "screen" });
  api3.handlePlayedNote({ note: "A#4", freq: null, source: "screen" });
  api3.handlePlayedNote({ note: "E4", freq: null, source: "screen" });
  api3.handlePlayedNote({ note: "F4", freq: null, source: "screen" });
  await new Promise(r => setTimeout(r, 120));
  const r3 = api3.practiceResult;
  ok("mixed drill finished", !!r3);
  if (r3) {
    ok("mixed drill accuracy < 100", r3.accuracy < 100, "got " + r3.accuracy);
    ok("mixed drill also gets a tigaTip", !!r3.tigaTip && r3.tigaTip.text.length > 5);
  }
  root.unmount();
  globalThis.window = savedWindow; globalThis.document = savedDoc;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
