/* Smoke: Cost governor (docs/05 §8 / docs/14 §3 / docs/15 §2, m13/m22) — runs
   the REAL module AND the REAL web.js wiring (repo convention: esbuild-
   transpile actual source, import() it; supabase-client stubbed).
   Covers every hard rule:
   - kill switch OFF (default) → everything allows, nothing recorded
   - free quota 40 → warn at 80% → throttle BEFORE crossing 100% of the case
   - the cap can never be bypassed (bad/missing units charge 0; charge()
     re-checks and clamps)
   - weighted tiers: free=0 rides free, medium=2, high=4, unknown=low(1)
   - governed fallback is honest: status uncertain, provider cost-governor,
     no invented text
   - LRU-bounded ledger, malformed input never throws, deterministic
   - end-to-end through chatThroughCostGovernor: off → real chat path;
     on + allow → real answer booked at the provider's DECLARED tier;
     on + throttle → honest governed response */

import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel-costgov";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });
const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", "export const sb = null;\n");
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  await build({
    entryPoints: [new URL("../performance/cost-governor.js", import.meta.url).pathname],
    bundle: true, platform: "node", format: "esm",
    outfile: join(OUT, "cost-governor.mjs"),
  });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const webM = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
const G = await import(pathToFileURL(`${OUT}/cost-governor.mjs`).href);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
}

console.log("── smoke-cost-governor ──");

/* ── 1. tier arithmetic ── */
{
  check("tiers: free=0 low=1 medium=2 high=4", G.chargeForCall("mock", "free") === 0 && G.chargeForCall("a", "low") === 1 && G.chargeForCall("b", "medium") === 2 && G.chargeForCall("c", "high") === 4);
  check("unknown provider cost → low (never rides free)", G.chargeForCall("mystery", undefined) === 1);
  check("no provider → 0 (rule brain answers without a provider)", G.chargeForCall(null, undefined) === 0);
  check("the governor itself is not a spend", G.chargeForCall("cost-governor", "high") === 0);
}

/* ── 2. kill switch OFF (default) ── */
{
  const g = G.createCostGovernor();
  check("default OFF: decide always allows", g.decide("s1", 999).decision === "allow" && g.decide("s1", 999).reason === "switch_off");
  check("default OFF: charge books nothing", g.charge("s1", 999) === false && g.stats().sessions === 0);
}

/* ── 3. quota → warn → throttle BEFORE the cap ── */
{
  const g = G.createCostGovernor({ enabled: true, freeQuota: 40, hardCap: 100 });
  const rs = [];
  for (let i = 0; i < 34; i++) { // real shape: decide BEFORE the call, charge the real 1 unit after
    rs.push(g.decide("kid-a", 1));
    g.charge("kid-a", 1);
  }
  check("40-unit quota: every call before the cap allowed", rs.every(r => r.decision === "allow"));
  check("warn fired at 80% (call #33, pre-call spend 32), exactly once", rs[32].reason === "warn_80pct" && rs[31].reason === "within_quota" && rs[33].reason === "within_quota" && rs.filter(r => r.reason === "warn_80pct").length === 1, `rs[32]=${rs[32].reason} rs[31]=${rs[31].reason}`);
  g.charge("kid-a", 32);
  const cross = g.decide("kid-a", 5); // 37 + 5 = 42 < 100 → allow
  check("between quota and cap: still allowed (throttle is not at the quota)", cross.decision === "allow");
  g.charge("kid-a", 5); // 37
  const near = g.decide("kid-a", 4); // 41 → past cap? no: 41 > 40? — the CAP is 100
  check("cap is 100, not the quota: 41 allowed", near.decision === "allow");
  g.charge("kid-a", 63); // 100
  const at = g.decide("kid-a", 1);
  check("at 100% → throttle, forever, even 1 unit", at.decision === "throttle" && at.reason === "hard_cap_reached");
  const wouldCross = (() => { const g2 = G.createCostGovernor({ enabled: true, freeQuota: 40, hardCap: 100 }); g2.charge("k", 98); return g2.decide("k", 3); })();
  check("a call that would cross the cap is throttled BEFORE it happens", wouldCross.decision === "throttle" && wouldCross.reason === "call_would_cross_cap");
}

/* ── 4. the cap can never be bypassed ── */
{
  const g = G.createCostGovernor({ enabled: true, freeQuota: 40, hardCap: 100 });
  check("malformed units charge 0", g.charge("s", NaN) === true && g.stats().spentUnits === 0);
  g.charge("s", 99);
  g.charge("s", 999); // would blow past the cap → clamped to 1
  check("charge clamps at the cap (999 requested, 1 booked)", g.stats().spentUnits === 100);
  check("negative/zero units never invent spend", (() => { const g2 = G.createCostGovernor({ enabled: true }); g2.charge("s", -5); return g2.stats().spentUnits === 0; })());
}

/* ── 5. honest governed fallback ── */
{
  const g = G.createCostGovernor({ enabled: true });
  const r = g.governedResponse({ trace_id: "t1", reason: "hard_cap_reached", spent: 100, freeQuota: 40 });
  check("throttled response: uncertain, no text, cost-governor provenance", r.status === "uncertain" && r.text === "" && r.provider === "cost-governor" && r.model === "throttle");
  check("throttled response metadata explains WHY", r.metadata.governed === true && r.metadata.reason === "hard_cap_reached" && r.metadata.spent === 100);
}

/* ── 6. bounded ledger + malformed input ── */
{
  const g = G.createCostGovernor({ enabled: true, maxSessions: 3 });
  for (let i = 0; i < 6; i++) { g.decide(`s${i}`, 1); g.charge(`s${i}`, 1); }
  check("ledger bounded at maxSessions (LRU)", g.stats().sessions === 3);
  check("malformed decide/charge never throw", g.decide(null, null).decision === "allow" && g.decide("", 1).decision === "allow" && g.charge(undefined, 5) === false);
  check("deterministic: clear resets to zero", (() => { g.clear(); return g.stats().sessions === 0 && g.stats().spentUnits === 0; })());
}

/* ── 7. end-to-end through the REAL wiring ── */
{
  webM.initTigamodelWeb();
  webM.setCostGovernorEnabled(false);
  const outOff = await webM.chatThroughCostGovernor({ message: "วันนี้ซ้อมอะไรดี", sessionKey: "sess-1" });
  check("switch OFF → the real chat path, unchanged (governed:false)", outOff && outOff.response && outOff.governed === false && outOff.response.status === "ok");

  webM.setCostGovernorEnabled(true);
  webM.costGovernor().clear();
  const out1 = await webM.chatThroughCostGovernor({ message: "วันนี้ซ้อมอะไรดี", sessionKey: "sess-2" });
  const bookedMock = G.chargeForCall("mock", "free");
  check("ON + allow: real answer served, real charge booked from declared tier (mock=free→0)", out1 && out1.response && out1.response.status === "ok" && out1.governed === true && webM.costGovernor().stats().spentUnits === bookedMock);

  // free provider never crosses anything: 100 free-provider calls stay at 0 units
  for (let i = 0; i < 100; i++) await webM.chatThroughCostGovernor({ message: `คำถามที่ ${i}`, sessionKey: "sess-3" });
  check("100 free-provider calls burn zero units (cheap stays cheap)", webM.costGovernor().stats().spentUnits === 0);

  // an expensive session: the ledger already carries real spend → the NEXT
  // call that would cross the cap is throttled through the REAL wiring
  webM.costGovernor().clear();
  webM.costGovernor().charge("sess-4", 99); // prior real spend this session (booked via the module's own API)
  const throttled = await webM.chatThroughCostGovernor({ message: "ถามหนัก", sessionKey: "sess-4", estimatedUnits: 2 });
  check("expensive session: throttle fires with the honest governed response", !!throttled && throttled.response.status === "uncertain" && throttled.response.provider === "cost-governor" && throttled.response.metadata.governed === true, JSON.stringify(webM.costGovernor().stats()));
  check("session stats reflect the real story", webM.costGovernor().stats().throttledCalls === 1 && webM.costGovernor().stats().spentUnits === 99);
}

/* ── 8. switch OFF restores the untouched path ── */
{
  webM.setCostGovernorEnabled(false);
  const out = await webM.chatThroughCostGovernor({ message: "กลับไปเส้นเดิม", sessionKey: "sess-5" });
  check("switch OFF after ON → identical real chat path again", out && out.response && out.response.status === "ok" && out.governed === false);
}

console.log(`\n${fail === 0 ? `✅ smoke-cost-governor: ${pass}/${pass + fail} passed` : `❌ smoke-cost-governor: ${fail} FAILED`}`);
process.exit(fail ? 1 : 0);
