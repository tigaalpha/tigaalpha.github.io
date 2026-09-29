/* Smoke: Answer cache (docs/10 §1.1, m32) — runs the REAL module
   (repo convention: esbuild-transpile the actual source, import() it).
   Covers every hard rule in docs/10 §2:
   - only status:"ok" answers are remembered (uncertain/error never)
   - confidence below the floor is never remembered
   - different context (history) = different key = no cross-context leak
   - kill switch off → nothing stored, nothing served, even after remembering
   - bounded size with deterministic LRU eviction
   - hit returns the ORIGINAL response (provenance byte-identical)
   - malformed input never throws
   - chatThroughCache: miss → real chat path; hit → instant remembered answer */

import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = mkdtempSync(join(tmpdir(), "smoke-acache-"));
await build({
  entryPoints: [new URL("../performance/answer-cache.js", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm",
  outfile: join(OUT, "answer-cache.mjs"),
});
const C = await import(pathToFileURL(join(OUT, "answer-cache.mjs")).href);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
}
const okResp = { status: "ok", text: "A2", provider: "mock", model: "m1", trace_id: "t1", confidence: 0.95, metadata: {} };

console.log("── smoke-answer-cache ──");
{
  const c = C.createAnswerCache({ enabled: true });
  const k = C.answerCacheKey({ message: "A2 คือโน้ตอะไร" });
  check("key from a real message", typeof k === "string" && k.length > 0);
  check("remember: only ok answers stored", c.maybeRemember(k, okResp) === true && c.size() === 1);
  check("hit returns the original object (provenance intact)", c.lookup(k) === okResp);
  check("miss on a different question", c.lookup(C.answerCacheKey({ message: "โน้ตอื่น" })) === null);
}
{
  const c = C.createAnswerCache({ enabled: true });
  const k = C.answerCacheKey({ message: "คำถามเดียวกัน" });
  check("uncertain is NEVER remembered (no freezing doubt as truth)", c.maybeRemember(k, { ...okResp, status: "uncertain", confidence: 0.6 }) === false && c.size() === 0);
  check("error is NEVER remembered", c.maybeRemember(k, { ...okResp, status: "error" }) === false && c.size() === 0);
  check("low-confidence ok is NEVER remembered (floor 0.85)", c.maybeRemember(k, { ...okResp, confidence: 0.5 }) === false && c.size() === 0);
  check("confidence-less ok IS remembered (provider confident implicitly)", c.maybeRemember(k, { ...okResp, confidence: undefined }) === true);
}
{
  const c = C.createAnswerCache({ enabled: true });
  const k1 = C.answerCacheKey({ message: "เล่นต่อไหม", history: [{ role: "user", content: "เพิ่งผิดซ้ำ 3 ครั้ง" }] });
  const k2 = C.answerCacheKey({ message: "เล่นต่อไหม", history: [{ role: "user", content: "เพิ่งเล่นได้ดีมาก" }] });
  c.maybeRemember(k1, okResp);
  check("same words, different conversation → different key (no leak)", k1 !== k2 && c.lookup(k2) === null && c.lookup(k1) === okResp);
}
{
  const c = C.createAnswerCache({ enabled: true });
  const k = C.answerCacheKey({ message: "จำไว้" });
  c.maybeRemember(k, okResp);
  c.setEnabled(false);                                  // kill switch
  check("kill switch off → serves nothing, remembers nothing",
    c.lookup(k) === null && c.maybeRemember(k, okResp) === false && c.size() === 0);
  c.setEnabled(true);
  check("re-enable starts clean (no stale answers come back)", c.lookup(k) === null);
}
{
  const c = C.createAnswerCache({ enabled: true, maxEntries: 3 });
  const ks = ["a", "b", "c", "d"].map(m => C.answerCacheKey({ message: m }));
  ks.forEach((k, i) => c.maybeRemember(k, { ...okResp, trace_id: "t" + i }));
  check("bounded: size never exceeds maxEntries", c.size() === 3);
  check("LRU: oldest evicted first", c.lookup(ks[0]) === null && c.lookup(ks[3]) !== null);
  c.lookup(C.answerCacheKey({ message: "b" }));        // touch b → newest
  c.maybeRemember(ks[3], { ...okResp, trace_id: "t3" }); // evict someone — not b
  check("touched entry survives (LRU not FIFO)", c.lookup(C.answerCacheKey({ message: "b" })) !== null);
}
{
  const c = C.createAnswerCache({ enabled: true });
  check("malformed never throws: null/empty key, garbage response",
    c.maybeRemember(null, okResp) === false && c.maybeRemember(C.answerCacheKey({ message: "x" }), "garbage") === false && c.maybeRemember(C.answerCacheKey({ message: "x" }), null) === false);
  check("empty message → null key (never cached)",
    C.answerCacheKey({ message: "   " }) === null && C.answerCacheKey({}) === null);
  check("default cache is OFF (zero-risk by construction)", C.createAnswerCache().isEnabled() === false && C.createAnswerCache().maybeRemember(C.answerCacheKey({ message: "q" }), okResp) === false);
}
{
  /* chatThroughCache end-to-end against a real tiga singleton */
  const { execSync } = await import("node:child_process");
  const OUT2 = mkdtempSync(join(tmpdir(), "smoke-acache-web-"));
  const REAL_SB = (await import("node:fs")).readFileSync("supabase-client.ts", "utf8");
  (await import("node:fs")).writeFileSync("supabase-client.ts", "export const sb = null;\n");
  try {
    execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT2}/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  } finally {
    (await import("node:fs")).writeFileSync("supabase-client.ts", REAL_SB);
  }
  globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
  const web = await import(pathToFileURL(join(OUT2, "web.js")).href);
  web.initTigamodelWeb();
  const tiga = web.getTigamodel();
  /* mock's fixed confidence is 0.5 — lower the policy floor for this instance
     to exercise the wrapper path end-to-end (the floor itself is proven above) */
  const cache = C.createAnswerCache({ enabled: true, confidenceFloor: 0.4 });
  const msg = "โน้ต C อยู่คีย์ไหน";
  const r1 = await C.chatThroughCache({ tiga, cache, message: msg });
  const r2 = await C.chatThroughCache({ tiga, cache, message: msg });
  check("wrapper: first call runs the real chat path", r1 && r1.response && r1.cache_hit === false);
  check("wrapper: second call is an instant remembered answer",
    r2 && r2.cache_hit === true && r2.routed.reason === "answer_cache_hit" && r2.response.text === r1.response.text);
  check("wrapper: remembered answer keeps its provenance",
    r2.cache_provenance && r2.cache_provenance.remembered === true && r2.response.provider === r1.response.provider);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} smoke-answer-cache: ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
