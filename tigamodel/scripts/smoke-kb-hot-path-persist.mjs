/* Smoke: hot counts across sessions (docs/14 §2, m45).

   Two halves, both on the real code:
     A. the module (tigamodel/performance/kb-hot-path.js): snapshotHot() exports
        the REAL serving order, bounded; restoreHot() takes it back and refuses
        garbage; restoring while the switch is OFF is a no-op; determinism.
     B. the wiring (tigamodel/web.js): serving with the switch ON writes a
        bounded list to device storage, the admin clear removes it, turning the
        switch ON resumes the saved order, and with the switch OFF nothing is
        written at all (behaviour = the legacy path).

   Run: node tigamodel/scripts/smoke-kb-hot-path-persist.mjs  (exit 1 on any fail) */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-smoke-hot-persist";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });

const FAKE_SB = `
const rows = {};
globalThis.__sbFake = { setRow(k, v) { if (v === undefined) delete rows[k]; else rows[k] = v; } };
export const sb = {
  from() { return { select() { return { eq(_c, key) { return { async maybeSingle() { return { data: rows[key] ? { value: rows[key] } : null, error: null }; } } } } } }; },
  async rpc(name, args) { if (name === "admin_set_app_setting") { rows[args.p_key] = args.p_value; return { data: args.p_value, error: null }; } return { data: null, error: null }; },
};
`;
const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", FAKE_SB);
try {
  execSync(`npx esbuild tigamodel/performance/kb-hot-path.js --bundle --outfile=${OUT}/hot.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
const store = new Map();
globalThis.localStorage = { getItem(k) { return store.has(k) ? store.get(k) : null; }, setItem(k, v) { store.set(k, String(v)); }, removeItem(k) { store.delete(k); } };

const hp = await import(pathToFileURL(`${OUT}/hot.js`).href);
const web = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
const fake = globalThis.__sbFake;
await web.ensureTigamodelWeb();

let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const KEY = "tiga_kb_hot_counts";

console.log("smoke-kb-hot-path-persist (docs/14 §2, m45):\n");

console.log("A) โมดูล: snapshot/restore ของลำดับการเสิร์ฟจริง");
await check("snapshotHot returns only REAL serves, most-served first", () => {
  const a = hp.createKBHotPath({ enabled: true });
  a.recordServed(["x", "y", "z", "y", "y", "z", "x"]);
  const snap = a.snapshotHot();
  assert.deepStrictEqual(snap, [["y", 3], ["x", 2], ["z", 2]], "ties break by id, so the order is deterministic");
  assert.strictEqual(a.hotCount("y"), 3);
});

await check("snapshotHot is bounded (cap honoured, no unbounded growth)", () => {
  const a = hp.createKBHotPath({ enabled: true });
  const ids = Array.from({ length: 260 }, (_, i) => `id-${i}`);
  a.recordServed(ids);
  const capped = a.snapshotHot(50);
  assert.strictEqual(capped.length, 50);
  assert.ok(a.snapshotHot().length <= 200, "the default snapshot is capped at 200");
});

await check("restoreHot brings the counts back into a fresh instance", () => {
  const a = hp.createKBHotPath({ enabled: true });
  a.recordServed(["p", "q", "q", "q", "r"]);
  const snap = a.snapshotHot();
  const b = hp.createKBHotPath({ enabled: true });
  const n = b.restoreHot(snap);
  assert.strictEqual(n, 3);
  assert.strictEqual(b.hotCount("q"), 3);
  assert.deepStrictEqual(b.snapshotHot(), snap);
});

await check("restoreHot refuses garbage (bad rows, non-numbers, disabled switch)", () => {
  const a = hp.createKBHotPath({ enabled: true });
  const n = a.restoreHot([["ok", 2], ["bad", -1], ["nan", "x"], ["zero", 0], "not-a-row", ["", 5], ["big", 1e9]]);
  assert.strictEqual(n, 2, "only the valid positive rows count (ok, big)");
  assert.strictEqual(a.hotCount("bad"), 0);
  assert.strictEqual(a.hotCount("nan"), 0);
  const off = hp.createKBHotPath({ enabled: false });
  assert.strictEqual(off.restoreHot([["a", 9]]), 0, "OFF = restore is a no-op");
  assert.strictEqual(off.hotCount("a"), 0);
});

await check("determinism: the same serves always snapshot the same way", () => {
  const a = hp.createKBHotPath({ enabled: true });
  a.recordServed(["m", "n", "n", "m", "o"]);
  const b = hp.createKBHotPath({ enabled: true });
  b.recordServed(["m", "n", "n", "m", "o"]);
  assert.deepStrictEqual(a.snapshotHot(), b.snapshotHot());
});

console.log("\nB) wiring: device storage, bounded, guest-safe, inert when OFF");
await check("switch OFF → serving writes nothing to storage", async () => {
  fake.setRow("tiga_kb_hot_path", undefined);
  await web.refreshKbHotPathSwitch({ force: true });
  web.getKBContext("คอร์ด C กับ G สลับไม่ทัน");
  await sleep(1700);
  assert.strictEqual(localStorage.getItem(KEY), null);
});

await check("switch ON → real serves are persisted, bounded", async () => {
  fake.setRow("tiga_kb_hot_path", { enabled: true });
  await web.refreshKbHotPathSwitch({ force: true });
  web.getKBContext("คอร์ด C กับ G สลับไม่ทัน");
  web.getKBContext("คอร์ด C กับ G สลับไม่ทัน");
  await sleep(1700);
  const raw = localStorage.getItem(KEY);
  assert.ok(raw, "the store was written after real serves");
  const v = JSON.parse(raw);
  assert.ok(Array.isArray(v) && v.length > 0, "ids + counts only");
  assert.ok(v.length <= 200, `bounded: ${v.length}`);
  assert.ok(v.every(r => Array.isArray(r) && r.length === 2 && typeof r[1] === "number"), "shape is [id, count]");
});

await check("clearing removes the store and the in-memory counts", () => {
  web.clearKbHotCounts();
  assert.strictEqual(localStorage.getItem(KEY), null);
  assert.strictEqual(web.kbHotCountStore().entries, 0);
});

await check("turning the switch ON resumes the saved order", async () => {
  localStorage.setItem(KEY, JSON.stringify([["saved-a", 7], ["saved-b", 3]]));
  web.setKbHotPathEnabled(false);
  await web.refreshKbHotPathSwitch({ force: true });
  assert.strictEqual(web.kbHotPath().hotCount("saved-a"), 7, "the saved serving order came back");
  assert.strictEqual(web.kbHotPath().hotCount("saved-b"), 3);
});

console.log(`\nผลรวม: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
