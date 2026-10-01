/* Smoke: the KB hot path's kill switch reads app_settings (docs/14 §2, m44) —
   runs the REAL web.js wiring (repo convention: esbuild-transpile the actual
   source, import() it; supabase-client replaced by a stub whose answers this
   script controls, minimal localStorage). Covers:
   - never read yet → OFF, and getKBContext serves the legacy block (the baseline)
   - { enabled: true } → ON: getFullKBContext serves the capped block
   - cached for 60 s: a second ask costs no query; force re-reads
   - fails closed: no row, { enabled: false }, a non-boolean, {} and a throwing
     read all mean OFF, and OFF is byte-identical to the legacy block
   - setKbHotPathSwitch writes through admin_set_app_setting (key + value) and
     applies at once; a refused write throws and changes nothing
   - a slow settings read never holds a chat answer back for more than a moment */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-hotpath-switch";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });
const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", `export const sb = {
  from: (t) => ({ select: () => ({ eq: (c, k) => ({ maybeSingle: () => globalThis.__sbRead(t, c, k) }) }) }),
  rpc: (name, args) => globalThis.__sbRpc(name, args),
};\n`);
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

/* what the stub's app_settings answers, and how often it was asked for the switch */
let row = { data: { value: { enabled: true } } };
let delayMs = 0;
let switchReads = 0;
let rpcCalls = [];
let rpcError = null;
globalThis.__sbRead = async (table, col, key) => {
  if (table === "app_settings" && key === "tiga_kb_hot_path") {
    switchReads++;
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    if (row === "throw") throw new Error("network down");
    return row;
  }
  return { data: null }; // every other setting (self-learning, jev policy…) is off / absent
};
globalThis.__sbRpc = async (name, args) => { rpcCalls.push({ name, args }); return { error: rpcError }; };

const web = await import(pathToFileURL(`${OUT}/p4/web.js`).href);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
}
console.log("── smoke-kb-hot-path-switch ──");
const Q = "คอร์ด C กับ G สลับไม่ทัน"; // the measured worst case: harmony, 12,615 entries
web.initTigamodelWeb();

/* 1. before anything is read: OFF, legacy */
const legacy = web.getKBContext(Q);
check("never read: the switch is OFF", web.kbHotPath().isEnabled() === false);
check("never read: the block is the legacy giant (>1,000,000 chars)", legacy.length > 1000000, `got ${legacy.length}`);

/* 2. { enabled: true } → ON through getFullKBContext, one query */
row = { data: { value: { enabled: true } } };
const hot = await web.getFullKBContext(Q);
check("app_settings { enabled: true } → ON", web.kbHotPath().isEnabled() === true);
check("the chat's block is capped (<20,000 chars, was >1,000,000)", hot.length < 20000 && hot.length > 0, `got ${hot.length}`);
check("exactly one read of the switch", switchReads === 1, `reads ${switchReads}`);

/* 3. cache: a second ask costs no query; force re-reads */
await web.getFullKBContext(Q);
check("cached for 60 s: no second read", switchReads === 1, `reads ${switchReads}`);
row = { data: { value: { enabled: false } } };
await web.getFullKBContext(Q);
check("still cached: a change in the table waits for the minute", web.kbHotPath().isEnabled() === true && switchReads === 1);
const forced = await web.refreshKbHotPathSwitch({ force: true });
check("force re-reads and applies { enabled: false }", forced === false && web.kbHotPath().isEnabled() === false && switchReads === 2, `reads ${switchReads}`);
check("OFF again → byte-identical legacy block", web.getKBContext(Q) === legacy);

/* 4. fails closed */
const cases = [
  ["no row", { data: null }],
  ["a non-boolean ({ enabled: \"true\" })", { data: { value: { enabled: "true" } } }],
  ["an empty value ({})", { data: { value: {} } }],
  ["an error object", { data: null, error: { message: "denied" } }],
  ["a throwing read", "throw"],
];
for (const [label, r] of cases) {
  row = { data: { value: { enabled: true } } };
  await web.refreshKbHotPathSwitch({ force: true });
  const wasOn = web.kbHotPath().isEnabled();
  row = r;
  await web.refreshKbHotPathSwitch({ force: true });
  check(`fails closed on ${label}`, wasOn === true && web.kbHotPath().isEnabled() === false);
}
check("failed closed → still the byte-identical legacy block", web.getKBContext(Q) === legacy);

/* 5. admin write: through admin_set_app_setting, applied at once; a refusal throws and changes nothing */
rpcCalls = []; rpcError = null;
const on1 = await web.setKbHotPathSwitch(true);
check("setKbHotPathSwitch(true) calls admin_set_app_setting with the key and { enabled: true }",
  rpcCalls.length === 1 && rpcCalls[0].name === "admin_set_app_setting" && rpcCalls[0].args.p_key === "tiga_kb_hot_path" && rpcCalls[0].args.p_value.enabled === true, JSON.stringify(rpcCalls));
check("…and it is ON on this device at once", on1 === true && web.kbHotPath().isEnabled() === true);
rpcCalls = []; rpcError = { message: "not allowed" };
let threw = false;
try { await web.setKbHotPathSwitch(false); } catch (e) { threw = /not allowed/.test(String(e.message)); }
check("a refused write throws the server's reason", threw === true);
check("…and changes nothing on this device", web.kbHotPath().isEnabled() === true);
rpcError = null;
await web.setKbHotPathSwitch(false);
check("setKbHotPathSwitch(false) turns it OFF", web.kbHotPath().isEnabled() === false && rpcCalls.at(-1).args.p_value.enabled === false);

/* 6. a slow settings read never holds an answer back (fresh module: nothing read yet, so the read really is awaited) */
{
  const fresh = await import(pathToFileURL(`${OUT}/p4/web.js`).href + "?fresh=1");
  fresh.initTigamodelWeb();
  row = { data: { value: { enabled: true } } };
  delayMs = 1500;
  const readsBefore = switchReads;
  const t0 = Date.now();
  const slowBlock = await fresh.getFullKBContext(Q);
  const waited = Date.now() - t0;
  check(`getFullKBContext waited ${waited} ms for a 1500 ms settings read (cap ~400 ms)`, waited >= 300 && waited < 1200, `${waited} ms`);
  check("…and served the state it had (OFF → legacy) rather than nothing", slowBlock.length > 1000000, `got ${slowBlock.length}`);
  check("the slow read was started once", switchReads === readsBefore + 1, `reads ${switchReads - readsBefore}`);
  await new Promise(r => setTimeout(r, 1500));
  check("the slow read still lands afterwards and turns it ON", fresh.kbHotPath().isEnabled() === true);
  delayMs = 0;
  fresh.setKbHotPathEnabled(false);
}
web.setKbHotPathEnabled(false);

console.log(`\n${fail === 0 ? `✅ smoke-kb-hot-path-switch: ${pass}/${pass + fail} passed` : `❌ smoke-kb-hot-path-switch: ${fail} FAILED`}`);
process.exit(fail ? 1 : 0);
