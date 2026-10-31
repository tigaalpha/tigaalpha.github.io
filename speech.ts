import { Capacitor } from "@capacitor/core";
import { nativeSTTAvailable, NativeSpeechRecognition } from "./native-stt";
import { TTS_URL, apiHeaders } from "./ai-backend";
import { getAC } from "./music-engine";

/* ── speech.ts ──
   TTS/STT sub-engine: Web Speech API wrappers, cloud-TTS (backend-synthesized
   voice) with an IndexedDB cache, chunking/throttling, and the Voice Mentor
   delivery-style prompt builder. Extracted from App.tsx verbatim — no logic
   changes — as part of the App.tsx modularization. The chat's read-aloud button
   (BubbleSpeak) lives in chat-ui.tsx and is built on speakCloud() below. ── */


/* ── TTS ── */
export const TTS_LOCALES = { th: "th-TH", en: "en-US", zh: "zh-CN" };
export const TTS_RATE = { th: 0.9, en: 0.95, zh: 0.92 };
/* ── เร็วขึ้น (เจ้าของ 2026-10-02: "มันอ่านช้า") ──
   ค่าเดิมคือ 1 = ได้ยิ้ตามจังหวะที่โมเดลพูด และเส้นทางสำรองของเครื่องยิ่งช้าลง
   (TTS_RATE ไทย 0.9 = ช้ากว่าปกติอยู่แล้ว) ผู้เรียนกดฟังแล้วต้องรอนานและอ่านยาว
   1.15 = เร็วขึ้นชัดเจนแต่ยังเป็นธรรมชาติ (เกิน ~1.3 ผู้ฟังจะได้ยินเสียง "แหล่น")
   ใช้กับแชทอย่างเดียว — Voice Tutor มีปุ่มปรับความเร็วของตัวเองอยู่แล้ว ไม่แตะ */
export const CHAT_TTS_RATE = 1.15;
/* ขนาดก้อนเสียงต่อคำขอ: ยิ่งเล็ก ยิ่งได้ยิ้เร็ว (แต่ยิงเซิร์ฟเวอร์บ่อยขึ้น ต้องไม่ต่ำเกินไป)
   700 ตัวอักษร ≈ ประมาณ 40–60 วินาทีของเสียงไทย — สั้นพอที่จะไม่รู้สึกว่ารอ
   ชิ้นแรก 380 ตัวอักษร ≈ 2–3 ประโยค เพื่อให้เสียงแรกดังเร็วที่สุด */
export const TTS_CHUNK_CHARS = 700;
// The first clip is what the learner waits for, so it is deliberately short: a
// 240-char clip synthesises and downloads in a fraction of the time of a long one,
// and the rest of the message is prefetched while it plays. 2026-10-02: 380 → 240
// after "กดปุ่มแล้วต้องรีบนาน" — every extra second here is a second of silence
// before the voice starts.
export const TTS_FIRST_CHUNK_CHARS = 240;

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
export const MALE_VOICE_HINTS = /\b(male|man)\b|aaron|alex|arthur|daniel|fred|gordon|oliver|rishi|reed|rocko|eddy|albert|ralph|thomas|david|mark|guy|ryan|liam|william|james|george|brian|matthew|nathan|eric|yunyang|yunxi|yunjian|kangkang|zhiwei|nattawut|niwat|andrew|christopher|steffan|roger|davis|yunhao|tom\b|en-gb-x-rjs|en-us-x-iol|en-us-x-iom|en-us-x-tpd|x-ccd|x-ctd/i;
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
    .replace(/^[ \t]*(?:#{1,6}|[-•]|\d+[.)])[ \t]+/gm, "")   // a heading mark, a bullet or a "1." step is not read out
    .replace(/[*_`~]/g, "")
    // a line that ends with no punctuation (a bullet, a heading) gets a full stop, so the voice pauses there instead of
    // running one item into the next as a single breathless sentence
    .replace(/([^\s.!?。！？…:;,，、：；])[ \t]*\n+/g, "$1. ")
    .replace(/\n{2,}/g, ". ").replace(/\n/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Chrome bug: synthesis pauses on long utterances. This keeps it alive.
export let _ttsResumeTimer = null;
/* pause()+resume() every 8 s works round Chrome DESKTOP's habit of freezing a long utterance after ~15 s. On a phone it is not needed, and where pause()
   really pauses it can cut the voice off a few lines in, so it runs on desktop only. Reading in utterances short enough to finish well inside that window
   (chunkText below) is what keeps a phone going. */
let _deviceGen = 0;                // a new read (or a stop) makes every callback of an older read stale: a cancel() raises error/end on the old one
function keepAliveWanted() { try { return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ""); } catch (e) { return true; } }
export function startResumeKeepAlive() {
  stopResumeKeepAlive();
  if (!keepAliveWanted()) return;
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
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]*/g) || [text];
  // a sentence longer than the budget (Thai has no full stops) is cut at a clause mark or a space, never mid-word, so no utterance runs long
  const parts = [];
  for (let p of sentences) {
    while (p.length > max) {
      let cut = -1; for (const m of ["，", "、", "；", "：", ",", ";", " "]) cut = Math.max(cut, p.lastIndexOf(m, max - 1));
      if (cut < max * 0.4) cut = max; else cut += 1;
      parts.push(p.slice(0, cut)); p = p.slice(cut);
    }
    if (p) parts.push(p);
  }
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
    const gen = ++_deviceGen;

    const clean = cleanForTTS(text);
    if (!clean) { if (onDone) onDone(); return false; }

    const locale = TTS_LOCALES[lang] || "en-US";
    const voice = bestVoice(locale);
    const rate = Math.max(0.5, Math.min(2, (TTS_RATE[lang] || 0.95) * (rateMul || 1)));
    const chunks = chunkText(clean);

    let idx = 0;
    let started = false;
    const speakNext = () => {
      if (gen !== _deviceGen) return;                       // a newer read or a stop took over
      if (idx >= chunks.length) { stopResumeKeepAlive(); if (onDone) onDone(); return; }
      const u = new SpeechSynthesisUtterance(chunks[idx]);
      u.lang = voice ? voice.lang : locale;
      if (voice) u.voice = voice;
      u.rate = rate; u.pitch = 0.97; u.volume = 1.0; // slightly warmer pitch = less robotic
      // Android Chrome sometimes never fires onend — guard each chunk so playback
      // (and the resolve that follows) always advances instead of hanging.
      let advanced = false;
      const advance = () => { if (advanced || gen !== _deviceGen) return; advanced = true; clearTimeout(chunkGuard); idx++; speakNext(); };
      // the guard only moves on when the engine has stopped speaking: an utterance that is still being read is not "done"
      const chunkGuard = setTimeout(() => { try { if (synth.speaking && !synth.paused && Date.now() - t0 < 60000) { clearTimeout(chunkGuard2); chunkGuard2 = setTimeout(advance, 6000); return; } } catch (e) {} advance(); }, Math.min(24000, 2500 + chunks[idx].length * 135));
      let chunkGuard2 = null; const t0 = Date.now();
      u.onstart = () => { started = true; };
      u.onend = () => { clearTimeout(chunkGuard2); advance(); };
      u.onerror = (ev) => {
        const er = String((ev && ev.error) || "");
        if (er === "canceled" || er === "interrupted") return;   // our own cancel(): not a failure, and no reason to read the next piece
        // the engine refused this utterance (a phone refuses speak() that does not come from a tap, or has no voice for the language): say so
        // instead of racing through every piece in a blink and reporting "done" with nothing heard
        if (!started && /not-allowed|synthesis-failed|language-unavailable|voice-unavailable|audio-busy/.test(er)) {
          if (advanced || gen !== _deviceGen) return;
          advanced = true; clearTimeout(chunkGuard); clearTimeout(chunkGuard2); stopResumeKeepAlive();
          if (onBlocked) onBlocked(); return;
        }
        clearTimeout(chunkGuard2); advance();
      };
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

/* Device/native fallback for when cloud TTS fails or is off — used by the chat
   the chat's read-aloud button and the voice tutor. On the web: speechSynthesis. Inside the Android
   app's WebView speechSynthesis does not exist at all, so use the OS TTS engine
   via the Capacitor plugin instead — always works, no network, no Gemini quota.
   Resolves with true if audio started; onDone fires when playback is done (or
   immediately when there is nothing to say); onBlocked when no engine exists. */
export async function speakDeviceOrNative(text, lang, onDone, onBlocked, rateMul = 1) {
  // Inside the Android app the OS TTS plugin is the reliable path — WebView
  // speechSynthesis is missing on many devices and silently produces no audio on
  // others. Try the plugin FIRST on native platforms, then speechSynthesis.
  if (Capacitor.isNativePlatform()) {
    try {
      const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
      try { await TextToSpeech.stop(); } catch (e) {}
      const clean = cleanForTTS(text);
      if (!clean) { if (onDone) onDone(); return true; }
      const langCode = TTS_LOCALES[lang] || "en-US";
      const rate = Math.max(0.5, Math.min(2, (TTS_RATE[lang] || 0.95) * (rateMul || 1)));
      await TextToSpeech.speak({ text: clean, lang: langCode, rate, pitch: 1.0, category: "ambient" });
      if (onDone) onDone();
      return true;
    } catch (e) {
      // plugin missing (old APK) or failed — fall through to speechSynthesis
    }
  }
  if (ttsSupported()) {
    try { const ok = speakRobust(text, lang, onDone, onBlocked, rateMul); if (ok) return true; } catch (e) {}
    return false;
  }
  if (onBlocked) onBlocked();
  return false;
}

/* ── Narration for the Adventure films (owner, 2026-10-12: "the English voice-over is not natural, find a better voice, in Thai and Chinese too") ──
   A web page cannot ship a studio voice for free, so what it can do is choose the BEST voice the device has and speak the way a narrator does.
   `narratorVoice` ranks the installed voices for a locale: the neural / online / natural ones first (Microsoft "Online (Natural)", Google network
   voices, iOS Enhanced / Premium / Siri), deep male narrators ahead of the rest, and compact / eSpeak ones last. `narrationText` rewrites what the
   engine reads badly (dashes and middle dots, "%", "TIGA", "AI") and `speakNarration` reads it a sentence at a time with a short breath between
   sentences, a lower pitch and a slower pace, which is what makes the same voice sound like a person reading instead of a machine reading a line. */
const NARR_BEST = {
  en: /(guy|davis|ryan|christopher|eric|andrew|brian|roger|steffan|william|sonia|libby|ryan).*(natural|online|neural)|google uk english male|\b(daniel|arthur|alex|aaron|oliver|rishi|gordon|tom)\b/i,
  th: /niwat|premwadee|achara|google.*(ไทย|thai)|kanya|narisa|th-th-.*(male|x-)/i,
  zh: /yunyang|yunjian|yunxi|yunxia|yunhao|kangkang|yaoyao|google.*(普通话|mandarin|chinese)|tingting|ting-ting|meijia|mei-jia/i,
};
export function narratorVoice(locale, strictMale = false) {
  const all = (_voices && _voices.length) ? _voices : (ttsSupported() ? window.speechSynthesis.getVoices() : []);
  const base = String(locale).split("-")[0];
  const cands = all.filter(v => v.lang && (v.lang === locale || String(v.lang).replace("_", "-").toLowerCase().startsWith(base)));
  if (!cands.length) return null;
  const score = (v) => {
    const n = (v.name || "").toLowerCase(), uri = String(v.voiceURI || "").toLowerCase(), key = n + " " + uri;
    let s = 0;
    if (String(v.lang).replace("_", "-").toLowerCase() === String(locale).toLowerCase()) s += 25;
    if (NARR_BEST[base] && NARR_BEST[base].test(key)) s += 80;
    if (/neural|natural|premium|enhanced|wavenet|studio|siri|online/.test(key)) s += 70;
    if (key.includes("google")) s += 22;
    if (v.localService === false) s += 8;
    if (MALE_VOICE_HINTS.test(key) || String(v.gender || "").toLowerCase() === "male") s += strictMale ? 70 : 24;
    else if (FEMALE_VOICE_HINTS.test(key)) s -= strictMale ? 60 : 6;
    if (/compact|espeak|eloquence|robot|novelty|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|pipe organ|trinoids|whisper|zarvox|albert|fred\b/.test(key)) s -= 90;
    return s;
  };
  cands.sort((a, b) => score(b) - score(a));
  return cands[0];
}
export function narrationText(text, lang) {
  let t = cleanForTTS(String(text || ""));
  t = t.replace(/\s*[—–]\s*/g, ", ").replace(/\s*·\s*/g, ", ").replace(/[()（）]/g, ", ").replace(/:\s+/g, ", ").replace(/\s*[「」『』"“”]/g, " ");
  t = t.replace(/(\d+)\s*%/g, lang === "zh" ? "百分之$1" : lang === "th" ? "$1 เปอร์เซ็นต์" : "$1 percent");
  t = t.replace(/\bTIGA\b/g, lang === "th" ? "ทีก้า" : lang === "zh" ? "提加" : "Teega").replace(/\bAI\b/g, lang === "en" ? "A I" : "AI");
  t = t.replace(/\bHe-3\b/g, lang === "en" ? "helium three" : "He-3").replace(/\bTV\b/g, "T V");
  return t.replace(/(,\s*){2,}/g, ", ").replace(/^,\s*/, "").replace(/\s+/g, " ").trim();
}
function narrationChunks(t, lang) {
  const parts = t.match(/[^.!?。！？]+[.!?。！？]*/g) || [t]; const out = [];
  for (const p of parts) {
    const q = p.trim(); if (!q) continue;
    if (q.length <= 110) { out.push(q); continue; }
    let cur = ""; for (const w of q.split(lang === "zh" ? /(?<=[，、；,;])/ : /(?<=[,;]|\s)/)) { if ((cur + w).length > 100 && cur) { out.push(cur.trim()); cur = w; } else cur += w; }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}
const NARR_RATE = { th: 0.88, en: 0.9, zh: 0.9 }, NARR_PITCH = { th: 0.93, en: 0.86, zh: 0.9 };
export async function speakNarration(text, lang, onDone, onBlocked, rateMul = 1, absRate = 0, strictMale = false) {
  const clean = narrationText(text, lang); if (!clean) { if (onDone) onDone(); return true; }
  const locale = TTS_LOCALES[lang] || "en-US", rate = absRate ? Math.max(0.6, Math.min(1.5, absRate)) : Math.max(0.6, Math.min(1.5, (NARR_RATE[lang] || 0.9) * (rateMul || 1))), pitch = NARR_PITCH[lang] || 0.9;
  if (Capacitor.isNativePlatform()) {
    try {
      const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
      try { await TextToSpeech.stop(); } catch (e) {}
      await TextToSpeech.speak({ text: clean, lang: locale, rate, pitch: strictMale ? 0.40 : pitch, category: "ambient" });
      if (onDone) onDone(); return true;
    } catch (e) { /* plugin missing: fall through to speechSynthesis */ }
  }
  if (!ttsSupported()) { if (onBlocked) onBlocked(); return false; }
  const synth = window.speechSynthesis;
  try {
    synth.cancel(); stopResumeKeepAlive();
    const voice = narratorVoice(locale, strictMale), chunks = narrationChunks(clean, lang); let idx = 0, started = false;
    /* a neural / natural voice is already well pitched: lowering it makes it sound processed, so those are read at normal pitch (and a little closer to normal speed) */
    const vkey = voice ? (voice.name + " " + voice.voiceURI).toLowerCase() : "", isMale = !!voice && (MALE_VOICE_HINTS.test(vkey) || String(voice.gender || "").toLowerCase() === "male");   // a voice not known to be male is lowered into a male range when a male is required
    const natural = !!voice && /neural|natural|premium|enhanced|wavenet|studio|siri|online/.test((voice.name + " " + voice.voiceURI).toLowerCase());
    const next = () => {
      if (idx >= chunks.length) { stopResumeKeepAlive(); if (onDone) onDone(); return; }
      const u = new SpeechSynthesisUtterance(chunks[idx]); u.lang = voice ? voice.lang : locale; if (voice) u.voice = voice; u.rate = natural && !absRate ? Math.min(1.05, rate + 0.07) : rate; u.pitch = strictMale ? (!isMale ? 0.356 : Math.min(2, (natural ? 1 : pitch) * 1.265)) : natural ? 1 : pitch; u.volume = 1;
      let advanced = false; const guard = setTimeout(() => adv(), Math.min(20000, 2500 + chunks[idx].length * 140));
      const adv = () => { if (advanced) return; advanced = true; clearTimeout(guard); idx++; setTimeout(next, strictMale ? 30 : 170); };   // a breath between sentences (almost none for the concept clips: the voice runs on)
      u.onstart = () => { started = true; }; u.onend = adv; u.onerror = adv; synth.speak(u);
    };
    synth.resume(); next(); startResumeKeepAlive();
    setTimeout(() => { if (!started && !synth.speaking && !synth.pending) { stopResumeKeepAlive(); synth.cancel(); if (onBlocked) onBlocked(); } }, 1500);
    return true;
  } catch (e) { stopResumeKeepAlive(); return false; }
}
/* Called inside a tap: lets the engine speak later from a callback that is no longer inside one (the device voice that takes over from the cloud
   voice mid-message). Once per page, silent. */
let _deviceUnlocked = false;
export function unlockDeviceSpeech() {
  if (_deviceUnlocked || !ttsSupported()) return;
  _deviceUnlocked = true;
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis.speak(u); } catch (e) {}
}
export function stopSpeaking() {
  _deviceGen++;
  stopResumeKeepAlive();
  try { window.speechSynthesis.cancel(); } catch (e) {}
  // native app WebView has no speechSynthesis — stop the OS TTS engine too
  try { if (Capacitor.isNativePlatform()) import("@capacitor-community/text-to-speech").then(m => m.TextToSpeech.stop()).catch(() => {}); } catch (e) {}
}

/* ── Cloud TTS (Gemini, natural male voice) via the piano-tts Edge Function ──
   Plays through the shared AudioContext so iOS Safari keeps the audio unlocked
   (the context is resumed inside the click gesture before the network call).
   The text is split into short chunks so the FIRST clip is generated and played
   quickly, while later chunks are prefetched during playback (low latency). */
export let _ttsSource = null;
export let _ttsCancelled = false;
let _ttsRun = 0;                                        // numbers each speakCloud() call; a stop or a newer call makes an older one stale
export const _ttsSources = new Set();   // every clip speakCloud has scheduled and not yet heard to the end (clips are queued back to back, so there can be several)
export function stopCloudTTS() {
  _ttsCancelled = true;
  _ttsRun++;
  for (const src of Array.from(_ttsSources)) { try { src.stop(); } catch (e) {} }
  _ttsSources.clear();
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
export function ttsChunks(text, max = 130, firstMax = 0, ramp = []) {
  const out = [];
  // The FIRST chunk is what the learner waits for, so it gets a tighter budget:
  // a short first clip synthesises (and downloads) in a fraction of the time,
  // which is the whole difference between "it loads" and "it hangs" on a long
  // answer. Everything after it can be bigger — it is fetched while the first
  // clip is already playing (see speakCloud's look-ahead).
  // clip 0 gets firstMax, the next ones the `ramp` sizes (each a little longer than the one before), then max: a short first clip is heard sooner and
  // the clips that follow grow while it plays, so each is ready before the one before it ends
  const limitFor = (i) => (firstMax > 0 && i === 0 ? Math.min(firstMax, max) : (ramp[i - 1] > 0 ? Math.min(ramp[i - 1], max) : max));
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]*/g) || [text];
  for (let s of sentences) {
    s = s.trim();
    if (!s) continue;
    // a sentence longer than the budget is cut at a word boundary
    while (s.length > limitFor(out.length)) {
      const lim = limitFor(out.length);
      // prefer to end the clip at a clause mark (so the voice stops where a person would pause), then at a space, and only then cut hard
      let pc = -1; for (const m of ["，", "、", "；", "：", ",", ";"]) pc = Math.max(pc, s.lastIndexOf(m, lim - 1));
      let cut = pc >= lim * 0.4 ? pc + 1 : s.lastIndexOf(" ", lim);
      if (cut < lim * 0.6 && !(pc >= lim * 0.4)) {
        // no good boundary before the limit: look a little PAST it for a space or clause mark before cutting a word in two
        let fw = -1; for (const m of [" ", "，", "、", "；", "：", ",", ";"]) { const k = s.indexOf(m, lim); if (k > 0 && (fw < 0 || k < fw)) fw = k; }
        cut = fw > 0 && fw <= lim * 1.5 ? fw + 1 : lim;
      }
      const head = s.slice(0, cut).trim();
      if (head) out.push(head);
      s = s.slice(cut).trim();
    }
    // Then PACK it into the chunk being filled, instead of starting a new one per
    // sentence. This used to emit one request per sentence, so a tutor answer of
    // ten short sentences became ten synthesised clips, each separated by the global
    // 1.2s request gap — that is the "กดแล้วรอนาน" the owner reported, and ten
    // requests in a row is also what runs into the provider's rate limit part-way
    // through a message. Packing keeps the same words in far fewer round trips.
    // The FIRST chunk is the exception: it is what the learner is waiting for, so it
    // stays one sentence — the shortest clip that still says something real, which is
    // the fastest possible "กดแล้วมาเลย".
    const i = out.length - 1;
    if (i >= 0 && out[i].length + 1 + s.length <= limitFor(i)) out[i] = (out[i] + " " + s).trim();
    else if (s) out.push(s);
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
  // the slot is reserved BEFORE waiting, so two callers that arrive together are spaced apart instead of both passing at once
  const at = Math.max(Date.now(), _ttsLastReqAt + TTS_MIN_GAP_MS);
  _ttsLastReqAt = at;
  const wait = at - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
/* Nothing in the read-aloud chain may wait forever. A fetch that never settles and
   a clip whose `onended` never arrives both used to end playback silently, in the
   middle of the message, with nothing on screen — the owner reported it as "อ่าน
   ไปสองบรรทัดแล้วหยุด" (2026-10-02). Every wait below has a ceiling instead. */
export const TTS_CHUNK_WAIT_MS = 20000;    // the FIRST clip: if it has not arrived in this long the device voice reads the whole message
export const TTS_NEXT_WAIT_MS = 45000;     // a LATER clip is waited for much longer: the first clip is already being heard, and the other way out is a cut-off message
/* How long a failed request asks to wait before it is tried again: the provider's own "retry in 34.2s" (it reaches us in the 502 body), else a short
   pause when the failure looks like a rate limit. null = not a rate limit. */
export function ttsRateHintMs(e) {
  const m = String((e && e.message) || e || "");
  const h = m.match(/retry in ([\d.]+)\s*s/i);
  if (h) return Math.min(40000, Math.ceil(parseFloat(h[1]) * 1000) + 500);
  if (/\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(m)) return 6000;
  return null;
}
export function withTimeout(p, ms, tag) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const to = setTimeout(() => { if (settled) return; settled = true; reject(Object.assign(new Error(tag || "timeout"), { wait: true })); }, ms);
    p.then(v => { if (settled) return; settled = true; clearTimeout(to); resolve(v); },
      e => { if (settled) return; settled = true; clearTimeout(to); reject(e); });
  });
}

export async function ttsFetchBuffer(s, lang, ac, tries = 3, timeoutMs = 30000, opts = null) {
  const voice = (opts && opts.voice) || getVmVoiceName();   // a caller may name its own prebuilt voice (the concept clips use a narrator)
  const key = ttsKey(s, lang, voice);
  const cached = await ttsCacheGet(key);                // free, instant, offline-safe
  if (cached) { try { return await ac.decodeAudioData(cached); } catch (e) {} }
  // a clip that has to be paid for first asks the caller's allowance (the chat's read-aloud has one, see ttsBudgetSpend);
  // a cached clip never reaches here, so a repeat listen is always free
  if (opts && opts.spend && !opts.spend(s)) throw Object.assign(new Error("tts-budget"), { budget: true });
  try { return await ttsFetchRetry(s, lang, ac, tries, timeoutMs, opts, voice, key); }
  catch (e) {
    // no clip came of it, so what was taken from the allowance is given back (a stop mid-request keeps it: the request may have run)
    if (opts && opts.refund && !_ttsCancelled) opts.refund(s);
    throw e;
  }
}
async function ttsFetchRetry(s, lang, ac, tries, timeoutMs, opts, voice, key) {
  let lastErr = null;
  for (let n = 0; n < tries; n++) {
    if (n > 0) {
      const hint = ttsRateHintMs(lastErr);
      // a later clip (tries >= 5) is patient with a rate limit: the earlier clip is still playing, so the wait costs the learner nothing; the first
      // clip never waits long, the device voice is the better answer there
      if (hint != null && tries < 5 && hint > 8000) throw lastErr;
      await new Promise((r) => setTimeout(r, hint != null ? hint : 1200 * Math.pow(2, Math.min(n, 3) - 1)));
    }
    if (_ttsCancelled && !(opts && opts.src === "clip")) throw new Error("cancelled");
    if (opts && opts.dead && opts.dead()) throw new Error("cancelled");
    await ttsThrottle();
    // the throttle may have waited a second or more: a stop in the meantime must not still send (and pay for) the request
    if (_ttsCancelled && !(opts && opts.src === "clip")) throw new Error("cancelled");
    if (opts && opts.dead && opts.dead()) throw new Error("cancelled");
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(TTS_URL, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify((() => { const text = opts && opts.style ? opts.style + "\n\n\"" + String(s).replace(/"/g, "'") + "\"" : styleTTS(s, lang); return opts && opts.src ? { text, lang, voice, src: opts.src } : { text, lang, voice }; })()),
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
      if (_ttsCancelled && !(opts && opts.src === "clip")) throw e;
    } finally { clearTimeout(to); }
  }
  throw lastErr || new Error("TTS failed");
}

/* ── The chat's read-aloud (owner, 2026-10-01) ──
   A speaker button on every message of the chat speaks it in one soft male voice, in the language the message is
   written in. Paid-plan only (Max and Max Family — see chat-ui.tsx), and it costs real money per word, so besides the
   clip cache above (a repeat listen is free) each device has a day's allowance of cloud speech, counted in SECONDS of
   speech: estimated from the text, since Thai, English and Chinese carry very different amounts of speech per character.
   Past it the button falls back to the device's own voice instead of going silent. */
export function detectSpeechLang(text, fallback = "en") {
  let th = 0, zh = 0, la = 0;
  for (const ch of String(text || "")) {
    const c = ch.codePointAt(0);
    if (c >= 0x0E00 && c <= 0x0E7F) th++;
    else if ((c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF)) zh++;
    else if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) la++;
  }
  // a Chinese character is a whole syllable, a Latin letter a fraction of one: weigh them so that a Thai or Chinese answer
  // with a few English terms in it is still Thai or Chinese, and an English answer with one Thai word is still English
  const sTh = th, sZh = zh * 2, sEn = la / 4;
  if (!th && !zh) return la ? "en" : fallback;
  if (sEn > sTh + sZh) return "en";
  return sZh > sTh ? "zh" : "th";
}
const TTS_CHARS_PER_SEC = { th: 11, en: 15, zh: 4.5 };
export function ttsEstSeconds(text, lang) { return String(text || "").length / (TTS_CHARS_PER_SEC[lang] || 12); }
export const TTS_DAILY_SECONDS = 300;                   // five minutes of cloud speech a day on a device (about ฿2.5 at today's price)
const TTS_DAY_KEY = "tg_tts_day";
function ttsDayKey() { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function ttsDayRead() {
  try { const r = JSON.parse(localStorage.getItem(TTS_DAY_KEY) || "null"); if (r && r.d === ttsDayKey()) return r; } catch (e) {}
  return { d: ttsDayKey(), s: 0 };
}
export function ttsBudgetLeft() { return Math.max(0, TTS_DAILY_SECONDS - ttsDayRead().s); }
/* Takes `seconds` from today's allowance; false (and nothing taken) when they do not fit. */
export function ttsBudgetSpend(seconds) {
  const r = ttsDayRead();
  if (r.s + seconds > TTS_DAILY_SECONDS) return false;
  r.s = +(r.s + seconds).toFixed(2);
  try { localStorage.setItem(TTS_DAY_KEY, JSON.stringify(r)); } catch (e) {}
  return true;
}
/* ── One read-aloud a day (owner, 2026-10-31: "กดฟังเสียงได้ไม่เกินวันละ 1 รอบ ไม่งั้นต้นทุนแบกไม่ไหว") ──
   The cloud voice costs real money per word, so a paying device may have ONE message read in it per day. The round is taken
   when the first clip of a message is paid for (once per message, see speakCloud's `charged`) and given back when no sound came
   of it. A message that is already in the clip cache costs nothing and so never asks: replaying today's message is free.
   Counted on the device (localStorage), like the seconds allowance above; a server-side count would need a table and a deploy. */
export const TTS_DAILY_ROUNDS = 1;
const TTS_ROUND_KEY = "tg_tts_round";
function ttsRoundRead() {
  try { const r = JSON.parse(localStorage.getItem(TTS_ROUND_KEY) || "null"); if (r && r.d === ttsDayKey()) return r; } catch (e) {}
  return { d: ttsDayKey(), n: 0 };
}
export function ttsRoundsLeft() { return Math.max(0, TTS_DAILY_ROUNDS - ttsRoundRead().n); }
export function ttsRoundSpend() {
  const r = ttsRoundRead();
  if (r.n >= TTS_DAILY_ROUNDS) return false;
  r.n++;
  try { localStorage.setItem(TTS_ROUND_KEY, JSON.stringify(r)); } catch (e) {}
  return true;
}
export function ttsRoundRefund() {
  const r = ttsRoundRead();
  r.n = Math.max(0, r.n - 1);
  try { localStorage.setItem(TTS_ROUND_KEY, JSON.stringify(r)); } catch (e) {}
}
/* Gives `seconds` back — a clip that was paid for but never came. */
export function ttsBudgetRefund(seconds) {
  const r = ttsDayRead();
  r.s = Math.max(0, +(r.s - seconds).toFixed(2));
  try { localStorage.setItem(TTS_DAY_KEY, JSON.stringify(r)); } catch (e) {}
}

/* How much speech goes into ONE request. A clip of a minute or more is where the synthesiser starts to drop the end of its
   text (the owner's "อ่านไม่เต็มประโยค") and where a request runs past its timeout and the rest of the message falls to the
   device voice — and the characters in a minute differ enormously by language (Chinese ~270, Thai ~660, English ~900), so a
   fixed character budget was a minute of Thai but several minutes of Chinese. The budget is therefore counted in SECONDS of
   speech: a later clip is about TTS_CHUNK_SECS long, the first (the one the learner waits for) about TTS_FIRST_SECS. TTS_CHUNK_CHARS and
   TTS_FIRST_CHUNK_CHARS stay as the ceilings. */
export const TTS_CHUNK_SECS = 24;
/* The first clip is what the learner waits for, and a request takes about 1.5 s plus 0.7 s for every second of speech it carries (measured from the
   piano-tts logs: 3.6 s for a short line, 9.7 s for about 12 s of speech, 16.5 s for about 24 s). So the first clip is only about 3 s of speech
   (a first sound in roughly 3.5 s), and the clips after it grow (5 s, then 11 s, then TTS_CHUNK_SECS) so that each is ready before the one before ends. */
export const TTS_FIRST_SECS = 3;
export const TTS_RAMP_SECS = [5, 11];
export function ttsChunkLimits(lang) {
  const cps = TTS_CHARS_PER_SEC[lang] || 12;
  return {
    max: Math.max(90, Math.min(TTS_CHUNK_CHARS, Math.round(cps * TTS_CHUNK_SECS))),
    first: Math.max(14, Math.min(TTS_FIRST_CHUNK_CHARS, Math.round(cps * TTS_FIRST_SECS))),
    ramp: TTS_RAMP_SECS.map((sec) => Math.max(20, Math.min(TTS_CHUNK_CHARS, Math.round(cps * sec)))),
  };
}
let _ttsWarmAt = 0;
/* Wakes the piano-tts function and the connection to it before the learner taps (a cold start and a first TLS handshake cost a second or more). Costs
   nothing: an OPTIONS request reaches no synthesiser. At most once every 3 minutes. */
export function prewarmTts() {
  const now = Date.now();
  if (now - _ttsWarmAt < 180000 || typeof fetch !== "function") return;
  _ttsWarmAt = now;
  try { fetch(TTS_URL, { method: "OPTIONS", headers: { "Access-Control-Request-Method": "POST" } }).catch(() => {}); } catch (e) {}
}
/* A test door for the owner's own account: the daily limit is skipped when this device has tg_tts_free = 1. */
export function ttsFree() { try { return localStorage.getItem("tg_tts_free") === "1"; } catch (e) { return false; } }
/* The part of a decoded clip that is not silence. Synthesised clips carry a few tenths of a second of silence at both ends; played
   back to back they make an audible hole between two chunks of one sentence. Playing only the audible part (with a short lead
   and tail so no breath is clipped) makes the joins smooth. Returns [start, end] in seconds; the whole clip if it cannot be read. */
export function ttsAudibleSpan(buf) {
  try {
    const d = buf.getChannelData(0), sr = buf.sampleRate, th = 0.01, n = d.length;
    let a = 0, b = n - 1;
    while (a < n && Math.abs(d[a]) < th) a++;
    while (b > a && Math.abs(d[b]) < th) b--;
    if (b - a < sr * 0.15) return [0, buf.duration];            // nearly all silence: leave it be
    return [Math.max(0, a / sr - 0.04), Math.min(buf.duration, b / sr + 0.12)];
  } catch (_e) { return [0, buf && buf.duration ? buf.duration : 0]; }
}

export async function speakCloud(text, lang, onStart, onDone, onError, rateMul = 1, opts = null) {
  stopCloudTTS();
  _ttsCancelled = false;
  // stopCloudTTS() just gave this call its number. _ttsCancelled alone cannot tell an old call from this one — the next
  // speakCloud() sets it back to false, and a call that was still fetching would wake up and play over the new one (tap one
  // chat message's speaker while another is loading) — so every check below also asks whether it is still the latest call.
  const run = _ttsRun;
  const stale = () => _ttsCancelled || run !== _ttsRun;
  const clean = cleanForTTS(text);
  if (!clean) { if (onDone) onDone(); return false; }
  const ac = getAC(); // resume/unlock the audio context inside the user gesture
  // One request for the whole reply. The Edge Function caps the prompt at 4000
  // chars including the style directive, so 3600 leaves room for it — and replies
  // are capped at ~50 words by the chat system prompt, so this is a single request
  // in practice. One request = one continuous clip: no seams between clips (the
  // "choppy" complaint) and no second call to trip Gemini's rate limit (the
  // "stops after one line" complaint).
  const lim = ttsChunkLimits(lang);
  const chunks = ttsChunks(clean, lim.max, lim.first, lim.ramp);

  /* โควตาคิดทีเดียวทั้งข้อความ ไม่ใช่ทีละก้อน — เดิมคิดทีละก้อน พอโควตาหมดกลาง
     ข้อความฟังจะ "หยุดกลางคัน" (ครูอ่านไม่ครบ ซึ่งแย่กว่าไม่อ่านเลย) ตอนนี้ถ้าเงิน
     ไม่พอสำหรับทั้งข้อความ → ไม่เริ่มเลย แล้วไปอ่านทั้งข้อความด้วยเสียงเครื่องแทน
     (ครูอ่านได้ครบเสมอ ไม่ว่าจะเสียงไหน) */
  let charged = false, anyPlayed = false, chargeOk = null;
  const ctl = { dead: false };        // set when this call is over, so a fetch that is still retrying in the background stops asking the provider
  const msgOpts = opts ? {
    ...opts,
    spend: (s) => { if (chargeOk !== null) return chargeOk; chargeOk = opts.spend ? !!opts.spend(clean) : true; charged = chargeOk; return chargeOk; },   // the verdict is remembered: two clips asking at once must not both pass a refusal
    // the day's allowance is given back only when NO sound came of the message: a message that was heard in part was paid for
    refund: (s) => { if (!charged || anyPlayed) return; charged = false; chargeOk = null; if (opts.refund) opts.refund(clean); },
    dead: () => ctl.dead || stale(),
  } : null;

  try {
    // Up to TTS_AHEAD clips are requested ahead of the one being heard (spaced 1.2 s apart by ttsThrottle), and a later clip gets patient retries that honour
    // the provider's "retry in Ns": a minute of speech takes several requests on one shared key, and a single refusal used to end the reading.
    const TTS_AHEAD = 3;
    const pend = [];
    const want = (k) => { if (k < chunks.length && !pend[k]) { pend[k] = ttsFetchBuffer(chunks[k], lang, ac, k === 0 ? 3 : 5, 30000, msgOpts); pend[k].catch(() => {}); } return pend[k]; };
    for (let k = 0; k < Math.min(TTS_AHEAD, chunks.length); k++) want(k);
    const nowT = () => (Number.isFinite(ac.currentTime) ? ac.currentTime : 0);
    const live = [];          // the sources this call has scheduled
    let playEnd = 0;          // the context time at which everything scheduled so far ends
    const stopLive = () => { for (const x of live) { try { x.stop(); } catch (_) {} _ttsSources.delete(x); } live.length = 0; };
    /* Clips are QUEUED on the audio clock, each starting exactly where the one before ends, instead of waiting for `onended` and starting the next from
       the main thread: that wait is where the little stutter between two clips came from. */
    const schedule = (buf) => {
      const src = ac.createBufferSource();
      src.buffer = buf;
      if (rateMul && rateMul !== 1) src.playbackRate.value = Math.max(0.5, Math.min(1.8, rateMul));
      src.connect(ac.destination);
      const [t0, t1] = ttsAudibleSpan(buf);
      const span = t1 > t0 ? t1 - t0 : (buf && buf.duration ? buf.duration : 8);
      const when = Math.max(nowT() + 0.03, playEnd);
      src.onended = () => { _ttsSources.delete(src); };
      live.push(src); _ttsSources.add(src); _ttsSource = src;
      try { if (t1 > t0) src.start(when, t0, span); else src.start(when); } catch (e) { _ttsSources.delete(src); return; }
      playEnd = when + span / (src.playbackRate.value || 1);
    };
    /* Resolves when the last scheduled clip has been heard to its end. An AudioContext suspended when a phone takes audio focus never fires `onended`,
       and that alone used to freeze the loop mid-message, so a timer sized off the real length ends the wait too (and stops what is still queued). */
    const waitPlayback = () => new Promise((resolve) => {
      const last = live[live.length - 1];
      if (!last) { resolve(); return; }
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(w); resolve(); };
      const w = setTimeout(() => { stopLive(); fin(); }, (Math.max(0, playEnd - nowT()) + 4) * 1000);
      const prev = last.onended;
      last.onended = (ev) => { if (prev) prev(ev); fin(); };
    });
    let firstStarted = false;
    for (let i = 0; i < chunks.length; i++) {
      const curP = want(i);
      let buf;
      // Nothing here may wait forever. A chunk promise that never settles — a hung fetch, an IndexedDB read that never answers — used to leave playback dead
      // after the first clip with no error and nothing on screen. A later clip is waited for while the clips before it are still playing, plus a long grace.
      try { buf = await withTimeout(curP, i === 0 ? TTS_CHUNK_WAIT_MS : TTS_NEXT_WAIT_MS + Math.max(0, playEnd - nowT()) * 1000, "tts-chunk-wait"); }
      catch (e) {
        if (i === 0) throw e; // nothing played yet → let the caller fall back to the device voice
        // The cloud cannot finish this message. Do NOT stop here: a `break` used to drop this chunk AND every one after it, so a long answer could end two
        // lines in. Let what is already queued finish, then hand the unread remainder to the caller, which reads it with the device voice — the message
        // still reaches the learner in full, and nothing already read is read twice.
        console.warn("[TIGA TTS] chunk " + (i + 1) + "/" + chunks.length + " unavailable, device voice reads the rest:", e);
        await waitPlayback();
        if (stale()) return true;
        throw Object.assign(e instanceof Error ? e : new Error(String(e)), { rest: chunks.slice(i).join(" ").trim() });
      }
      if (stale()) return true;
      if (!firstStarted) { firstStarted = true; anyPlayed = true; if (onStart) onStart(); }
      // Resume AudioContext if iOS/Android suspended it between chunks — for at most 1.5 s: a context that will not come back must not freeze the message
      if (ac.state !== "running") { try { await withTimeout(ac.resume(), 1500, "ac-resume"); } catch (_) {} }
      if (stale()) return true;
      if (ac.state !== "running" && i > 0) { stopLive(); throw Object.assign(new Error("audio-context-" + ac.state), { rest: chunks.slice(i).join(" ").trim() }); }
      schedule(buf);
      // keep TTS_AHEAD requests in front of the clip being heard: their timeouts tick during playback, not from the start of the loop
      for (let k = 1; k <= TTS_AHEAD; k++) want(i + k);
    }
    await waitPlayback();
    if (stale()) return true;
    _ttsSource = null;
    ctl.dead = true;
    if (onDone) onDone();
    return true;
  } catch (e) {
    ctl.dead = true;
    // only a call that is still the latest may stop the audio: an older one failing late must not cut off a newer one
    if (run === _ttsRun) stopCloudTTS();
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
