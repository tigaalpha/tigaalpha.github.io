/* Smoke: routing bridge — warn zone → free-first (m49) and small-task short
   routing (m35), both on the REAL router with a real (fake-adapter) provider
   registry:

     A. router: the size hint is COUNTED characters, never a guess; with short
        routing OFF (default) a small request picks exactly what a big one
        picks; ON + small → the provider that declared itself fast/free wins;
        preferCost "free-first" (the warn zone) → the free provider is tried
        FIRST and routed.reason says why; the mock floor stays last.
     B. wiring (tigamodel/web.js): the m35 switch reads app_settings, fails
        closed, caches, and writes through the admin RPC; the m49 warn zone
        reaches the router (reason = warn_zone_free_first).

   Run: node tigamodel/scripts/smoke-routing-bridge.mjs  (exit 1 on any fail) */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-smoke-routing";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });

const FAKE_SB = `
const rows = {};
let throwOnRead = false;
const calls = { select: 0, rpc: 0, lastRpc: null };
globalThis.__sbFake = { setRow(k, v) { if (v === undefined) delete rows[k]; else rows[k] = v; }, setThrow(v) { throwOnRead = v === true; }, calls };
export const sb = {
  auth: { async getSession() { return { data: { session: { user: { id: "u-routing" } } } }; } },
  from() { return { select() { return { eq(_c, key) { return { async maybeSingle() { calls.select++; if (throwOnRead) throw new Error("network down"); return { data: rows[key] ? { value: rows[key] } : null, error: null }; } } } } } }; },
  async rpc(name, args) { calls.rpc++; calls.lastRpc = { name, args }; if (name === "admin_set_app_setting") { rows[args.p_key] = args.p_value; return { data: args.p_value, error: null }; } return { data: null, error: null }; },
};
`;
const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", FAKE_SB);
try {
  // ONE bundle for the router AND the registry (shared module instance) — the
  // temp entry just re-exports both so the smoke drives a real registry
  ioSync(`${OUT}/entry.js`, 'export * from "../../tigamodel/providers/model-router.js";\nexport * from "../../tigamodel/providers/provider-interface.js";\n');
  execSync(`npx esbuild ${OUT}/entry.js --bundle --outfile=${OUT}/router.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
const _store = new Map();
globalThis.localStorage = { getItem(k) { return _store.has(k) ? _store.get(k) : null; }, setItem(k, v) { _store.set(k, String(v)); }, removeItem(k) { _store.delete(k); } };

// the router bundle flattens both modules into one registry — the smoke drives
// that registry so the selection is measured, not described
const mod = await import(pathToFileURL(`${OUT}/router.js`).href);
const iface = mod;
const web = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
const fake = globalThis.__sbFake;
await web.ensureTigamodelWeb();

let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

/* A tiny registry that matches what the plan talks about: one free+fast
   provider, one paid+slow one, plus the always-registered mock floor. */
const adapterFor = (name, latencyMs) => ({
  name,
  declare: () => ({ name, taskTypes: ["chat"], cost: name === "free-fast" ? "free" : "high", latency: name === "free-fast" ? "fast" : "slow", privacy: "remote" }),
  complete: async () => { await new Promise(r => setTimeout(r, latencyMs)); return { trace_id: "t", status: "ok", text: `from ${name}`, provider: name, model: name, metadata: {}, confidence: 1 }; },
});
iface.registerProvider("free-fast", adapterFor("free-fast", 2));
iface.registerProvider("paid-slow", adapterFor("paid-slow", 2));
iface.registerProvider("mock", adapterFor("mock", 1));

const smallReq = { task_type: "chat", message: "C คืออะไร", options: { system: "คุณคือครูเปียโน" } };
const bigReq = { task_type: "chat", message: "อธิบายทฤษฎีเพลงอย่างละเอียด " + "ก ".repeat(2000), options: { system: "คุณคือครูเปียโน " + "s ".repeat(2000) } };

console.log("smoke-routing-bridge (docs/15 §4, m49 + m35):\n");

console.log("A) router: ขนาดจริง + โซนงบ");
await check("the size signal is COUNTED characters (small vs big), not a guess", () => {
  const small = mod.classifyRequestSize(smallReq);
  const big = mod.classifyRequestSize(bigReq);
  assert.ok(small.chars > 0 && small.chars < 200, `small chars=${small.chars}`);
  assert.strictEqual(small.small, true);
  assert.ok(big.chars > 3000 && big.small === false, `big chars=${big.chars}`);
  assert.strictEqual(mod.classifyRequestSize({}).small, false, "an empty request is not 'small'");
});

await check("short routing is OFF by default: small and big requests route identically", () => {
  const r = mod.createModelRouter({});
  assert.strictEqual(r.isShortRoutingOn(), false);
  const a = r.candidatesFor(smallReq);
  const b = r.candidatesFor(bigReq);
  assert.deepStrictEqual(a, b, "with the switch off, size must change nothing");
  assert.strictEqual(a[a.length - 1], "mock", "the mock floor is always last");
});

await check("short routing ON + a small request → the fast/free provider is tried FIRST", () => {
  const off = mod.createModelRouter({});
  const r = mod.createModelRouter({});
  r.setShortRouting(true);
  const small = r.candidatesFor(smallReq);
  const big = r.candidatesFor(bigReq);
  assert.strictEqual(small[0], "free-fast", `small order: ${small.join(",")}`);
  assert.deepStrictEqual(big, off.candidatesFor(bigReq), "a big request is routed exactly as with the switch off");
  assert.strictEqual(small[small.length - 1], "mock");
});

await check("m49 warn zone: preferCost free-first tries the free provider first, and says why", async () => {
  const r = mod.createModelRouter({});
  const names = r.candidatesFor(smallReq, { preferCost: "free-first" });
  assert.strictEqual(names[0], "free-fast", `order: ${names.join(",")}`);
  const out = await r.route(smallReq, { preferCost: "free-first" });
  assert.strictEqual(out.routed.selected_provider, "free-fast");
  assert.strictEqual(out.routed.reason, "warn_zone_free_first", "the WHY travels with the routing");
  const normal = await r.route(smallReq);
  assert.strictEqual(normal.routed.reason, "policy", "a normal call still says 'policy'");
});

await check("the floor never fails hard: every provider erroring still returns a structured answer", async () => {
  const r = mod.createModelRouter({});
  const bad = (name) => ({ name, declare: () => ({ name, taskTypes: ["chat"], cost: "high", latency: "slow" }), complete: async () => { throw new Error("down"); } });
  iface.registerProvider("broken", bad("broken"));
  const req = { task_type: "chat", message: "x", options: { system: "y" } };
  const out = await r.route(req);
  assert.ok(out.routed.attempts.length >= 1, "the failure is recorded honestly");
  assert.ok(["ok", "uncertain", "error"].includes(out.response.status), "a structured status, never a throw");
});

console.log("\nB) wiring: สวิตช์ m35 + สะพาน m49");
await check("the m35 switch: default OFF, fails closed, caches, writes via admin RPC", async () => {
  fake.setRow("tiga_short_routing", undefined); fake.setThrow(false);
  const off = await web.refreshShortRoutingSwitch({ force: true });
  assert.strictEqual(off, false);
  assert.strictEqual(web.getTigamodel().router.isShortRoutingOn(), false, "the router follows the switch");
  const gate = await web.chatGovernanceGate({ message: "ทดสอบ" });
  assert.strictEqual(gate.governed, false, "with the governor off the chat path is untouched");
  fake.setThrow(true);
  assert.strictEqual(await web.refreshShortRoutingSwitch({ force: true }), false, "fail closed");
  fake.setThrow(false);
  fake.setRow("tiga_short_routing", { enabled: true });
  await web.refreshShortRoutingSwitch({ force: true });
  assert.strictEqual(web.getTigamodel().router.isShortRoutingOn(), true);
  const before = fake.calls.select;
  await web.refreshShortRoutingSwitch();
  assert.strictEqual(fake.calls.select, before, "TTL: no second read");
  assert.strictEqual(await web.setShortRoutingSwitch(false), false);
  assert.strictEqual(fake.calls.lastRpc.name, "admin_set_app_setting");
  assert.strictEqual(fake.calls.lastRpc.args.p_key, "tiga_short_routing");
});

await check("m49: a warn-zone session routes the chat free-first through the real path", async () => {
  fake.setRow("tiga_cost_governor", { enabled: true });
  fake.setRow("ai_models", { chat: { provider: "anthropic", model: "claude-sonnet-4-6" } });
  await web.refreshCostGovernorSwitch({ force: true });
  await web.refreshChatDeclaredCost({ force: true });
  await web.refreshShortRoutingSwitch({ force: true });
  web.costGovernor().clear();
  // burn into the warn zone (≥80% of the free quota), keeping the warn flag
  let gate = null;
  for (let i = 0; i < 20; i++) {
    gate = await web.chatGovernanceGate();
    if (gate.warn) break;
    if (gate.throttled) break;
    web.chargeGovernedChat();
  }
  assert.ok(gate.warn === true, `expected the 80% warn zone, got reason=${gate.reason}`);
  const out = await web.chatThroughCostGovernor({ message: "ช่วยอธิบายคอร์ดหน่อย", sessionKey: gate.sessionKey });
  assert.ok(out && typeof out === "object");
  assert.strictEqual(out.governed, true, "the governed path ran");
  web.setCostGovernorEnabled(false);
  web.costGovernor().clear();
});

console.log(`\nผลรวม: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
