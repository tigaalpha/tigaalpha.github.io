// Plan 27 · P0: drives the REAL usePracticeMode hook (bundled with esbuild, rendered in jsdom) and checks that a microphone reading
// that does not match the target is not charged as a miss until it repeats, that taps and MIDI are still judged at once, that the
// app's own note is not heard back, and that only real misses reach the by-day weak-notes log.
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
  plugins: [{ name: "stub-assets", setup(b) { b.onResolve({ filter: /\?(url|raw|worker&url|worker)$/ }, (a) => ({ path: a.path, namespace: "asset" })); b.onLoad({ filter: /.*/, namespace: "asset" }, () => ({ loader: "js", contents: "export default \"\";" })); } }, { name: "stub-supabase", setup(b) { b.onResolve({ filter: /supabase-client$/ }, () => ({ path: "sb", namespace: "stub" })); b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ loader: "js", contents: "const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null }), then: (r) => r({ data: null, error: null }) }; export const SUPABASE_URL = 'http://sb'; export const SUPABASE_ANON_KEY = 'anon'; export const sb = { from: () => q, rpc: async () => ({ data: null, error: null }), auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, functions: { invoke: async () => ({ data: null }) }, channel: () => ({ on() { return this; }, subscribe() { return this; } }) };" })); } }], define: { "import.meta.env": "{}" }, banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); };
const mod = await import(out);
const h = await mod.run();
const { act } = h;
const play = (d) => act(async () => { h.H.practiceHandlerRef.current(d); });
await act(async () => { try { await h.H.startPractice(); } catch (e) { /* no audio/mic in jsdom: the listener fails, the drill is open */ } });
check("drill open (a scale goes up and comes back down)", h.H.practiceTarget.length === 7, JSON.stringify(h.H.practiceTarget));
const miss = () => h.H.practiceMiss;
// a microphone reading of A while C is due
await play({ note: "A4", freq: 440, source: "mic" });
check("one mismatching mic reading is not a miss", miss() === 0, "miss=" + miss());
check("…it is shown as doubt", h.H.practiceHeard && h.H.practiceHeard.doubt === true);
await play({ note: "A4", freq: 440, source: "mic" });
check("the same wrong note again inside 2.5 s is a miss", miss() === 1, "miss=" + miss());
// a tap that is wrong is judged at once
await play({ note: "G4", freq: null, source: "screen" });
check("a wrong TAP is a miss at once", miss() === 2, "miss=" + miss());
// right note by tap advances and mutes the mic for a moment
await play({ note: "C4", freq: null, source: "screen" });
check("the right tap advances", h.H.practiceIdx === 1);
await play({ note: "D4", freq: 294, source: "mic" });
check("the app's own note is not heard back: the next note by mic inside 450 ms does not count", h.H.practiceIdx === 1, "idx=" + h.H.practiceIdx);
const realNow = Date.now; Date.now = () => realNow() + 600;
await play({ note: "D4", freq: 294, source: "mic" });
Date.now = realNow;
check("…and 600 ms later the same reading advances", h.H.practiceIdx === 2, "idx=" + h.H.practiceIdx);
const log = JSON.parse(localStorage.getItem("tg_note_miss_d") || "{}");
check("nothing in the by-day log yet (it is written when the round ends)", Object.keys(log).length === 0);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
