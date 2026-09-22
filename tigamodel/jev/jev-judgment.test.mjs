/* ── tigamodel/jev/jev-judgment.test.mjs — Node smoke test for the Jev engine ──
   Follows the repo verification habit: transpile the REAL source with
   esbuild's JS API and import() the actual exports (never a hand-mirrored
   copy). Run from the repo root:  node tigamodel/jev/jev-judgment.test.mjs ── */
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const built = await esbuild.build({
  entryPoints: ["tigamodel/jev/jev-judgment.js"],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
});
const mod = { exports: {} };
new Function("module", "exports", "require", built.outputFiles[0].text)(mod, mod.exports, require);
const { createJevJudgment, JEV_RECIPES } = mod.exports;

const calls = [];
const fakeFetch = async (url, init) => {
  calls.push({ url, init });
  return {
    ok: true,
    status: 200,
    json: async () => ({ answers: { q: { type: "noul", noul: 0.7 } }, model: "jev-1.13.0", usage: { input_tokens: 10 } }),
  };
};

const jev = createJevJudgment({ fetchImpl: fakeFetch, supabaseUrl: "https://x.supabase.co", getAccessToken: async () => "tok" });

// 1. happy path (single-object form) — real edge URL + JWT forwarded
let r = await jev.judge({ state: "student quit early", questions: { q: { type: "noul", instructions: "churn risk" } } });
assert(r.ok && r.answers.q.noul === 0.7 && r.via === "jev-judgment", "happy path shape");
assert(calls[0].url.endsWith("/functions/v1/jev-judge"), "calls the jev-judge edge function");
assert(calls[0].init.headers.Authorization === "Bearer tok", "JWT forwarded");
assert(JSON.parse(calls[0].init.body).model === "jev-latest", "default model jev-latest");

// 2. positional form (state, questions)
r = await jev.judge("state text", { q: { type: "noul", instructions: "x" } });
assert(r.ok, "positional form works");

// 3-5. convenience helpers map to the right primitive
const pick = await jev.choose("state", "pick one", { a: "A", b: "B" });
assert(pick.ok && "choice" in pick, "choose helper");
const sc = await jev.score("state", "rate", ["low", "high"]);
assert(sc.ok && "score" in sc, "score helper");
const nl = await jev.noul("state", "is urgent");
assert(nl.ok && nl.noul === 0.7, "noul helper");

// 6. no token → ok:false, never throws (surfaces degrade to baseline)
const anon = createJevJudgment({ fetchImpl: fakeFetch, supabaseUrl: "https://x.supabase.co", getAccessToken: async () => null });
r = await anon.judge("s", { q: { type: "noul", instructions: "x" } });
assert(!r.ok && /token/.test(r.error), "no-token degrades without throwing");

// 7. malformed questions silently dropped, valid ones still judged
r = await jev.judge("s", { good: { type: "score", instructions: "x", criteria: ["a"] }, bad: { type: "wat" } });
assert(r.ok, "mixed validity still judged");
const sent = JSON.parse(calls[calls.length - 1].init.body);
assert(Object.keys(sent.questions).length === 1 && sent.questions.good, "bad question dropped before spending tokens");

// 8. upstream failure → ok:false with the upstream message
const fail = createJevJudgment({
  fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: "rate limited" }) }),
  supabaseUrl: "https://x.supabase.co",
  getAccessToken: async () => "t",
});
r = await fail.judge("s", { q: { type: "noul", instructions: "x" } });
assert(!r.ok && /rate limited/.test(r.error), "upstream error degrades");

// 9. recipes cover all three projects
assert(JEV_RECIPES.nextBestSong && JEV_RECIPES.churnRisk && JEV_RECIPES.routeMessage, "recipes for TIGA AI / MODEL / AUTOMATION");

console.log("ALL JEV-JUDGMENT TESTS PASSED");
