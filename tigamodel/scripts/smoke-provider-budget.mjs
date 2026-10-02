/* Smoke: provider budget/timeout + the rule-brain fallback (docs/15 §4, m48).

   A. the module (tigamodel/performance/provider-budget.js)
      1. OFF by default: the call runs untouched, no timer, no fallback
      2. ON + a fast provider → the real answer, unchanged
      3. ON + a slow provider → the fallback (reason: budget exceeded)
      4. soft budget → a late-but-inside answer is tagged metadata.slow
      5. errors PROPAGATE (the caller's own path is not swallowed)
      6. the fallback is honest: status uncertain, provider "rule-brain",
         sources listed, lead per language, capped, and null when there is
         nothing real to show
   B. the wiring (tigamodel/web.js with a controllable fake sb)
      7. switch OFF → kbFallbackFor returns null (the chat keeps its old path)
      8. switch ON → the fallback carries the app's REAL KB lines for a real
         question, and the switch fails closed / caches / writes via the admin RPC

   Run: node tigamodel/scripts/smoke-provider-budget.mjs  (exit 1 on any fail) */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-smoke-pb";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });

const FAKE_SB = `
const rows = {};
let throwOnRead = false;
const calls = { select: 0, rpc: 0, lastRpc: null };
globalThis.__sbFake = { setRow(k, v) { if (v === undefined) delete rows[k]; else rows[k] = v; }, setThrow(v) { throwOnRead = v === true; }, calls };
export const sb = {
  from() { return { select() { return { eq(_c, key) { return { async maybeSingle() { calls.select++; if (throwOnRead) throw new Error("network down"); return { data: rows[key] ? { value: rows[key] } : null, error: null }; } } } } } }; },
  async rpc(name, args) { calls.rpc++; calls.lastRpc = { name, args }; if (name === "admin_set_app_setting") { rows[args.p_key] = args.p_value; return { data: args.p_value, error: null }; } return { data: null, error: null }; },
};
`;
const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", FAKE_SB);
try {
  execSync(`npx esbuild tigamodel/performance/provider-budget.js --bundle --outfile=${OUT}/pb.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const pb = await import(pathToFileURL(`${OUT}/pb.js`).href);
const web = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
const fake = globalThis.__sbFake;
await web.ensureTigamodelWeb();

let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

console.log("smoke-provider-budget (docs/15 §4, m48):\n");

console.log("A) โมดูล: เส้นตายจริง + คำตอบสำรองที่ซื่อสัตย์");
await check("OFF by default: the call runs untouched (no timer, no fallback)", async () => {
  const b = pb.createProviderBudget({ hardMs: 5 });
  assert.strictEqual(b.isEnabled(), false);
  let fallbackUsed = false;
  const out = await b.callWithBudget({ name: "p", run: () => new Promise(r => setTimeout(() => r({ status: "ok", text: "real" }), 40)), fallback: () => { fallbackUsed = true; return { text: "fb" }; } });
  assert.strictEqual(out.text, "real", "a slow provider still answers when the switch is off");
  assert.strictEqual(fallbackUsed, false);
});

await check("ON + a fast provider → the real answer, unchanged", async () => {
  const b = pb.createProviderBudget({ enabled: true, hardMs: 500 });
  const out = await b.callWithBudget({ name: "p", run: () => ({ status: "ok", text: "real", metadata: {} }), fallback: () => ({ text: "fb" }) });
  assert.strictEqual(out.text, "real");
  assert.ok(!out.metadata.slow, "a fast answer is not tagged slow");
});

await check("ON + a slow provider → the fallback, with the reason", async () => {
  const b = pb.createProviderBudget({ enabled: true, hardMs: 10 });
  let seen = null;
  const out = await b.callWithBudget({
    name: "piano-chat",
    run: () => new Promise(r => setTimeout(() => r({ status: "ok", text: "too late" }), 80)),
    fallback: (info) => { seen = info; return { text: "fb", provider: "rule-brain" }; },
  });
  assert.strictEqual(out.text, "fb");
  assert.strictEqual(seen.reason, "provider_budget_exceeded");
  assert.strictEqual(seen.provider, "piano-chat");
  assert.strictEqual(seen.budgetMs, 10);
});

await check("soft budget tags a late-but-inside answer (metadata.slow)", async () => {
  const b = pb.createProviderBudget({ enabled: true, softMs: 5, hardMs: 200 });
  const out = await b.callWithBudget({ name: "p", run: () => new Promise(r => setTimeout(() => r({ status: "ok", text: "late", metadata: {} }), 40)), fallback: () => ({ text: "fb" }) });
  assert.strictEqual(out.text, "late");
  assert.strictEqual(out.metadata.slow, true);
  assert.ok(out.metadata.elapsedMs >= 5, "the honest elapsed time travels with it");
});

await check("errors propagate — the caller's own path is not swallowed", async () => {
  const b = pb.createProviderBudget({ enabled: true, hardMs: 100 });
  let threw = false;
  try { await b.callWithBudget({ name: "p", run: () => { throw new Error("boom"); }, fallback: () => ({ text: "fb" }) }); }
  catch (e) { threw = /boom/.test(e.message); }
  assert.ok(threw, "the original error must reach the caller");
});

await check("the fallback is honest: uncertain + rule-brain + sources, capped, null when empty", () => {
  const block = "[TIGA KNOWLEDGE BASE …]\n• [PEDAL] เป้าหมายของเป้าหมาย — วิธีสอน: ฟังก่อนกด\n• [TECHNIQUE] นั่งให้ตรง — วิธีสอน: ไหล่ผ่อน\n• [RHYTHM] จังหวะ — วิธีสอน: นับด้วยเสียง";
  const fb = pb.kbFallbackResponse({ block, lang: "th" });
  assert.strictEqual(fb.status, "uncertain");
  assert.strictEqual(fb.provider, "rule-brain");
  assert.strictEqual(fb.confidence, null);
  assert.ok(fb.metadata.governed === true && /คลังความรู้/.test(fb.metadata.honest));
  assert.deepStrictEqual(fb.metadata.sources, ["PEDAL", "TECHNIQUE", "RHYTHM"]);
  assert.ok(fb.text.startsWith(pb.FALLBACK_LEAD.th));
  assert.ok(fb.text.includes("เป้าหมายของเป้าหมาย"), "the real line survives");
  assert.ok(fb.text.includes("[PEDAL]"), "the label stays — it is the visible provenance");
  assert.strictEqual(pb.kbFallbackResponse({ block, lang: "zh" }).text.startsWith(pb.FALLBACK_LEAD.zh), true);
  const capped = pb.kbFallbackResponse({ block, lang: "th", maxLines: 2 });
  assert.strictEqual(capped.metadata.sources.length, 2);
  assert.strictEqual(pb.kbFallbackResponse({ block: "" }), null, "nothing real → null, never a made-up answer");
  assert.strictEqual(pb.kbFallbackResponse({ block: "no lines here" }), null);
});

console.log("\nB) wiring: สวิตช์ + คำตอบจากคลังความรู้จริง");
await check("switch OFF → no fallback is ever built (the chat keeps its old path)", async () => {
  fake.setRow("tiga_provider_budget", undefined); fake.setThrow(false);
  const on = await web.refreshProviderBudgetSwitch({ force: true });
  assert.strictEqual(on, false);
  assert.strictEqual(web.kbFallbackFor("คอร์ด C กับ G สลับไม่ทัน", "th"), null);
});

await check("switch ON → the fallback carries the app's REAL KB lines", async () => {
  fake.setRow("tiga_provider_budget", { enabled: true });
  await web.refreshProviderBudgetSwitch({ force: true });
  const fb = web.kbFallbackFor("คอร์ด C กับ G สลับไม่ทัน", "th");
  assert.ok(fb && fb.text, "a real fallback was built");
  assert.strictEqual(fb.provider, "rule-brain");
  assert.ok(fb.metadata.sources.length > 0, "the labels of the served lines travel with it");
  assert.ok(/^\[/.test(fb.metadata.sources[0]) === false && fb.metadata.sources.length > 0);
  const again = web.kbFallbackFor("คอร์ด C กับ G สลับไม่ทัน", "th");
  assert.strictEqual(again.text, fb.text, "deterministic for the same question");
  // the lines must be REAL knowledge that exists in the KB, not invented
  const kb = web.getKnowledgeBaseForTest();
  const titles = new Set([...kb._entries.values()].map(e => e.title));
  const lineTitles = fb.text.split("\n").slice(1).map(l => l.replace(/^•\s*/, "").replace(/^\[[^\]]+\]\s*/, "").split(" — ")[0]);
  assert.ok(lineTitles.length > 0);
  for (const t of lineTitles) {
    assert.ok([...titles].some(x => x === t || String(x).startsWith(t.slice(0, 12))), `line not from the KB: ${t}`);
  }
});

await check("fails closed, caches, and writes through the admin RPC", async () => {
  fake.setThrow(true);
  const off = await web.refreshProviderBudgetSwitch({ force: true });
  assert.strictEqual(off, false);
  fake.setThrow(false);
  fake.setRow("tiga_provider_budget", { enabled: true });
  await web.refreshProviderBudgetSwitch({ force: true });
  const before = fake.calls.select;
  await web.refreshProviderBudgetSwitch();
  assert.strictEqual(fake.calls.select, before, "TTL: no second read");
  const on = await web.setProviderBudgetSwitch(false);
  assert.strictEqual(on, false);
  assert.strictEqual(fake.calls.lastRpc.name, "admin_set_app_setting");
  assert.strictEqual(fake.calls.lastRpc.args.p_key, "tiga_provider_budget");
});

console.log(`\nผลรวม: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
