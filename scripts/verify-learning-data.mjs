// scripts/verify-learning-data.mjs — Learning Data v1 verification (esbuild the
// REAL learning-data.ts, drive it in-process; no reimplementation).
//   node scripts/verify-learning-data.mjs
// (top-level await entry — run as .mjs)
// The supabase-js import is aliased to a stub that records every rpc call, so
// the assertions run against what the client actually SENDS (arg names must
// match the SQL exactly — the historical failure mode this repo hit with
// admin_adjust_currency).
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));

const calls = [];
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const listeners = {};
const sbStubCode = `
class SBStub {
  constructor() { this._rpcs = []; }
  rpc(fn, args) { globalThis.__pushRpc([fn, args]); return Promise.resolve({ data: null, error: null }); }
  auth = {
    _sessionReady: () => true,
    getUser: async () => ({ data: { user: { id: "test-uid" } } }),
    getSession: async () => ({ data: { session: { user: { id: "test-uid" } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  };
  from() { return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }; }
}
export const sb = new SBStub();
export const SUPABASE_URL = "https://stub.supabase.co";
`;
fs.writeFileSync(path.join(root, ".verify-sb-stub.mjs"), sbStubCode);

const testEntry = `
import { sb } from "./.verify-sb-stub.mjs";
import { initLearningData, recordPracticeResult, recordCoachIntervention, recordTipFollowed, completeLearningSession } from "./learning-data";
globalThis.__LD = { sb, initLearningData, recordPracticeResult, recordCoachIntervention, recordTipFollowed, completeLearningSession };
`;

const out = await esbuild.build({
  stdin: { contents: testEntry, resolveDir: root, sourcefile: "verify-entry.ts", loader: "ts" },
  bundle: true, write: false, format: "cjs", platform: "node",
  // esbuild aliases can't start with "./" — use a plugin that redirects the
  // module id exactly as learning-data.ts imports it. Plugins need the async API.
  plugins: [{
    name: "sb-stub",
    setup(b) {
      b.onResolve({ filter: /^\.\/supabase-client$/ }, () => ({ path: path.join(root, ".verify-sb-stub.mjs") }));
    },
  }],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "silent",
});

global.window = { addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); }, localStorage };
global.document = { visibilityState: "visible", addEventListener: () => {} };
global.localStorage = localStorage;
global.__pushRpc = (c) => calls.push(c);

const mod = { exports: {} };
new Function("module", "exports", "require", "window", "document", "localStorage", out.outputFiles[0].text)(
  mod, mod.exports, require, global.window, global.document, localStorage
);

const LD = global.__LD || mod.exports;
let fail = 0;
const check = (name, ok) => { console.log((ok ? "  ✓ " : "  ✗ ") + name); if (!ok) fail++; };

// ── 1. init starts exactly one session (StrictMode-safe) ──
LD.initLearningData(); LD.initLearningData();
const sessCalls = calls.filter(([f]) => f === "learning_start_session");
check("init starts exactly one session", sessCalls.length === 1);
check("start arg names match SQL", sessCalls[0] && "p_session_key" in sessCalls[0][1] && "p_trace_id" in sessCalls[0][1]);

// ── 2. a practice run writes the full fact chain ──
LD.recordPracticeResult({ accuracy: 62, isNewBest: false, label: "Twinkle", noteMisses: ["E4", "F4"], durationSec: 95, attempts: 18, misses: 7, scoreBefore: 70, strategyId: "tiny_task", strategyText: "ฝึกช้า ๆ" });
const kinds = calls.map(([f, a]) => f);
check("observation: note_accuracy", kinds.includes("learning_observe") && calls.some(([f, a]) => f === "learning_observe" && a.p_kind === "note_accuracy"));
check("observation: miss_count", calls.some(([f, a]) => f === "learning_observe" && a.p_kind === "miss_count"));
check("observation: note_misses", calls.some(([f, a]) => f === "learning_observe" && a.p_kind === "note_misses"));
check("diagnosis only when weak", calls.some(([f, a]) => f === "learning_diagnose" && a.p_confidence > 0.5 && a.p_evidence.length >= 1));
check("intervention from strategy", calls.some(([f, a]) => f === "learning_intervene" && a.p_strategy_id === "tiny_task"));
check("practice event scored", calls.some(([f, a]) => f === "learning_practice" && a.p_score_after === 62 && a.p_score_before === 70));
check("skill blend called (0..1)", calls.some(([f, a]) => f === "learning_update_skill_state" && a.p_ability === 0.62));
// v2 contract: every ingest RPC addresses the session by session_key (the SQL
// takes p_session_key — a stale p_session_id arg name would PGRST202-drop the
// write silently, which is exactly the historical failure mode). Lock it in.
check("observe sends p_session_key (SQL arg contract)", calls.some(([f, a]) => f === "learning_observe" && typeof a.p_session_key === "string" && a.p_session_key.startsWith("sess:")));
check("diagnose sends p_session_key", calls.some(([f, a]) => f === "learning_diagnose" && typeof a.p_session_key === "string"));
check("intervene sends p_session_key", calls.some(([f, a]) => f === "learning_intervene" && typeof a.p_session_key === "string"));
check("practice sends p_session_key", calls.some(([f, a]) => f === "learning_practice" && typeof a.p_session_key === "string"));
check("no stale p_session_id args anywhere", !calls.some(([, a]) => "p_session_id" in a));

// ── 3. clean run writes NO diagnosis (not a problem, §3) ──
const before = calls.length;
LD.recordPracticeResult({ accuracy: 90, isNewBest: true, label: "Scale C", durationSec: 40, attempts: 10, misses: 0, scoreBefore: 85 });
check("clean run writes no diagnosis", !calls.slice(before).some(([f]) => f === "learning_diagnose"));

// ── 4. idempotency keys are unique per record ──
const keys = calls.map(([, a]) => a.p_idem_key).filter(Boolean);
check("idempotency keys present + unique", keys.length >= 8 && new Set(keys).size === keys.length);

// ── 5. coach intervention + tip follow write their own rows (BEFORE complete —
// complete clears the session by design, and post-session writes must no-op) ──
LD.recordCoachIntervention({ weakness: "จังหวะไม่นิ่ง", feature: "practice", steps: ["ช้าลง", "ใช้เมโทรนอม"] }, { strategyId: "normalize_struggle" });
check("coach card recorded as intervention", calls.some(([f, a]) => f === "learning_intervene" && a.p_strategy_id === "normalize_struggle" && a.p_message_shown === "จังหวะไม่นิ่ง"));
LD.recordTipFollowed("practice");
check("tip follow recorded as observation", calls.some(([f, a]) => f === "learning_observe" && a.p_kind === "coach_tip_followed"));

// ── 6. complete computes duration and reports counts ──
LD.completeLearningSession(false);
const done = calls.filter(([f]) => f === "learning_complete_session").pop();
check("complete reports measured counts", done && done[1].p_observations >= 7 && done[1].p_practice === 2 && done[1].p_interventions >= 2 && done[1].p_duration_sec >= 0);
check("complete clears the session", !JSON.parse(localStorage.getItem("tg_learning_session") || "null"));

// ── 7. after complete, writes no-op (no phantom session) ──
const post = calls.length;
LD.recordTipFollowed("practice");
LD.recordCoachIntervention({ weakness: "x" }, {});
check("post-complete writes no-op safely", calls.length === post);

console.log(fail === 0 ? "\nALL CHECKS PASSED" : `\n${fail} CHECK(S) FAILED`);
fs.rmSync(path.join(root, ".verify-sb-stub.mjs"), { force: true });
process.exit(fail === 0 ? 0 : 1);
