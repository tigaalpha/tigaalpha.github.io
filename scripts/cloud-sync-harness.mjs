// Test harness for cloud-sync.ts: bundles the REAL module with esbuild and runs one instance per simulated device,
// each with its own localStorage, against an in-memory model of the sync_cloud_state RPC
// (supabase-cloud-state-sync-migration.sql: key <= 64 chars, replace only when the incoming client_ts is strictly newer,
// ts clamped to [2000-01-01, now + 5 min], every row of the user returned on every call). No network.
import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let _code = null;
export async function moduleCode() {
  if (_code) return _code;
  const r = await esbuild.build({
    entryPoints: [path.join(ROOT, "cloud-sync.ts")], bundle: true, format: "iife", globalName: "M", write: false, platform: "neutral", target: "es2020",
    plugins: [{ name: "stub-sb", setup(b) {
      b.onResolve({ filter: /supabase-client/ }, () => ({ path: "sb", namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const sb = __SB__;", loader: "js" }));
    } }],
  });
  _code = r.outputFiles[0].text;
  return _code;
}

export function makeClock(startIso = "2026-11-05T10:00:00") { return { now: new Date(startIso).getTime(), tick(ms = 1000) { this.now += ms; return this.now; } }; }

export function makeStorage() {
  const m = new Map();
  return {
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(String(k), String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(),
    _m: m,
  };
}

export function makeServer(clock, limits = {}) {
  const users = new Map();          // uid -> Map(key -> {value, client_ts(ms)})
  const sent = [];                  // every key every device ever sent: {uid, device, key, value}
  const s = {
    users, sent, calls: 0, down: false, hold: null, drop: [],
    rows(uid) { if (!users.has(uid)) users.set(uid, new Map()); return users.get(uid); },
    async rpc(uid, device, fn, args) {
      s.calls++;
      if (fn !== "sync_cloud_state") return { data: null, error: { message: "no such function" } };
      if (s.down) return { data: null, error: { message: "offline" } };
      if (s.hold) await s.hold;
      if (!uid) return { data: null, error: { message: "not authenticated" } };
      const upd = args.p_updates;
      if (!upd || typeof upd !== "object" || Array.isArray(upd)) return { data: null, error: { message: "invalid payload" } };
      const rows = s.rows(uid);
      for (const [k, e] of Object.entries(upd)) {
        if (!e || typeof e !== "object" || !("v" in e) || !("ts" in e)) continue;
        sent.push({ uid, device, key: k, value: e.v, len: k.length });
        if (k.length > 64 || k === "") continue;
        const bytes = JSON.stringify(e.v === undefined ? null : e.v).length;
        if (limits.maxBytes && bytes > limits.maxBytes) throw new Error("row too big " + k);
        let ts = Number(e.ts); if (!isFinite(ts) || ts <= 0) continue;
        ts = Math.min(Math.max(ts, Date.UTC(2000, 0, 1)), clock.now + 5 * 60000);
        const ex = rows.get(k);
        if (!ex || ex.client_ts < ts) rows.set(k, { value: e.v === undefined ? null : JSON.parse(JSON.stringify(e.v)), client_ts: ts });
      }
      const data = [...rows.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([key, r]) => ({ key, value: JSON.parse(JSON.stringify(r.value)), client_ts: new Date(r.client_ts).toISOString(), updated_at: new Date(clock.now).toISOString() }));
      return { data, error: null };
    },
    cloud(uid, key) { const r = s.rows(uid).get(key); return r ? r.value : undefined; },
    sentKeys(filter = () => true) { return new Set(sent.filter(filter).map((x) => x.key)); },
  };
  return s;
}

export async function makeDevice(name, server, clock) {
  const code = await moduleCode();
  const ls = makeStorage();
  const events = [];
  const listeners = {};
  const win = {
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }, removeEventListener(t, f) { listeners[t] = (listeners[t] || []).filter((x) => x !== f); },
    dispatchEvent(ev) { events.push(ev); (listeners[ev.type] || []).forEach((f) => f(ev)); return true; },
  };
  const doc = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  const RealDate = Date;
  class FDate extends RealDate { constructor(...a) { if (a.length === 0) super(clock.now); else super(...a); } static now() { return clock.now; } }
  const dev = { name, ls, events, uid: null, win, doc };
  const sbStub = { rpc: (fn, args) => server.rpc(dev.uid, name, fn, args) };
  const fn = new Function("localStorage", "window", "document", "__SB__", "Date", "setInterval", "clearInterval", "CustomEvent", code + "\n;return M;");
  class CE { constructor(type, init) { this.type = type; this.detail = init && init.detail; } }
  dev.mod = fn(ls, win, doc, sbStub, FDate, (f) => { dev._tick = f; return 1; }, () => {}, CE);
  dev.signIn = (uid) => { dev.uid = uid; dev.mod.startCloudSync(uid); };
  dev.signOut = () => { dev.mod.stopCloudSync(); dev.uid = null; };
  dev.sync = async () => { clock.tick(); await dev.mod.cloudSyncNow(); clock.tick(); };
  dev.tick = async () => { clock.tick(); if (dev._tick) dev._tick(); for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };
  dev.set = (k, v) => ls.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  dev.get = (k) => ls.getItem(k);
  dev.json = (k) => { const v = ls.getItem(k); try { return JSON.parse(v); } catch (e) { return v; } };
  dev.del = (k) => ls.removeItem(k);
  dev.snapshot = () => { const o = {}; for (const [k, v] of ls._m) o[k] = v; return o; };
  dev.pulledEvents = () => events.filter((e) => e.type === "tiga:cloud-pulled").length;
  return dev;
}
