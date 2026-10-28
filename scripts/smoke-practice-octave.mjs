// Practice Mode judges by PITCH CLASS: the right note in any octave passes (tap, MIDI and microphone), owner 2026-10-28.
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><div id=r></div>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "localStorage", "sessionStorage", "navigator", "HTMLElement", "Node", "Event", "CustomEvent"]) { try { globalThis[k] = dom.window[k]; } catch (e) { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); } }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
import { mkdirSync } from "node:fs";
const dir = path.join(process.cwd(), "node_modules", ".smoke-pm"); mkdirSync(dir, { recursive: true });
const entry = path.join(dir, "h.tsx");
const root = process.cwd();
writeFileSync(entry, `
import React, { useRef } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { usePracticeMode } from ${JSON.stringify(root + "/use-practice-mode.ts")};
export { kidModeOn } from ${JSON.stringify(root + "/shared-infra.ts")};
let H = null;
function C() {
  const lastSeq = useRef({ mode: "scale", label: "C major", notes: ["C4","D4","E4","F4"], fingers: [1,2,3,1] });
  H = usePracticeMode({ hand: "right", chordStyle: "broken", setChordStyle() {}, lastSeq, clearSeq() {}, earnCoins() {}, gainExp() {}, grantPracticeGem() {}, isGuest: true, lang: "en", bumpWeekly() {} });
  return null;
}
export async function run() {
  const el = document.getElementById("r");
  await act(async () => { createRoot(el).render(React.createElement(C)); });
  return { get H() { return H; }, act };
}
`);
const out = path.join(dir, "h.mjs");
await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error", external: ["react", "react-dom", "react-dom/client", "react-dom/test-utils"], loader: { ".js": "jsx" },
  plugins: [{ name: "stub-assets", setup(b) { b.onResolve({ filter: /\?(url|raw|worker&url|worker)$/ }, (a) => ({ path: a.path, namespace: "asset" })); b.onLoad({ filter: /.*/, namespace: "asset" }, () => ({ loader: "js", contents: "export default \"\";" })); } }, { name: "stub-supabase", setup(b) { b.onResolve({ filter: /supabase-client$/ }, () => ({ path: "sb", namespace: "stub" })); b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ loader: "js", contents: "const q = { select: () => q, eq: () => q, insert: async () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }), update: () => q, maybeSingle: async () => ({ data: null }), then: (r) => r({ data: null, error: null }) }; export const SUPABASE_URL = 'http://sb'; export const SUPABASE_ANON_KEY = 'anon'; export const sb = { from: () => q, rpc: async () => ({ data: null, error: null }), auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, functions: { invoke: async () => ({ data: null }) }, channel: () => ({ on() { return this; }, subscribe() { return this; } }) };" })); } }], define: { "import.meta.env": "{}" }, banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); };
const mod = await import(out);
const h = await mod.run();
const { act } = h;
const play = (d) => act(async () => { h.H.practiceHandlerRef.current(d); });
await act(async () => { try { await h.H.startPractice(); } catch (e) { /* no audio/mic in jsdom: the listener fails, the drill is open */ } });
check("drill open (a scale goes up and comes back down)", h.H.practiceTarget.length === 7, JSON.stringify(h.H.practiceTarget));
const miss = () => h.H.practiceMiss;
const fq = (n, oct) => 440 * Math.pow(2, (n - 9) / 12 + (oct - 4));   // pitch class n (C=0) in octave oct
const idx = () => h.H.practiceIdx;
const NOTES = ["C", "D", "E", "F", "G", "A", "B"], PCN = [0, 2, 4, 5, 7, 9, 11];
// target C4 D4 E4 F4 ...: answer each step in a different octave through each input kind
const oct = [2, 3, 5, 6, 3, 5, 2];
for (const src of ["screen", "midi", "mic"]) {
  await act(async () => { try { await h.H.startPractice(); } catch (e) {} });
  let ok = true; if (src === "mic") await new Promise(r => setTimeout(r, 2000));
  for (let i = 0; i < 4; i++) {
    const before = idx();
    const nm = h.H.practiceTarget[i].replace(/-?\d+$/, "");
    const k = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"].indexOf(nm);
    const o = oct[i];
    await play(src === "mic" ? { note: nm + o, freq: fq(k, o), source: "mic", clarity: 0.95, centsSpread: 5 } : { note: nm + o, freq: null, source: src });
    if (idx() !== before + 1) { ok = false; console.log("  step", i, nm + o, "idx", before, "->", idx(), "miss", miss()); }
    await new Promise(r => setTimeout(r, src === "mic" ? 2000 : 30));
  }
  check(src + ": the right notes in low and high octaves all advance", ok && miss() === 0, "miss=" + miss());
}
// fast playing: two right notes 150 ms apart by microphone must BOTH count (the app used to echo the first and mute the mic for 450 ms)
await act(async () => { try { await h.H.startPractice(); } catch (e) {} });
await new Promise(r => setTimeout(r, 2000));
const i0 = idx();
await play({ note: "C4", freq: fq(0, 4), source: "mic", clarity: 0.95, centsSpread: 5 });
await new Promise(r => setTimeout(r, 150));
await play({ note: "D4", freq: fq(2, 4), source: "mic", clarity: 0.95, centsSpread: 5 });
check("two right mic notes 150 ms apart both count", idx() === i0 + 2, "idx " + i0 + " -> " + idx());
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
