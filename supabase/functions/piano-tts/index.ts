// piano-tts — Supabase Edge Function (Deno)
//
// ⚠️ IMPORTANT CONTEXT FOR WHOEVER DEPLOYS THIS:
// This file is a reconstruction written to match the wire contract the
// CLIENT (speech.ts) actually sends/expects, verified line-by-line against
// the real client code. The previously-deployed version was built from the
// dashboard (no source in this repo) and pinned Access-Control-Allow-Origin
// to https://tigaalpha.github.io — which silently killed speech on the
// Android app (origin capacitor://localhost) and any non-github.io host.
// The ONLY intended change in the original rewrite was CORS "*"; the
// request/response shape and Gemini TTS call mirrored what the old function
// did. THIS version adds a second engine — ElevenLabs — selected per the
// admin "AI Models" panel, alongside the original Gemini path.
//
// WIRE CONTRACT (confirmed from speech.ts):
//   Request:  POST { text: string, lang: "th"|"en"|"zh", voice?: string }
//             — text is already styled client-side (speech.ts styleTTS):
//               a natural-language delivery directive + the quoted content,
//               e.g. `อ่านด้วยน้ำเสียงครู...\n\n"สวัสดีครับ"`.
//             — voice is a Gemini prebuilt voice name: warm→Algieba,
//               deep→Schedar, friendly→Achird, bright→Puck (speech.ts
//               VM_VOICES). Missing → "Algieba". Ignored on the ElevenLabs
//               path — that engine uses the voice id from admin config.
//   Response: { "audio": "<base64 audio>", "fmt": "wav"|"mp3", "p": "gemini"|"elevenlabs" }
//             — client decodes with atob() → AudioContext.decodeAudioData
//               (speech.ts b64ToArrayBuffer / ttsFetchBuffer), which
//               auto-detects both WAV and MP3 containers.
//
// ENGINE SELECTION:
//   Reads the app_settings "ai_models" row, feature "voice-tts":
//     { provider: "gemini",     model: "gemini-2.5-flash-preview-tts", voice: "Algieba" }
//     { provider: "elevenlabs", model: "eleven_multilingual_v2",       voice: "<voice id>" }
//   Written by the AdminAIModels panel via admin_set_app_setting. Unset →
//   Gemini with the defaults below (today's behavior preserved).
//
// ENV VARS THIS FUNCTION NEEDS (set via `supabase secrets set`):
//   GEMINI_API_KEY      — required for the Gemini engine (AI Studio key).
//   ELEVENLABS_API_KEY  — required for the ElevenLabs engine (elevenlabs.io).
//   SUPABASE_URL / SUPABASE_ANON_KEY — auto-injected; used to read the
//                         voice-tts engine config from app_settings.
//
// RATE LIMITS (Gemini — why the 429 handling exists):
//   The Gemini TTS free tier allows only 10 requests/minute on the shared
//   key — and the client already throttles to >=1.2s between its own chunks,
//   so a few learners chatting at once (or a burst right after a deploy)
//   trips the per-minute bucket and Gemini answers 429 with a "retry in Ns"
//   message (and occasionally a 200 carrying an EMPTY audio part instead of
//   an error). Both are handled below: parse the suggested delay and retry
//   ONCE when the wait is short (<=25s); a long quota wait fails fast — the
//   client aborts at 30s and has its own retry/backoff, so sleeping here
//   would only waste the function's execution budget. Empty-audio 200s are
//   retryable up to MAX_RETRIES. ElevenLabs errors pass through as-is.
//
// The function is deployed with --verify-jwt on: the client always sends a
// real per-user session token (ai-backend.ts apiHeaders), so anonymous
// callers can't burn the project's TTS quota.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Gemini 2.5 Flash TTS — the model family the client's voice names
// (Algieba/Schedar/Achird/Puck) come from. Language is auto-detected from
// the text, so no langCode is required; we pass one as a hint when known.
const GEMINI_TTS_MODEL = Deno.env.get("GEMINI_TTS_MODEL") ?? "gemini-2.5-flash-preview-tts";
// ElevenLabs defaults — Eleven v3 is the only model in the family that
// officially supports Thai (70+ languages incl. tha) and it costs the same as
// multilingual v2 ($0.10/1K chars), so it's the default; multilingual v2 /
// flash v2.5 are kept selectable in the admin panel but do NOT cover Thai.
// The voice id is the admin-configured one, falling back to a natural male
// voice (Adam) if the admin hasn't picked one.
const ELEVEN_DEFAULT_MODEL = Deno.env.get("ELEVEN_TTS_MODEL") ?? "eleven_v3";
const ELEVEN_DEFAULT_VOICE = Deno.env.get("ELEVEN_TTS_VOICE") ?? "pNInz6obpgDQGcFmaJgB";
const MAX_RETRIES = 2;

// BCP-47 hint per client lang key (zh → Mandarin). Thai/English map 1:1.
const LANG_CODE: Record<string, string> = { th: "th", en: "en", zh: "cmn" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── which TTS engine/voice is active (admin "AI Models" → voice-tts) ──
async function resolveTtsConfig(authHeader: string | null): Promise<{ provider: string; model: string; voice: string }> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?key=eq.ai_models&select=value`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader || `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (res.ok) {
      const rows = await res.json();
      const v = rows?.[0]?.value;
      const tts = v && v["voice-tts"];
      if (tts && typeof tts.provider === "string" && typeof tts.model === "string") {
        return {
          provider: tts.provider === "elevenlabs" ? "elevenlabs" : "gemini",
          model: tts.model,
          voice: typeof tts.voice === "string" && tts.voice ? tts.voice : "",
        };
      }
    }
  } catch (_e) { /* fall through to defaults */ }
  return { provider: "gemini", model: GEMINI_TTS_MODEL, voice: "Algieba" };
}

// Pull a "retry in N.NNNs" suggestion out of Gemini's 429 body when present.
function retryAfterMs(errText: string): number {
  const m = errText.match(/retry in ([\d.]+)s/i);
  if (m) {
    const ms = Math.ceil(parseFloat(m[1]) * 1000);
    if (ms > 0 && ms <= 60000) return ms;
  }
  return 2500; // default backoff when the message lacks a delay
}

// One Gemini generateContent call → base64 WAV audio (or throws).
async function synthOnce(text: string, voice: string, lang: string, model: string): Promise<string> {
  // Natural-language style direction + quoted content: exactly what the
  // client already sends (styleTTS). Gemini TTS reads the directive to shape
  // delivery and speaks only the quoted text.
  const generationConfig: Record<string, any> = {
    responseModalities: ["AUDIO"],
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
    },
  };
  const langCode = LANG_CODE[lang];
  if (langCode) generationConfig.speechConfig.languageCode = langCode;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig,
      }),
    }
  );
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 600);
    throw Object.assign(new Error(`Gemini TTS ${res.status}: ${errText}`), { status: res.status });
  }
  const data = await res.json();
  const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
  // Prefer an inline audio part; a `data:` URI in a text part is the fallback.
  const inline = parts.find((p: any) => p?.inlineData && p.inlineData.data);
  if (inline) return inline.inlineData.data;
  const uri = parts.find((p: any) => typeof p?.text === "string" && p.text.startsWith("data:"));
  if (uri) return uri.text.split(",").slice(1).join(",");
  // No usable audio — could be a rate-limit-adjacent empty response.
  const finish = data?.candidates?.[0]?.finishReason || null;
  throw Object.assign(
    new Error(`Gemini TTS returned no audio (finish=${finish})`),
    { status: 200 }
  );
}

// Wrap raw little-endian 16-bit mono PCM (Gemini TTS default: 24kHz, 1ch,
// 16-bit) in a minimal RIFF/WAVE container — the exact format the old
// function returned (RIFF header showed 24000 Hz / 1ch / 16-bit).
function toWavBase64(pcmB64: string): string {
  const SAMPLE_RATE = 24000, CHANNELS = 1, BITS = 16;
  // NOTE: `new Uint8Array(string)` silently yields an EMPTY array in V8 —
  // a string is not array-like for the TypedArray constructor. Decode byte
  // by byte or every clip comes out as a silent 44-byte WAV.
  const bin = atob(pcmB64);
  const pcm = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
  const bytesPerSample = BITS / 8;
  const blockAlign = CHANNELS * bytesPerSample;
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = pcm.length;
  const wav = new Uint8Array(44 + dataSize);
  const dv = new DataView(wav.buffer);
  const ascii = (s: string, off: number) => { for (let i = 0; i < s.length; i++) wav[off + i] = s.charCodeAt(i); };
  ascii("RIFF", 0); dv.setUint32(4, 36 + dataSize, true); ascii("WAVE", 8);
  ascii("fmt ", 12); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, CHANNELS, true); dv.setUint32(24, SAMPLE_RATE, true);
  dv.setUint32(28, byteRate, true); dv.setUint16(32, blockAlign, true); dv.setUint16(34, BITS, true);
  ascii("data", 36); dv.setUint32(40, dataSize, true);
  wav.set(pcm, 44);
  let b64out = "";
  for (let i = 0; i < wav.length; i += 0x8000) b64out += String.fromCharCode(...wav.subarray(i, i + 0x8000));
  return btoa(b64out);
}

async function synthGemini(text: string, voice: string, lang: string, model: string): Promise<{ audio: string; fmt: string }> {
  let lastErr: unknown = null;
  let retried429 = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const wait = lastErr && typeof lastErr === "object" && "status" in lastErr
        ? retryAfterMs(String(lastErr))
        : 2500;
      // Long quota wait → fail fast (see RATE LIMITS above): the client
      // aborts at 30s anyway, so sleeping would just waste this invocation.
      if (wait > 25000) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
      await new Promise((r) => setTimeout(r, wait));
    }
    try {
      const b64 = await synthOnce(text, voice, lang, model);
      if (b64) return { audio: toWavBase64(b64), fmt: "wav" }; // PCM → WAV, the client's expected container
      throw Object.assign(new Error("empty audio"), { status: 200 });
    } catch (e) {
      lastErr = e;
      const status = (e as any)?.status;
      // Non-rate-limit failures (bad key, model error, safety) won't heal by
      // waiting — fail fast instead of making the caller wait for nothing.
      if (status !== 429 && status !== 200) throw e;
      // 429 is retried at most once (and only when the wait is short, see the
      // check above); empty-audio 200s stay retryable up to MAX_RETRIES.
      if (status === 429 && retried429) throw e;
      if (status === 429) retried429 = true;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// Strip the Gemini-style natural-language directive (speech.ts styleTTS sends
// `<directive>\n\n"<content>"`) and keep only the quoted content — ElevenLabs
// A key that is present but invalid/expired answers 401/403 — fall back to the
// Gemini engine rather than failing the voice tutor over a bad key.
function isAuthError(msg: string): boolean {
  return /(401|403|unauthorized|authentication|invalid api key|not authorized|permission denied|api key|credential)/i.test(msg);
}

// would otherwise READ the directive out loud. Falls back to the raw text.
function stripTtsDirective(text: string): string {
  const q = String(text || "").match(/"([\s\S]*)"/);
  if (q && q[1] && q[1].trim()) return q[1].trim();
  return String(text || "").trim();
}

// One ElevenLabs call → base64 MP3 audio (or throws). Voice id and model come
// from the admin config; the response is binary MP3, which the client's
// AudioContext.decodeAudioData handles natively.
async function synthElevenLabs(text: string, model: string, voiceId: string): Promise<{ audio: string; fmt: string }> {
  const v = voiceId || ELEVEN_DEFAULT_VOICE;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v)}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: stripTtsDirective(text),
      model_id: model || ELEVEN_DEFAULT_MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 },
    }),
  });
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 600);
    throw new Error(`ElevenLabs ${res.status}: ${errText}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  let b64out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) b64out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  if (!b64out) throw new Error("ElevenLabs returned empty audio");
  return { audio: btoa(b64out), fmt: "mp3" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  let payload: any;
  try {
    payload = await req.json();
  } catch (e) {
    return json({ error: "invalid json" }, 400);
  }
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (!text) return json({ error: "text required" }, 400);
  if (text.length > 4000) return json({ error: "text too long" }, 400);
  const lang = typeof payload?.lang === "string" ? payload.lang : "en";

  const authHeader = req.headers.get("authorization");
  const cfg = await resolveTtsConfig(authHeader);

  try {
    if (cfg.provider === "elevenlabs") {
      if (!ELEVENLABS_API_KEY) return json({ error: "ELEVENLABS_API_KEY not configured" }, 500);
      try {
        const { audio, fmt } = await synthElevenLabs(text, cfg.model, cfg.voice);
        return json({ audio, fmt, p: "elevenlabs", v: "2.1" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Bad/expired key — fall through to Gemini TTS instead of failing the
        // voice tutor. Anything else (quota, provider outage) propagates.
        if (!isAuthError(msg) || !GEMINI_API_KEY) throw e;
        console.error(`[piano-tts] ElevenLabs auth failed (${msg.slice(0, 140)}), falling back to Gemini TTS`);
      }
    }
    if (!GEMINI_API_KEY) {
      return json({ error: "GEMINI_API_KEY not configured" }, 500);
    }
    const voice = typeof payload?.voice === "string" && payload.voice ? payload.voice : "Algieba";
    const { audio, fmt } = await synthGemini(text, voice, lang, cfg.model || GEMINI_TTS_MODEL);
    return json({ audio, fmt, p: "gemini", v: "2.1" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 502);
  }
});
