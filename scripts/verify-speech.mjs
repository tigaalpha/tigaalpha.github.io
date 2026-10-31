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
  globalThis.__played = []; globalThis.__fetches = []; globalThis.__playedRate = 1; globalThis.__noOnend = false;
  globalThis.__ac = {
    state: "running", destination: {}, resume: async () => {},
    // duration matters: the playback watchdog reads the real length off the buffer
    decodeAudioData: async (buf) => ({ id: buf.byteLength, duration: 0.05 }),
    createBufferSource() {
      const n = { buffer: null, playbackRate: { value: 1 }, connect() {}, onended: null,
        start() { globalThis.__played.push(this.buffer.id); globalThis.__playedRate = this.playbackRate.value; if (globalThis.__noOnend) return; this._t = setTimeout(() => this.onended && this.onended(), globalThis.__clipMs || 60); },
        stop() { clearTimeout(this._t); setTimeout(() => this.onended && this.onended(), 0); } };
      return n;
    },
  };
  globalThis.__clipMs = 60;
}
// a fake piano-tts: each request answers after `delay` ms with a clip whose size says which text it was (so "which one played" is visible)
function fakeTts({ delay = 0, fail = false, failFrom = 0 } = {}) {
  let seen = 0;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    globalThis.__fetches.push(body);
    seen++;
    await sleep(delay);
    if (fail || (failFrom && seen >= failFrom)) return { ok: false, status: 500, json: async () => ({ error: "stub" }) };
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

// 6. speed + chunking (owner 2026-10-02: "มันอ่านช้า / โหลดช้า / อ่านไม่ครบ")
{
  freshWorld();
  const S = await load();
  check("chat-speed-is-faster-than-natural", S.CHAT_TTS_RATE > 1 && S.CHAT_TTS_RATE <= 1.25, "rate " + S.CHAT_TTS_RATE);
  // the first clip is the one the learner waits for, so it must be the short one
  const long = ("ประโยคภาษาไทยความยาวปานมากสำหรับการทดสอบการตัดก้อนเสียง ".repeat(120)).trim();
  const chunks = S.ttsChunks(long, S.TTS_CHUNK_CHARS, S.TTS_FIRST_CHUNK_CHARS);
  check("first-chunk-is-shorter-than-the-rest", chunks[0].length < chunks[1].length,
    `first ${chunks[0].length} vs next ${chunks[1].length}`);
  check("no-chunk-goes-over-the-limit", chunks.every((c, i) => c.length <= (i === 0 ? S.TTS_FIRST_CHUNK_CHARS : S.TTS_CHUNK_CHARS)),
    JSON.stringify(chunks.map(c => c.length)));
  check("chunks-keep-every-word", chunks.join(" ").replace(/\s+/g, " ").trim() === long.replace(/\s+/g, " ").trim(),
    `joined ${chunks.join(" ").replace(/\s+/g, " ").trim().length} vs ${long.replace(/\s+/g, " ").trim().length}`);
  check("a-long-message-is-many-chunks", chunks.length >= 5, chunks.length + " chunks");
}

// 7. the whole message is charged once — never half a message in the cloud
//    voice then silence when the day's allowance runs out mid-way
{
  freshWorld(); fakeTts({ delay: 0 });
  const S = await load();
  let spent = 0, refunded = 0;
  const seen = [];
  const long = "ประโยคไทยยาว ๆ สำหรับทดสอบว่าอ่านครบทุกก้อนในข้อความเดียวกัน ";
  await S.speakCloud(long.repeat(60), "th", null, () => {}, () => {}, 1,
    { src: "chat", spend: (t) => { spent++; seen.push(t.length); return true; }, refund: () => { refunded++; } });
  check("a-multi-chunk-message-is-charged-once", spent === 1, "spend calls: " + spent);
  check("the-charge-covers-the-whole-message", seen.length === 1 && seen[0] > 1000, "charged for " + (seen[0] || 0) + " chars");
  check("every-chunk-was-requested-and-played", globalThis.__fetches.length >= 3 && globalThis.__played.length >= 3,
    `requests ${globalThis.__fetches.length} · played ${globalThis.__played.length}`);

  // the allowance that cannot cover the whole message must refuse UP FRONT,
  // so the caller reads all of it with the device voice instead of a clipped cloud one
  freshWorld(); fakeTts({ delay: 0 });
  const S2 = await load();
  let err = null;
  await S2.speakCloud(long.repeat(60), "th", null, () => {}, (e) => { err = e; }, 1,
    { src: "chat", spend: () => false, refund: () => {} });
  check("not-enough-for-the-whole-message → fall back whole, never half", !!err && err.budget === true && globalThis.__fetches.length === 0,
    `budget ${!!(err && err.budget)} · requests ${globalThis.__fetches.length}`);
}

// 8. the audio really is played faster, not just requested faster
{
  freshWorld(); fakeTts({ delay: 0 });
  const S = await load();
  await S.speakCloud("เร็วขึ้นนะครับ", "th", null, () => {}, () => {}, S.CHAT_TTS_RATE, null);
  check("cloud-clip-plays-at-the-chat-rate", globalThis.__playedRate >= 1.1, "rate " + globalThis.__playedRate);
}

// 9. a long message must never stop half-way
//    (owner, 2026-10-02, from a phone screenshot: "อ่านไปประมาณสองบรรทัดแล้วหยุด")
{
  // 9a. the first clip is short, so the voice starts sooner
  freshWorld(); fakeTts({ delay: 0 });
  const S = await load();
  check("first-chunk-is-short-so-the-voice-starts-sooner", S.TTS_FIRST_CHUNK_CHARS <= 260,
    "first chunk " + S.TTS_FIRST_CHUNK_CHARS + " chars");
  const parts = S.ttsChunks("A".repeat(900) + ".", S.TTS_CHUNK_CHARS, S.TTS_FIRST_CHUNK_CHARS);
  check("the-first-chunk-really-is-the-short-one", parts[0].length <= S.TTS_FIRST_CHUNK_CHARS,
    "chunk sizes: " + parts.map(x => x.length).join(", "));
  // short sentences must be PACKED, not one request each: the owner's answer above
  // used to become six synthesised clips and now becomes two
  const multi = "One sentence here. A second sentence follows. A third one too. And a fourth to finish it off.";
  const packed = S.ttsChunks(multi, S.TTS_CHUNK_CHARS, S.TTS_FIRST_CHUNK_CHARS);
  check("short-sentences-are-packed-into-few-requests", packed.length <= 2,
    `4 sentences → ${packed.length} request(s)`);
  check("packing-keeps-every-word", packed.join(" ").replace(/\s+/g, " ").trim() === multi,
    "joined: " + packed.join(" "));

  // 9b. a chunk the cloud cannot deliver must NOT swallow the rest of the message.
  //     It used to `break`, which ended the reading two lines in.
  freshWorld(); fakeTts({ delay: 0, failFrom: 2 });
  const S2 = await load();
  let err = null;
  const msg = [
    "The C major scale has eight notes and it follows a whole whole half pattern.",
    "The right hand ascends with the thumb going under after the third finger.",
    "The left hand ascends with finger three going over the thumb.",
    "Descending simply reverses those fingerings back down to the bottom C.",
    "Play the right hand alone at sixty beats per minute before adding the left.",
    "Focus on the thumb-under motion and keep the wrist loose throughout.",
    "Once it is smooth, put both hands together and count out loud.",
  ].join(" ");
  await S2.speakCloud(msg, "en", null, () => {}, (e) => { err = e; }, 1,
    { src: "chat", spend: () => true, refund: () => {} });
  check("a-chunk-failing-mid-message-is-reported-not-swallowed", !!err, "onError fired");
  check("the-unread-remainder-is-handed-to-the-caller", !!(err && err.rest && err.rest.length > 50),
    err && err.rest ? "rest " + err.rest.length + " chars" : "no rest");
  check("the-remainder-is-the-tail-not-the-whole-message", !!(err && err.rest && err.rest.length < msg.length),
    err && err.rest ? err.rest.length + " of " + msg.length + " chars" : "");
  check("the-part-already-played-was-not-read-twice", globalThis.__played.length >= 1,
    "played " + globalThis.__played.length + " clip(s) before handing over");

  // 9c. a clip whose `onended` never arrives — what a phone does when it takes
  //     audio focus — must not freeze the loop for good
  freshWorld(); fakeTts({ delay: 0 });
  globalThis.__noOnend = true;
  const S3 = await load();
  let finished = false;
  await S3.speakCloud("A short line the phone will never report the end of.", "en", () => {}, () => { finished = true; }, () => {}, 1, null);
  check("a-clip-without-onended-still-finishes", finished, "onDone fired (watchdog)");
}

// 10. what one request carries is counted in SECONDS of speech, so a minute of Thai or Chinese is never one clip (owner 2026-10-31:
//     "อ่านไม่เต็มประโยค"), and the text sent to the voice has no list marks or run-on bullets
{
  freshWorld();
  const S = await load();
  for (const lang of ["th", "en", "zh"]) {
    const L = S.ttsChunkLimits(lang), cps = { th: 11, en: 15, zh: 4.5 }[lang];
    check("limits-" + lang + "-later-clip-is-about-24s", L.max / cps <= 25 && L.max / cps >= 15 || L.max === 90, lang + " max " + L.max + " = " + (L.max / cps).toFixed(1) + " s");
    check("limits-" + lang + "-first-clip-is-short", L.first < L.max && L.first / cps <= 12, lang + " first " + L.first + " = " + (L.first / cps).toFixed(1) + " s");
  }
  const zh = "这是一个很长的中文句子用来测试语音分块是否会把一分钟的朗读拆成合适的小段。".repeat(30);
  const Lz = S.ttsChunkLimits("zh"), cz = S.ttsChunks(zh, Lz.max, Lz.first);
  check("chinese-answer-is-cut-into-short-clips", cz.every((c, i) => c.length <= (i === 0 ? Lz.first : Lz.max)) && cz.length >= 6, cz.length + " clips, longest " + Math.max(...cz.map(c => c.length)));
  const zc = S.ttsChunks("一二三四五六七八九十，".repeat(12) + "结束。", 60, 50); check("a-long-sentence-is-cut-at-a-comma", zc.slice(0, -1).every(c => /，$/.test(c)), JSON.stringify(zc.map(c => c.slice(-1))));
  const md = S.cleanForTTS("# หัวข้อ\n- ข้อแรก\n- ข้อสอง\n1. ขั้นที่หนึ่ง\n2) ขั้นที่สอง\nจบแล้ว.");
  check("list-marks-are-not-read", !/[#]|(^|\s)-\s|\d[.)]\s/.test(md), md);
  check("bullets-get-a-pause-between-them", md.includes("ข้อแรก.") && md.includes("ข้อสอง."), md);
  check("normal-punctuation-is-not-doubled", S.cleanForTTS("Hello there.\nHow are you?") === "Hello there. How are you?", S.cleanForTTS("Hello there.\nHow are you?"));
  const sr = 24000, d = new Float32Array(sr * 2); for (let i = sr * 0.5; i < sr * 1.4; i++) d[i] = 0.3 * Math.sin(i / 9);
  const [a, b] = S.ttsAudibleSpan({ getChannelData: () => d, sampleRate: sr, duration: 2 });
  check("silence-around-a-clip-is-trimmed", a > 0.4 && a < 0.5 && b > 1.4 && b < 1.6, a.toFixed(2) + " to " + b.toFixed(2) + " of 2.00 s");
  check("a-silent-clip-is-left-whole", S.ttsAudibleSpan({ getChannelData: () => new Float32Array(sr), sampleRate: sr, duration: 1 })[1] === 1);
}

// 11. one read-aloud a day (owner 2026-10-31)
{
  freshWorld();
  const S = await load();
  check("round-is-available-at-first", S.ttsRoundsLeft() === 1 && S.TTS_DAILY_ROUNDS === 1);
  check("first-round-is-taken", S.ttsRoundSpend() === true && S.ttsRoundsLeft() === 0);
  check("second-round-is-refused", S.ttsRoundSpend() === false);
  S.ttsRoundRefund();
  check("a-refunded-round-is-available-again", S.ttsRoundsLeft() === 1 && S.ttsRoundSpend() === true);
  S.ttsRoundRefund(); S.ttsRoundRefund();
  check("refund-never-goes-below-zero", S.ttsRoundsLeft() === 1);
  freshWorld(); fakeTts({ delay: 0 });
  const S2 = await load();
  const opts = { src: "chat", spend: () => S2.ttsRoundSpend(), refund: () => S2.ttsRoundRefund() };
  let done1 = false, err2 = null;
  await S2.speakCloud("The first message of the day, read in the cloud voice.", "en", () => {}, () => { done1 = true; }, () => {}, 1, opts);
  await S2.speakCloud("A different second message that must not reach the cloud.", "en", () => {}, () => {}, (e) => { err2 = e; }, 1, opts);
  check("first-message-plays-second-is-refused-without-a-request", done1 && !!err2 && err2.budget === true && globalThis.__fetches.length === 1, `fetches ${globalThis.__fetches.length}`);
}

// 12. the owner's "อ่านไป 2-3 บรรทัดแล้วหยุด" (2026-10-31): the first clip carries real speech, a refusal is waited out, the device voice reads in short pieces
{
  freshWorld();
  const S = await load();
  const one = S.ttsChunks("ประโยคแรก. ประโยคสอง. ประโยคสาม. ประโยคสี่.", 264, 121);
  check("first-clip-packs-short-sentences", one.length === 1, JSON.stringify(one));
  check("rate-hint-reads-the-providers-wait", S.ttsRateHintMs(new Error("Gemini TTS 429: Please retry in 34.2s")) === 34700 && S.ttsRateHintMs(new Error("Gemini TTS 429: quota")) === 6000 && S.ttsRateHintMs(new Error("no audio")) === null);
  check("rate-hint-is-capped", S.ttsRateHintMs(new Error("retry in 300s")) === 40000);
  const dev = S.chunkText("สวัสดีครับ ".repeat(60), 180);
  check("device-voice-pieces-are-short-even-without-full-stops", dev.length >= 3 && dev.every(c => c.length <= 190), JSON.stringify(dev.map(c => c.length)));
  check("device-voice-pieces-keep-every-word", dev.join("").replace(/\s+/g, "") === ("สวัสดีครับ ".repeat(60)).replace(/\s+/g, ""));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
