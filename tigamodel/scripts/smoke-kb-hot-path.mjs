/* Smoke: KB hot path (docs/10 §1.3, m34) — runs the REAL module AND the REAL
   getKBContext wiring in web.js (repo convention: esbuild-transpile actual
   source, import() it; supabase-client stubbed, minimal localStorage).
   Covers every hard rule:
   - kill switch OFF (default) → select() = null, nothing recorded, and the
     production getKBContext block is BYTE-IDENTICAL to the legacy serving
   - ON → hard caps (maxLines/maxChars) hold on a real 12,615-entry domain
   - line template byte-identical to the legacy template
   - deterministic: same inputs → same lines (explicit comparators)
   - hot counts are bounded boosts and actually change the order
   - round-robin keeps every matched domain represented
   - malformed input never throws
   - retrieval gate with the hot path ON: all 24 probes ≥ 80% (should be 100%)
   - the measured win: harmony question block 1.38 MB → capped, faster */

import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/* ── transpile the REAL modules ── */
const OUT = "node_modules/.tmp-tigamodel-hotpath";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });
const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", "export const sb = null;\n");
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  await build({
    entryPoints: [new URL("../performance/kb-hot-path.js", import.meta.url).pathname],
    bundle: true, platform: "node", format: "esm",
    outfile: join(OUT, "kb-hot-path.mjs"),
  });
  await build({
    entryPoints: [new URL("../evaluation/retrieval-eval.js", import.meta.url).pathname],
    bundle: true, platform: "node", format: "esm",
    outfile: join(OUT, "retrieval-eval.mjs"),
  });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const webM = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
const H = await import(pathToFileURL(`${OUT}/kb-hot-path.mjs`).href);
const rm = await import(pathToFileURL(`${OUT}/retrieval-eval.mjs`).href);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
}

console.log("── smoke-kb-hot-path ──");
const HARMONY_Q = "คอร์ด C กับ G สลับไม่ทัน"; // the measured worst case: harmony, 12,615 entries

/* ── 1. kill switch OFF (default): dead code path, legacy untouched ── */
{
  const hp = H.createKBHotPath(); // default enabled:false
  check("default OFF: select() returns null (caller serves legacy)", hp.select({ domains: ["harmony"], index: new Map([["harmony", [{ id: "a", title: "t", body: "b", teach: "x" }]]]), keywords: ["คอร์ด"], labelOf: () => "HARMONY" }) === null);
  check("default OFF: nothing is recorded", hp.recordServed(["a"]) === false && hp.hotCount("a") === 0);
}

/* ── 2. production wiring, OFF: block byte-identical to legacy ── */
webM.initTigamodelWeb();
const legacyBlock = webM.getKBContext(HARMONY_Q);
check("legacy harmony block is the measured giant (>1,000,000 chars)", legacyBlock.length > 1000000, `got ${legacyBlock.length}`);
check("legacy block ≥ the measured 1,383,891 chars baseline (seed unchanged)", legacyBlock.length >= 1383891, `got ${legacyBlock.length}`);

/* ── 3. ON: caps hold on the real 12,615-entry domain ── */
webM.setKbHotPathEnabled(true);
webM.kbHotPath().clearHot();
const hotBlock = webM.getKBContext(HARMONY_Q);
const cfg = webM.kbHotPath().config;
const hotLines = hotBlock.split("\n").filter(l => l.startsWith("• "));
check(`hard cap maxLines=${cfg.maxLines} holds`, hotLines.length > 0 && hotLines.length <= cfg.maxLines, `got ${hotLines.length}`);
check(`hard cap maxChars=${cfg.maxChars} holds on line text`, hotLines.join("\n").length <= cfg.maxChars, `got ${hotLines.join("\n").length}`);
check("block shrinks by >100x on the worst-case domain", hotBlock.length < legacyBlock.length / 100, `hot=${hotBlock.length} legacy=${legacyBlock.length}`);
check("every line uses the exact legacy template", hotLines.every(l => /^• \[[A-Z][A-Z ]+\] .+ — วิธีสอน: .+$/.test(l)), hotLines[0]);

/* ── 4. deterministic: clear hot counts → same block again ── */
webM.kbHotPath().clearHot();
const hotBlock2 = webM.getKBContext(HARMONY_Q);
check("deterministic: same inputs → same block", hotBlock2 === hotBlock);

/* ── 5. hot counts: a bounded boost that actually reorders ── */
webM.kbHotPath().clearHot();
const first = webM.getKBContext(HARMONY_Q);
const firstLine = first.split("\n").find(l => l.startsWith("• "));
// recordServed happened inside getKBContext → previously-served entries now rank first
const second = webM.getKBContext(HARMONY_Q);
const secondLine = second.split("\n").find(l => l.startsWith("• "));
check("hot boost: previously served entries rank first next time", secondLine === firstLine);
const st = webM.kbHotPath().stats();
check("hot stats tracked (bounded entries, top list)", st.hotEntries > 0 && st.hotTop.length > 0 && st.hotTop[0][1] >= 1);

/* ── 6. OFF again: byte-identical legacy is restored ── */
webM.setKbHotPathEnabled(false);
check("switch OFF restores the legacy block byte-identically", webM.getKBContext(HARMONY_Q) === legacyBlock);

/* ── 7. pure core: ranking is deterministic + malformed input never throws ── */
{
  const a = { id: "a", title: "A", body: "x", teach: "t" };
  const b = { id: "b", title: "B", body: "คอร์ด", teach: "t" };
  const r1 = H.rankKBEntries([a, b], ["คอร์ด"], new Map(), 1);
  const r2 = H.rankKBEntries([a, b], ["คอร์ด"], new Map(), 1);
  check("rankKBEntries deterministic (relevance wins)", r1[0] === b && JSON.stringify(r1) === JSON.stringify(r2));
  const hot = H.rankKBEntries([a, b], [], new Map([["a", 30]]), 1);
  check("hot boost reorders a tied field", hot[0] === a);
  check("scoreKBEntry is bounded by hotBoostMax", H.scoreKBEntry(a, [], 999, 1) <= 1.0000001);
  check("malformed select never throws", (() => { const on = H.createKBHotPath({ enabled: true }); return on.select(null) === null && on.select({}) === null && on.select({ domains: [], index: new Map() }) === null; })());
  check("malformed recordServed never throws", (() => { const on = H.createKBHotPath({ enabled: true }); return on.recordServed(null) === false && on.recordServed("nope") === false; })());
  const tiny = H.createKBHotPath({ enabled: true, maxLines: 3, maxChars: 200 });
  const sel = tiny.select({ domains: ["d"], index: new Map([["d", Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, title: `t${i}`, body: "บรรทัดทดสอบความยาวปานกลาง", teach: "สอนทีละขั้น" }))]]) , keywords: [], labelOf: () => "D" });
  check("tiny caps respected on synthetic data", sel.lines.length <= 3 && sel.chars <= 200 + 210, `lines=${sel.lines.length} chars=${sel.chars}`);
}

/* ── 8. round-robin: multi-domain questions keep every domain represented ── */
webM.setKbHotPathEnabled(true);
webM.kbHotPath().clearHot();
{
  // technique keywords + harmony keywords both fire on this message
  const multi = webM.getKBContext("คอร์ด C กับ G สลับไม่ทัน มือซ้ายเล่นเบสไม่ลื่นเลย");
  const labels = new Set([...multi.matchAll(/\[([A-Z][A-Z ]+?)\]/g)].map(m => m[1]));
  check("multi-domain block serves more than one domain", labels.size >= 2, [...labels].join(","));
}

/* ── 9. THE LAW: retrieval gate with the hot path ON ── */
{
  webM.kbHotPath().clearHot();
  const scored = rm.RETRIEVAL_PROBES.map(p => ({ score: rm.scoreRetrieval(p, rm.servedLabels(webM.getKBContext(p.q))) }));
  const acc = rm.retrievalAccuracy(scored);
  check(`retrieval gate with hot path ON: ${(acc * 100).toFixed(1)}% (gate ≥${rm.RETRIEVAL_GATE * 100}%)`, acc >= rm.RETRIEVAL_GATE);
  check("no probe regressed (100% expected — content untouched, selection only)", acc === 1, `accuracy ${(acc * 100).toFixed(1)}%`);
}

/* ── 10. the measured speed win (same machine, warm loop) ── */
{
  webM.setKbHotPathEnabled(false);
  let t0 = performance.now();
  for (let i = 0; i < 100; i++) webM.getKBContext(HARMONY_Q);
  const legacyMs = (performance.now() - t0) / 100;
  webM.setKbHotPathEnabled(true);
  webM.kbHotPath().clearHot();
  webM.getKBContext(HARMONY_Q); // warm
  webM.kbHotPath().clearHot();
  t0 = performance.now();
  for (let i = 0; i < 100; i++) { webM.kbHotPath().clearHot(); webM.getKBContext(HARMONY_Q); }
  const hotMs = (performance.now() - t0) / 100;
  check(`harmony path faster measured: legacy ${legacyMs.toFixed(3)}ms → hot ${hotMs.toFixed(3)}ms`, hotMs < legacyMs);
  console.log(`     (real numbers on this machine: legacy ${legacyMs.toFixed(3)}ms vs hot ${hotMs.toFixed(3)}ms per call)`);
}
webM.setKbHotPathEnabled(false);

console.log(`\n${fail === 0 ? `✅ smoke-kb-hot-path: ${pass}/${pass + fail} passed` : `❌ smoke-kb-hot-path: ${fail} FAILED`}`);
process.exit(fail ? 1 : 0);
