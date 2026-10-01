#!/usr/bin/env node
/* verify-speech.mjs — runs the REAL speech.ts (transpiled with esbuild, its imports stubbed) against a fake audio
   context and a fake piano-tts, to prove the rules the chat's read-aloud button depends on:

     node scripts/verify-speech.mjs

   - a second speakCloud() call takes over from one that is still fetching: the older one never plays, never calls back
     (before the run token, the next call set the shared cancel flag back to false and the older clip played over it)
   - stopCloudTTS() while a clip is playing stops it, and nothing speaks afterwards
   - a clip that has to be paid for first asks the caller's allowance (opts.spend); a refusal reaches onError with
     error.budget, and no request is made
   - a failed request gives the allowance back (opts.refund); a stop mid-request does not
   - the day's allowance (ttsBudgetSpend / ttsBudgetRefund) adds up, refuses what does not fit, and resets on a new day
   - the language of a message is read from the message (Thai / Mandarin / English, mixed text) */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);

// ── the world speech.ts talks to ──
const STUBS = {
  "./music-engine": `export function getAC() { return globalThis.__ac; }`,
  "./native-stt": `export const nativeSTTAvailable = () => false; export class NativeSpeechRecognition {}`,
  "./ai-backend": `export const TTS_URL = "https://stub/piano-tts"; export function apiHeaders() { return { "Content-Type": "application/json" }; }`,
  "@capacitor/core": `export const Capacitor = { isNativePlatform: () => false };`,
};
const r = await build({
  entryPoints: [process.env.SPEECH_SRC || path.join(ROOT, "speech.ts")], bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent",
  plugins: [{ name: "stub", setup(b) {
    b.onResolve({ filter: /^(\.\/(music-engine|native-stt|ai-backend)|@capacitor\/core)$/ }, a => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, a => ({ contents: STUBS[a.path], loader: "js" }));
  } }],
});
const tmp = path.join(ROOT, "node_modules/.cache", "speech-verify.mjs");
fs.mkdirSync(path.dirname(tmp), { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { if (ok) pass++; else fail++; console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function freshWorld() {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.window = globalThis;
  globalThis.__played = []; globalThis.__fetches = [];
  globalThis.__ac = {
    state: "running", destination: {}, resume: async () => {},
    decodeAudioData: async (buf) => ({ id: buf.byteLength }),
    createBufferSource() {
      const n = { buffer: null, playbackRate: { value: 1 }, connect() {}, onended: null,
        start() { globalThis.__played.push(this.buffer.id); this._t = setTimeout(() => this.onended && this.onended(), globalThis.__clipMs || 60); },
        stop() { clearTimeout(this._t); setTimeout(() => this.onended && this.onended(), 0); } };
      return n;
    },
  };
  globalThis.__clipMs = 60;
}
// a fake piano-tts: each request answers after `delay` ms with a clip whose size says which text it was (so "which one played" is visible)
function fakeTts({ delay = 0, fail = false } = {}) {
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    globalThis.__fetches.push(body);
    await sleep(delay);
    if (fail) return { ok: false, status: 500, json: async () => ({ error: "stub" }) };
    const q = /"([\s\S]*)"/.exec(body.text);
    const bytes = Buffer.alloc(100 + (q ? q[1].length : 0)).toString("base64");
    return { ok: true, status: 200, json: async () => ({ audio: bytes }) };
  };
}

let n = 0;
async function load() {
  const f = tmp.replace(".mjs", `-${n++}.mjs`);
  fs.writeFileSync(f, r.outputFiles[0].text);
  return await import(pathToFileURL(f).href);
}

// 1. language of a message
{
  freshWorld();
  const S = await load();
  check("lang-thai", S.detectSpeechLang("สวัสดีครับ วันนี้ซ้อมสเกลกัน") === "th");
  check("lang-english", S.detectSpeechLang("Hello, let us practise the C major scale") === "en");
  check("lang-chinese", S.detectSpeechLang("你好，今天我们练习 C 大调音阶") === "zh");
  check("lang-thai-with-english-terms", S.detectSpeechLang("ลองเล่น C major scale และ arpeggio ช้า ๆ ครับ") === "th");
  check("lang-english-with-one-thai-word", S.detectSpeechLang("This is a long English answer about scales and chords, ครับ") === "en");
  check("lang-fallback-for-numbers", S.detectSpeechLang("1 2 3", "zh") === "zh");
}

// 2. the day's allowance
{
  freshWorld();
  const S = await load();
  check("budget-starts-full", S.ttsBudgetLeft() === S.TTS_DAILY_SECONDS);
  check("budget-spends", S.ttsBudgetSpend(100) === true && Math.abs(S.ttsBudgetLeft() - (S.TTS_DAILY_SECONDS - 100)) < 0.01);
  check("budget-refuses-what-does-not-fit", S.ttsBudgetSpend(S.TTS_DAILY_SECONDS) === false && Math.abs(S.ttsBudgetLeft() - (S.TTS_DAILY_SECONDS - 100)) < 0.01, "a refusal takes nothing");
  S.ttsBudgetRefund(40);
  check("budget-refund", Math.abs(S.ttsBudgetLeft() - (S.TTS_DAILY_SECONDS - 60)) < 0.01);
  S.ttsBudgetRefund(9999);
  check("budget-refund-never-above-full", S.ttsBudgetLeft() === S.TTS_DAILY_SECONDS);
  localStorage.setItem("tg_tts_day", JSON.stringify({ d: "1999-1-1", s: 250 }));
  check("budget-new-day-resets", S.ttsBudgetLeft() === S.TTS_DAILY_SECONDS);
  check("speech-seconds-estimate", S.ttsEstSeconds("a".repeat(150), "en") === 10 && S.ttsEstSeconds("你".repeat(45), "zh") === 10);
}

// 3. one call after another: the newer one wins
{
  freshWorld(); fakeTts({ delay: 120 });
  const S = await load();
  const ev = [];
  const a = S.speakCloud("first message here", "en", () => ev.push("A start"), () => ev.push("A done"), (e) => ev.push("A error " + e), 1, null);
  await sleep(20);
  const b = S.speakCloud("second", "en", () => ev.push("B start"), () => ev.push("B done"), (e) => ev.push("B error " + e), 1, null);
  await Promise.all([a, b]); await sleep(150);
  check("takeover-newer-plays-older-silent", ev.join(",") === "B start,B done", ev.join(","));
  check("takeover-only-newer-clip-played", globalThis.__played.length === 1, "clips played: " + globalThis.__played.length);
}

// 4. a stop while fetching, and a stop while playing
{
  freshWorld(); fakeTts({ delay: 100 });
  const S = await load();
  const ev = [];
  const a = S.speakCloud("stop me early", "en", () => ev.push("start"), () => ev.push("done"), (e) => ev.push("error"), 1, null);
  await sleep(20); S.stopCloudTTS();
  await a; await sleep(150);
  check("stop-while-fetching-plays-nothing", ev.length === 0 && globalThis.__played.length === 0, ev.join(",") + " / played " + globalThis.__played.length);

  freshWorld(); fakeTts({ delay: 0 }); globalThis.__clipMs = 400;
  const S2 = await load();
  const ev2 = [];
  const p = S2.speakCloud("stop me mid-clip", "en", () => ev2.push("start"), () => ev2.push("done"), () => ev2.push("error"), 1, null);
  await sleep(150); S2.stopCloudTTS();
  await p; await sleep(100);
  check("stop-while-playing-ends-quietly", ev2.join(",") === "start", ev2.join(","));
}

// 5. the allowance gate and the refund
{
  freshWorld(); fakeTts({ delay: 0 });
  const S = await load();
  let err = null;
  await S.speakCloud("too expensive", "en", null, () => {}, (e) => { err = e; }, 1, { src: "chat", spend: () => false, refund: () => {} });
  check("budget-refusal-reaches-onError", !!err && err.budget === true && globalThis.__fetches.length === 0, JSON.stringify({ budget: err && err.budget, requests: globalThis.__fetches.length }));

  freshWorld(); fakeTts({ delay: 0, fail: true });
  const S2 = await load();
  let spent = 0, refunded = 0, e2 = null;
  const t0 = Date.now();
  await S2.speakCloud("this request fails", "en", null, () => {}, (e) => { e2 = e; }, 1, { src: "chat", spend: () => { spent++; return true; }, refund: () => { refunded++; } });
  check("failed-request-refunds", spent === 1 && refunded === 1 && !!e2, `spent ${spent} · refunded ${refunded} · ${Date.now() - t0} ms`);
  check("request-carries-the-chat-source", globalThis.__fetches.length >= 1 && globalThis.__fetches.every(b => b.src === "chat" && b.lang === "en"), JSON.stringify(globalThis.__fetches[0] && { src: globalThis.__fetches[0].src, lang: globalThis.__fetches[0].lang }));

  freshWorld(); fakeTts({ delay: 150 });
  const S3 = await load();
  let spent3 = 0, refunded3 = 0;
  const q = S3.speakCloud("stopped in flight", "en", null, () => {}, () => {}, 1, { spend: () => { spent3++; return true; }, refund: () => { refunded3++; } });
  await sleep(40); S3.stopCloudTTS(); await q; await sleep(200);
  check("stop-in-flight-keeps-the-spend", spent3 === 1 && refunded3 === 0, `spent ${spent3} · refunded ${refunded3}`);

  // a clip heard before is free: the second listen makes no request and takes nothing
  freshWorld(); fakeTts({ delay: 0 });
  const S4 = await load();
  let spent4 = 0;
  const opt = { src: "chat", spend: () => { spent4++; return true; }, refund: () => {} };
  await S4.speakCloud("heard twice", "en", null, () => {}, () => {}, 1, opt);
  const first = globalThis.__fetches.length;
  await S4.speakCloud("heard twice", "en", null, () => {}, () => {}, 1, opt);
  // (no IndexedDB here, so only the in-memory cache can answer — the browser run of verify-chat.mjs covers IndexedDB)
  check("second-listen-is-not-paid-again", globalThis.__fetches.length === first && spent4 === 1, `requests ${first} -> ${globalThis.__fetches.length} · spent ${spent4}`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
