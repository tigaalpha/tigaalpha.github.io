/* Smoke: the cost governor wired to the REAL chat path (docs/15 §2, m47).

   Runs the real tigamodel/web.js wiring (repo convention: stub
   supabase-client with a controllable fake `sb`, esbuild the real source,
   import() it, minimal localStorage) and checks what the learner path
   actually depends on:

     1. default (no app_settings row) → OFF, gate governed:false, ledger EMPTY
     2. { enabled: true } → ON, gate governed:true and allowed
     3. the REAL session key: signed-in user id → cg:<uid>:<day>, stable for
        the day, a different day is a different budget, and a guest gets a
        stable per-device id
     4. a throwing read → fail closed OFF again
     5. TTL: a second read inside 60s costs no query
     6. setCostGovernorSwitch writes through admin_set_app_setting
     7. the cost booked is the DECLARED one (ai_models row the edge function
        itself reads): the openrouter free ladder = 0 units, anthropic =
        2 (medium), an unknown provider = 1 (never free)
     8. over the ceiling → throttle BEFORE 100%, with an honest uncertain
        response (no invented text) and no further spend
     9. OFF again → the gate takes the untouched path (no ledger writes)

   Run: node tigamodel/scripts/smoke-cost-governor-switch.mjs  (exit 1 on fail) */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-smoke-cg-switch";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });

const FAKE_SB = `
const rows = {};            // app_settings key → value
let throwOnRead = false;
const state = { userId: null, calls: { select: 0, rpc: 0, lastRpc: null }, rows };
globalThis.__sbFake = {
  setRow(k, v) { if (v === undefined) delete rows[k]; else rows[k] = v; },
  setThrow(v) { throwOnRead = v === true; },
  setUser(id) { state.userId = id; },
  state,
};
export const sb = {
  auth: { async getSession() { return { data: { session: state.userId ? { user: { id: state.userId } } : null } }; } },
  from() {
    return { select() { return { eq(_c, key) { return { async maybeSingle() { state.calls.select++; if (throwOnRead) throw new Error("network down"); return { data: rows[key] ? { value: rows[key] } : null, error: null }; } } } } } };
  },
  async rpc(name, args) { state.calls.rpc++; state.calls.lastRpc = { name, args }; if (name === "admin_set_app_setting") { rows[args.p_key] = args.p_value; return { data: args.p_value, error: null }; } return { data: null, error: null }; },
};
`;
const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", FAKE_SB);
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
const store = new Map();
globalThis.localStorage = { getItem(k) { return store.has(k) ? store.get(k) : null; }, setItem(k, v) { store.set(k, String(v)); }, removeItem(k) { store.delete(k); } };

const web = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
const fake = globalThis.__sbFake;
await web.ensureTigamodelWeb();

let passed = 0, failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};
const resetLedger = () => { web.setCostGovernorEnabled(true); web.costGovernor().clear(); };

console.log("smoke-cost-governor-switch (docs/15 §2, m47):\n");

await check("default: no app_settings row → OFF, gate untouched, ledger empty", async () => {
  fake.setRow("tiga_cost_governor", undefined); fake.setThrow(false);
  const on = await web.refreshCostGovernorSwitch({ force: true });
  assert.strictEqual(on, false);
  const gate = await web.chatGovernanceGate();
  assert.strictEqual(gate.governed, false);
  assert.strictEqual(gate.throttled, false);
  assert.strictEqual(web.costGovernor().stats().sessions, 0, "an OFF switch must not open a ledger");
});

await check("app_settings { enabled: true } → ON and the gate governs", async () => {
  fake.setRow("tiga_cost_governor", { enabled: true });
  fake.setUser("user-abc");
  const on = await web.refreshCostGovernorSwitch({ force: true });
  assert.strictEqual(on, true);
  const gate = await web.chatGovernanceGate({ message: "สอนเปียโน" });
  assert.strictEqual(gate.governed, true);
  assert.strictEqual(gate.throttled, false);
});

await check("the session key is the REAL learner, bucketed by day", async () => {
  await web.refreshCostGovernorUser();
  const today = new Date().toISOString().slice(0, 10);
  const k1 = web.costGovernorSessionKey();
  const k2 = web.costGovernorSessionKey();
  assert.strictEqual(k1, `cg:user-abc:${today}`);
  assert.strictEqual(k1, k2, "same learner, same day → same budget");
  assert.notStrictEqual(web.costGovernorSessionKey("2000-01-01"), k1, "a new day is a new budget");
  fake.setUser(null);
  await web.refreshCostGovernorUser();
  const guest = web.costGovernorSessionKey();
  assert.ok(/^cg:guest-/.test(guest), `guest key looks wrong: ${guest}`);
  assert.strictEqual(guest, web.costGovernorSessionKey(), "a guest id is stable per device");
  fake.setUser("user-abc"); await web.refreshCostGovernorUser();
});

await check("a throwing read → fail-closed OFF again", async () => {
  fake.setThrow(true);
  const on = await web.refreshCostGovernorSwitch({ force: true });
  assert.strictEqual(on, false);
  const gate = await web.chatGovernanceGate();
  assert.strictEqual(gate.governed, false);
  fake.setThrow(false);
});

await check("TTL: a second read inside 60s costs no query", async () => {
  fake.setRow("tiga_cost_governor", { enabled: true });
  await web.refreshCostGovernorSwitch({ force: true });
  const before = fake.state.calls.select;
  await web.refreshCostGovernorSwitch();
  assert.strictEqual(fake.state.calls.select, before);
});

await check("setCostGovernorSwitch writes via admin_set_app_setting and applies now", async () => {
  const on = await web.setCostGovernorSwitch(true);
  assert.strictEqual(on, true);
  assert.strictEqual(fake.state.calls.lastRpc.name, "admin_set_app_setting");
  assert.strictEqual(fake.state.calls.lastRpc.args.p_key, "tiga_cost_governor");
  assert.deepStrictEqual(fake.state.calls.lastRpc.args.p_value, { enabled: true });
  assert.strictEqual(web.costGovernor().isEnabled(), true);
});

await check("the booked cost is the DECLARED one (free ladder = 0 units)", async () => {
  resetLedger();
  fake.setRow("ai_models", { chat: { provider: "openrouter", model: "openrouter/free" } });
  await web.refreshChatDeclaredCost({ force: true });
  assert.strictEqual(web.chatDeclaredCostTier(), "free");
  web.chargeGovernedChat();
  assert.strictEqual(web.costGovernor().stats().spentUnits, 0, "a free model costs no weighted units");
});

await check("anthropic chat → medium (2 units); unknown provider → never free (1)", async () => {
  resetLedger();
  fake.setRow("ai_models", { chat: { provider: "anthropic", model: "claude-sonnet-4-6" } });
  await web.refreshChatDeclaredCost({ force: true });
  assert.strictEqual(web.chatDeclaredCostTier(), "medium");
  web.chargeGovernedChat();
  assert.strictEqual(web.costGovernor().stats().spentUnits, 2);
  fake.setRow("ai_models", { chat: { provider: "some-new-lab", model: "mystery-1" } });
  await web.refreshChatDeclaredCost({ force: true });
  assert.strictEqual(web.chatDeclaredCostTier(), "low");
  web.chargeGovernedChat();
  assert.strictEqual(web.costGovernor().stats().spentUnits, 3);
  fake.setRow("ai_models", undefined);
  await web.refreshChatDeclaredCost({ force: true });
});

await check("over the ceiling → throttle BEFORE 100%, honestly, no invented text", async () => {
  resetLedger();
  fake.setRow("ai_models", { chat: { provider: "anthropic", model: "claude-sonnet-4-6" } });
  await web.refreshChatDeclaredCost({ force: true });
  const cfg = web.costGovernor().config;
  // burn 60% of the free quota → the gate still allows, and warns at 80%
  for (let i = 0; i < 12; i++) { const g = await web.chatGovernanceGate(); assert.strictEqual(g.throttled, false); web.chargeGovernedChat(); }
  let warned = false;
  for (let i = 0; i < 10; i++) {
    const g = await web.chatGovernanceGate();
    if (g.warn) warned = true;
    if (g.throttled) break;
    web.chargeGovernedChat();
  }
  assert.ok(warned, "the 80% warning must fire before the cap");
  let throttled = null;
  for (let i = 0; i < 40; i++) {
    const g = await web.chatGovernanceGate();
    if (g.throttled) { throttled = g; break; }
    web.chargeGovernedChat();
  }
  assert.ok(throttled, "the session must be throttled before the cap is crossed");
  const st = web.costGovernor().stats();
  assert.ok(st.spentUnits <= cfg.hardCap, `spent ${st.spentUnits} must never exceed the cap ${cfg.hardCap}`);
  const r = throttled.response;
  assert.strictEqual(r.status, "uncertain");
  assert.strictEqual(r.provider, "cost-governor");
  assert.strictEqual(r.text, "", "a throttle never invents an answer");
  assert.ok(r.metadata.governed === true && r.metadata.reason, "the WHY travels with the answer");
});

await check("back OFF → the gate takes the untouched path again", async () => {
  await web.setCostGovernorSwitch(false);
  const gate = await web.chatGovernanceGate();
  assert.strictEqual(gate.governed, false);
  const before = web.costGovernor().stats().sessions;
  web.chargeGovernedChat();
  assert.strictEqual(web.costGovernor().stats().sessions, before, "an OFF governor keeps an empty ledger");
});

console.log(`\nผลรวม: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
