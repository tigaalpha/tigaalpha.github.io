import { nativeSTTAvailable, NativeSpeechRecognition } from "./native-stt";
import { TTS_URL, apiHeaders } from "./ai-backend";
import { getAC } from "./music-engine";

/* ── speech.ts ──
   TTS/STT sub-engine: Web Speech API wrappers, cloud-TTS (backend-synthesized
   voice) with an IndexedDB cache, chunking/throttling, and the Voice Mentor
   delivery-style prompt builder. Extracted from App.tsx verbatim — no logic
   changes — as part of the App.tsx modularization. Note: SpeakBtn/TTS_ENABLED
   stay in App.tsx for now (they belong with Msg/Typing/Input in chat-ui.tsx,
   Phase 1.7, since SpeakBtn needs the i18n `L` table which hasn't moved yet). ── */


/* ── TTS ── */
export const TTS_LOCALES = { th: "th-TH", en: "en-US", zh: "zh-CN" };
export const TTS_RATE = { th: 0.9, en: 0.95, zh: 0.92 };

export function ttsSupported() {
  return typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";
}
/* speech-to-text (Web Speech API) — powers the AI voice tutor */
export function getSR() {
  if (typeof window === "undefined") return null;
  // native app (iOS/Android): browser SpeechRecognition doesn't reliably exist inside
  // Capacitor's WebView — NativeSpeechRecognition wraps the OS's own recognizer instead,
  // shaped so `new SR()` below works identically either way.
  if (nativeSTTAvailable()) return NativeSpeechRecognition;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}
export function sttSupported() { return !!getSR(); }
export let _voices = [];
export function refreshVoices() {
  if (ttsSupported()) _voices = window.speechSynthesis.getVoices() || [];
}
if (ttsSupported()) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}
// Name hints for male / female voices across iOS, macOS, Android, Windows, Chrome.
// (Web Speech exposes no reliable gender field, so we match on voice names.)
export const MALE_VOICE_HINTS = /\b(male|man)\b|aaron|alex|arthur|daniel|fred|gordon|oliver|rishi|reed|rocko|eddy|albert|ralph|thomas|david|mark|guy|ryan|liam|william|james|george|brian|matthew|nathan|eric|yunyang|yunxi|yunjian|kangkang|zhiwei|nattawut|niwat/i;
export const FEMALE_VOICE_HINTS = /\b(female|woman)\b|samantha|victoria|karen|moira|tessa|fiona|nora|sandy|shelley|kanya|narisa|ting-?ting|sin-?ji|mei-?jia|xiaoxiao|huihui|yaoyao|zira|susan|hazel|catherine|linda|heather|aria|jenny/i;

// Pick the most natural voice for a locale, preferring the requested gender (male by default).
export function bestVoice(locale, prefer = "male") {
  const all = _voices.length ? _voices : (ttsSupported() ? window.speechSynthesis.getVoices() : []);
  const base = locale.split("-")[0];
  const cands = all.filter(v => v.lang && (v.lang === locale || v.lang.startsWith(base)));
  if (!cands.length) return null;
  const wantMale = prefer !== "female";
  cands.sort((a, b) => {
    const score = v => {
      const n = (v.name || "").toLowerCase();
      const g = (v.gender || "").toLowerCase(); // non-standard; present on a few platforms
      let s = 0;
      if (v.lang === locale) s += 30;
      // gender preference — the user explicitly asked for a male voice
      const isMale = g === "male" || MALE_VOICE_HINTS.test(n);
      const isFemale = g === "female" || FEMALE_VOICE_HINTS.test(n);
      if (wantMale) { if (isMale) s += 60; else if (isFemale) s -= 35; }
      // naturalness: enhanced/premium/neural voices sound far better than compact —
      // weight these heavily so we never pick a robotic stock voice when a good one exists.
      if (/neural|natural|premium|enhanced|wavenet|studio|siri|online/.test(n)) s += 48;
      if (n.includes("google")) s += 22;
      if (v.localService) s += 4;
      if (/compact|espeak|eloquence|robot/.test(n)) s -= 60;
      return s;
    };
    return score(b) - score(a);
  });
  return cands[0];
}
export function cleanForTTS(t) {
  return t.replace(/[◈▶⏸⤢✕•🔊⏹🔇🎹🎵⚠💡🪙🎁]/g, "")
    .replace(/\*\*/g, "")               // markdown bold markers → drop just the ** (keep the inner words)
    // then strip whole *stage-direction* spans (e.g. "*chuckles*", "*plays a note*") —
    // the model is told to sound expressive, but if it ever slips into
    // screenplay-style action text this must never be read aloud word-for-word.
    // Must run AFTER the ** strip above, else "**bold**" mis-pairs across the
    // inner two asterisks and eats the words instead of just the markers.
    .replace(/\*[^*\n]{1,60}\*/g, "")
    .replace(/[*_`~]/g, "")
    .replace(/\n{2,}/g, ". ").replace(/\n/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Chrome bug: synthesis pauses on long utterances. This keeps it alive.
export let _ttsResumeTimer = null;
export function startResumeKeepAlive() {
  stopResumeKeepAlive();
  _ttsResumeTimer = setInterval(() => {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    } else {
      stopResumeKeepAlive();
    }
  }, 8000);
}
export function stopResumeKeepAlive() {
  if (_ttsResumeTimer) { clearInterval(_ttsResumeTimer); _ttsResumeTimer = null; }
}

// split long text into <=180 char chunks at sentence boundaries (avoids 15s cutoff)
export function chunkText(text, max = 180) {
  const parts = text.match(/[^.!?。！？]+[.!?。！？]*/g) || [text];
  const chunks = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > max && cur) { chunks.push(cur.trim()); cur = p; }
    else cur += p;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text];
}

/* Robust speak: must be called from a user gesture. Returns true if started. */
export function speakRobust(text, lang, onDone, onBlocked, rateMul = 1) {
  if (!ttsSupported()) return false;
  const synth = window.speechSynthesis;
  try {
    synth.cancel(); // clear any stuck queue
    stopResumeKeepAlive();

    const clean = cleanForTTS(text);
    if (!clean) { if (onDone) onDone(); return false; }

    const locale = TTS_LOCALES[lang] || "en-US";
    const voice = bestVoice(locale);
    const rate = Math.max(0.5, Math.min(2, (TTS_RATE[lang] || 0.95) * (rateMul || 1)));
    const chunks = chunkText(clean);

    let idx = 0;
    let started = false;
    const speakNext = () => {
      if (idx >= chunks.length) { stopResumeKeepAlive(); if (onDone) onDone(); return; }
      const u = new SpeechSynthesisUtterance(chunks[idx]);
      u.lang = voice ? voice.lang : locale;
      if (voice) u.voice = voice;
      u.rate = rate; u.pitch = 0.97; u.volume = 1.0; // slightly warmer pitch = less robotic
      // Android Chrome sometimes never fires onend — guard each chunk so playback
      // (and the resolve that follows) always advances instead of hanging.
      let advanced = false;
      const advance = () => { if (advanced) return; advanced = true; clearTimeout(chunkGuard); idx++; speakNext(); };
      const chunkGuard = setTimeout(advance, Math.min(24000, 2500 + chunks[idx].length * 135));
      u.onstart = () => { started = true; };
      u.onend = advance;
      u.onerror = advance;
      synth.speak(u);
    };

    // iOS/Chrome warm-up: an empty resume call unlocks the engine inside the gesture
    synth.resume();
    speakNext();
    startResumeKeepAlive();

    // Detect the "silent block" case: inside claude.ai's sandboxed iframe the
    // Web Speech API is often blocked by Permissions-Policy — speak() returns
    // without error but nothing ever plays. If neither onstart fired nor the
    // engine reports speaking/pending within 1.2s, treat it as blocked.
    setTimeout(() => {
      if (!started && !synth.speaking && !synth.pending) {
        stopResumeKeepAlive();
        synth.cancel();
        if (onBlocked) onBlocked();
      }
    }, 1200);

    return true;
  } catch (e) {
    stopResumeKeepAlive();
    return false;
  }
}
export function stopSpeaking() {
  stopResumeKeepAlive();
  try { window.speechSynthesis.cancel(); } catch (e) {}
}

/* ── Cloud TTS (Gemini, natural male voice) via the piano-tts Edge Function ──
   Plays through the shared AudioContext so iOS Safari keeps the audio unlocked
   (the context is resumed inside the click gesture before the network call).
   The text is split into short chunks so the FIRST clip is generated and played
   quickly, while later chunks are prefetched during playback (low latency). */
export let _ttsSource = null;
export let _ttsCancelled = false;
export function stopCloudTTS() {
  _ttsCancelled = true;
  if (_ttsSource) { try { _ttsSource.stop(); } catch (e) {} _ttsSource = null; }
}
export function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
// Split into ~130-char chunks at sentence enders, then at spaces (works for Thai,
// which often has no sentence punctuation), so the first clip is short = fast.
export function ttsChunks(text, max = 130) {
  const out = [];
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]*/g) || [text];
  for (let s of sentences) {
    s = s.trim();
    if (!s) continue;
    while (s.length > max) {
      let cut = s.lastIndexOf(" ", max);
      if (cut < max * 0.6) cut = max; // no good space nearby — hard cut
      out.push(s.slice(0, cut).trim());
      s = s.slice(cut).trim();
    }
    if (s) out.push(s);
  }
  return out.length ? out : [text];
}
/* Returns true if cloud audio started; on any failure calls onError (so the
   caller can fall back to the device Web Speech voice). */
/* ── Voice character + warmth: Gemini 2.5 TTS takes a natural-language style
   direction (it speaks only the quoted content, in that tone) — this is what
   turns a flat read into a warm, human, world-class-teacher delivery. ── */
// All male, chosen for a natural, unhurried teaching delivery. Gemini's own
// descriptors: Algieba = smooth, Schedar = even, Achird = friendly, Puck = upbeat.
// Keys are unchanged so a saved tg_vmvoice preference still resolves.
export const VM_VOICES = [
  { k: "warm",     v: "Algieba", th: "นุ่มนวล",    en: "Smooth",   zh: "柔和" },
  { k: "deep",     v: "Schedar", th: "ทุ้มนิ่ง",    en: "Steady",   zh: "沉稳" },
  { k: "friendly", v: "Achird",  th: "เป็นกันเอง", en: "Friendly", zh: "亲切" },
  { k: "bright",   v: "Puck",    th: "สดใส",      en: "Bright",   zh: "明亮" },
];
export function getVmVoiceKey() { try { return localStorage.getItem("tg_vmvoice") || "warm"; } catch (e) { return "warm"; } }
export function getVmVoiceName() { const f = VM_VOICES.find(x => x.k === getVmVoiceKey()); return f ? f.v : "Algieba"; }
// the teacher's emotional tone adapts to the moment (a master teacher never sounds flat)
export let _ttsMood = "warm";
export function setTtsMood(m) { _ttsMood = m || "warm"; }
export function vmStyleFor(lang, mood) {
  const m = mood || _ttsMood || "warm";
  const D = {
    warm: {
      th: "อ่านข้อความในเครื่องหมายคำพูดด้วยน้ำเสียงครูสอนเปียโนระดับโลกที่อบอุ่น เป็นกันเอง ให้กำลังใจ พูดเป็นธรรมชาติเหมือนคนจริง จังหวะนุ่มนวลมีชีวิตชีวา ไม่ใช่หุ่นยนต์",
      zh: "用温暖、亲切、鼓励的世界级钢琴老师语气，像真人一样自然、富有表现力地朗读引号中的文字，不要机械感。",
      en: "Read the quoted text as a warm, encouraging, world-class piano teacher speaking naturally like a real person — friendly, clear, with gentle expressive pacing, never robotic.",
    },
    celebrate: {
      th: "อ่านข้อความในเครื่องหมายคำพูดด้วยน้ำเสียงครูเปียโนที่ตื่นเต้น ดีใจ และภูมิใจในตัวลูกศิษย์มาก พลังบวกเต็มเปี่ยม ยิ้มขณะพูด เป็นธรรมชาติเหมือนคนจริง",
      zh: "用兴奋、自豪、为学生由衷高兴的钢琴老师语气，充满正能量、面带微笑、像真人一样自然地朗读引号中的文字。",
      en: "Read the quoted text as a piano teacher who is excited, proud and genuinely delighted with the student — upbeat, smiling and energetic, natural like a real person.",
    },
    gentle: {
      th: "อ่านข้อความในเครื่องหมายคำพูดด้วยน้ำเสียงครูเปียโนที่อ่อนโยน ใจเย็น ปลอบใจและให้กำลังใจอย่างนุ่มนวล ไม่กดดัน เป็นธรรมชาติเหมือนคนจริง",
      zh: "用温柔、耐心、给予安慰和轻声鼓励的钢琴老师语气，不带压力、像真人一样自然地朗读引号中的文字。",
      en: "Read the quoted text as a piano teacher who is gentle, calm and reassuring — soft, patient and comforting, never pressuring, natural like a real person.",
    },
  };
  const set = D[m] || D.warm;
  return set[lang] || set.en;
}
// wrap one chunk with the (mood-aware) tone direction (quoted so the directive isn't spoken)
export function styleTTS(s, lang) { return vmStyleFor(lang) + "\n\n\"" + String(s).replace(/"/g, "'") + "\""; }

/* ── Synthesized-speech cache ──
   Replaying a reply used to re-synthesize it: a billed request and a 3-8s wait
   every single time. Clips are now kept in memory for the session and in
   IndexedDB across reloads, keyed by voice+language+text. A repeat listen is
   therefore instant, costs nothing, and works with no connection at all — which
   is also what keeps playback smooth on a weak one.
   Note: decodeAudioData detaches the ArrayBuffer it is given, so every path here
   hands out a private copy and never lets the cached bytes reach a decoder. */
export const TTS_DB = "tiga-tts", TTS_STORE = "clips", TTS_CACHE_MAX = 80;
export const _ttsMem = new Map();
export function ttsKey(text, lang, voice) {
  const s = lang + "|" + voice + "|" + text;
  let h = 0x811c9dc5;                                   // FNV-1a, plenty for a cache key
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + "-" + s.length.toString(36);
}
export let _ttsDbP = null;
export function ttsDb() {
  if (_ttsDbP) return _ttsDbP;
  _ttsDbP = new Promise((resolve) => {
    // The cache must never be able to delay speech. An open() that is blocked by
    // another tab mid-upgrade fires neither onsuccess nor onerror, so this races a
    // deadline: past it we simply run memory-only rather than leave audio waiting.
    const done = (v) => { clearTimeout(t); resolve(v); };
    const t = setTimeout(() => resolve(null), 2000);
    try {
      const req = indexedDB.open(TTS_DB, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(TTS_STORE)) d.createObjectStore(TTS_STORE);
      };
      req.onsuccess = () => done(req.result);
      req.onerror = () => done(null);                   // private mode / quota off → memory only
      req.onblocked = () => done(null);
    } catch (e) { done(null); }
  });
  return _ttsDbP;
}
export async function ttsCacheGet(key) {
  const hit = _ttsMem.get(key);
  if (hit) return hit.slice(0);
  const db = await ttsDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const r = db.transaction(TTS_STORE, "readonly").objectStore(TTS_STORE).get(key);
      r.onsuccess = () => {
        const v = r.result;
        if (v) _ttsMem.set(key, v);
        resolve(v ? v.slice(0) : null);
      };
      r.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}
export async function ttsCachePut(key, buf) {
  let copy;
  try { copy = buf.slice(0); } catch (e) { return; }    // already detached → nothing to store
  _ttsMem.set(key, copy);
  if (_ttsMem.size > TTS_CACHE_MAX) _ttsMem.delete(_ttsMem.keys().next().value);
  const db = await ttsDb();
  if (!db) return;
  try {
    const store = db.transaction(TTS_STORE, "readwrite").objectStore(TTS_STORE);
    store.put(copy, key);                               // structured-cloned, does not detach
    const cnt = store.count();
    cnt.onsuccess = () => {                             // keep the on-disk cache bounded
      if (cnt.result <= TTS_CACHE_MAX) return;
      const c = store.openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) cur.delete(); };
    };
  } catch (e) {}
}

/* ── TTS request pacing + retry ──
   Gemini's TTS model is rate-limited per minute. Bursting requests makes it reject
   the follow-ups almost instantly (the Edge Function surfaces that as a 500 in
   ~230ms, vs ~4s for a real synthesis). That is what used to cut playback off after
   the first line: the failed chunks were being skipped silently. Two guards below —
   a global minimum gap between outgoing requests, and backoff retries — mean a
   transient limit costs a short pause instead of the rest of the message. */
export let _ttsLastReqAt = 0;
export const TTS_MIN_GAP_MS = 1200;
export async function ttsThrottle() {
  const wait = _ttsLastReqAt + TTS_MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  _ttsLastReqAt = Date.now();
}
export async function ttsFetchBuffer(s, lang, ac, tries = 3, timeoutMs = 30000) {
  const voice = getVmVoiceName();
  const key = ttsKey(s, lang, voice);
  const cached = await ttsCacheGet(key);                // free, instant, offline-safe
  if (cached) { try { return await ac.decodeAudioData(cached); } catch (e) {} }
  let lastErr = null;
  for (let n = 0; n < tries; n++) {
    if (n > 0) await new Promise((r) => setTimeout(r, 1200 * Math.pow(2, n - 1))); // 1.2s, 2.4s
    if (_ttsCancelled) throw new Error("cancelled");
    await ttsThrottle();
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(TTS_URL, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ text: styleTTS(s, lang), lang, voice }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        let detail = "";
        try { const j = await res.json(); detail = j && j.error ? j.error : ""; } catch (e) {}
        throw new Error(detail || ("TTS HTTP " + res.status));
      }
      const data = await res.json();
      if (!data || !data.audio) throw new Error("no audio");
      const bytes = b64ToArrayBuffer(data.audio);
      ttsCachePut(key, bytes);                           // copies first; safe before decode
      return await ac.decodeAudioData(bytes);
    } catch (e) {
      lastErr = e;
      if (_ttsCancelled) throw e;
    } finally { clearTimeout(to); }
  }
  throw lastErr || new Error("TTS failed");
}

export async function speakCloud(text, lang, onStart, onDone, onError, rateMul = 1) {
  stopCloudTTS();
  _ttsCancelled = false;
  const clean = cleanForTTS(text);
  if (!clean) { if (onDone) onDone(); return false; }
  const ac = getAC(); // resume/unlock the audio context inside the user gesture
  // One request for the whole reply. The Edge Function caps the prompt at 4000
  // chars including the style directive, so 3600 leaves room for it — and replies
  // are capped at ~50 words by the chat system prompt, so this is a single request
  // in practice. One request = one continuous clip: no seams between clips (the
  // "choppy" complaint) and no second call to trip Gemini's rate limit (the
  // "stops after one line" complaint).
  const chunks = ttsChunks(clean, 3600);

  try {
    let nextP = ttsFetchBuffer(chunks[0], lang, ac);
    let firstStarted = false;
    for (let i = 0; i < chunks.length; i++) {
      const curP = nextP;
      let buf;
      try { buf = await curP; }
      catch (e) {
        if (i === 0) throw e; // nothing played yet → let the caller fall back to the device voice
        // Retries are already exhausted here. Stop cleanly instead of silently
        // dropping this chunk and every one after it.
        console.error("[TIGA TTS] chunk " + (i + 1) + "/" + chunks.length + " failed after retries:", e);
        break;
      }
      if (_ttsCancelled) return true;
      if (!firstStarted) { firstStarted = true; if (onStart) onStart(); }
      // Resume AudioContext if iOS/Android suspended it between chunks
      if (ac.state !== "running") { try { await ac.resume(); } catch (_) {} }
      // Start prefetching the next chunk NOW — its timeout ticks during the current
      // clip's playback, not from the start of the loop. This fixes the old race where
      // chunks[1]'s timer expired before chunks[0] even finished playing.
      if (i + 1 < chunks.length) {
        nextP = ttsFetchBuffer(chunks[i + 1], lang, ac);
        nextP.catch(() => {}); // mark handled: the user may stop playback before we await it
      }
      await new Promise((resolve) => {
        const src = ac.createBufferSource();
        src.buffer = buf;
        if (rateMul && rateMul !== 1) src.playbackRate.value = Math.max(0.5, Math.min(1.8, rateMul));
        src.connect(ac.destination);
        src.onended = resolve;
        _ttsSource = src;
        try { src.start(); } catch (e) { resolve(); }
      });
      if (_ttsCancelled) return true;
    }
    _ttsSource = null;
    if (onDone) onDone();
    return true;
  } catch (e) {
    stopCloudTTS();
    console.error("[TIGA TTS] Cloud TTS failed, falling back to device voice:", e);
    if (onError) onError(e);
    return false;
  }
}

/* Prefetch + decode all cloud-TTS clips for a line of text (look-ahead, so the
   next sentence's audio is ready before the current one finishes — gapless voice).
   Returns AudioBuffer[]; throws on any failure so the caller can fall back. */
export async function fetchCloudClips(text, lang) {
  const clean = cleanForTTS(text);
  if (!clean) return [];
  const ac = getAC();
  // Same single-request rule as speakCloud. This used to Promise.all every chunk,
  // which fired 3-5 synthesis requests at once — a guaranteed rate-limit trip that
  // left most of the line silent. Sequential + throttled + retried instead.
  const chunks = ttsChunks(clean, 3600);
  const out = [];
  for (const s of chunks) out.push(await ttsFetchBuffer(s, lang, ac, 2, 15000));
  return out;
}
/* Play already-decoded clips back-to-back through the shared context. */
export async function playCloudClips(clips, rateMul, isCancelled) {
  const ac = getAC();
  _ttsCancelled = false;
  for (const buf of clips) {
    if (!buf || _ttsCancelled || (isCancelled && isCancelled())) return;
    await new Promise((resolve) => {
      const src = ac.createBufferSource();
      src.buffer = buf;
      if (rateMul && rateMul !== 1) src.playbackRate.value = Math.max(0.5, Math.min(1.8, rateMul));
      src.connect(ac.destination);
      src.onended = resolve;
      _ttsSource = src;
      try { src.start(); } catch (e) { resolve(); }
    });
  }
  _ttsSource = null;
}
