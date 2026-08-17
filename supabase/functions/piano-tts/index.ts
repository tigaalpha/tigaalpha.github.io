// piano-tts — Supabase Edge Function (Deno)
//
// ⚠️ IMPORTANT CONTEXT FOR WHOEVER DEPLOYS THIS:
// This file is a reconstruction written to match the wire contract the
// CLIENT (speech.ts) actually sends/expects, verified line-by-line against
// the real client code. The previously-deployed version was built from the
// dashboard (no source in this repo) and pinned Access-Control-Allow-Origin
// to https://tigaalpha.github.io — which silently killed speech on the
// Android app (origin capacitor://localhost) and any non-github.io host.
// The ONLY intended change here is CORS "*"; the request/response shape and
// Gemini TTS call mirror what the old function did.
//
// WIRE CONTRACT (confirmed from speech.ts):
//   Request:  POST { text: string, lang: "th"|"en"|"zh", voice?: string }
//             — text is already styled client-side (speech.ts styleTTS):
//               a natural-language delivery directive + the quoted content,
//               e.g. `อ่านด้วยน้ำเสียงครู...\n\n"สวัสดีครับ"`.
//             — voice is a Gemini prebuilt voice name: warm→Algieba,
//               deep→Schedar, friendly→Achird, bright→Puck (speech.ts
//               VM_VOICES). Missing → "Algieba".
//   Response: { "audio": "<base64 WAV PCM>" }  — client decodes with
//             atob() → AudioContext.decodeAudioData (speech.ts
//             b64ToArrayBuffer / ttsFetchBuffer).
//
// ENV VARS THIS FUNCTION NEEDS (set via `supabase secrets set`):
//   GEMINI_API_KEY — required (AI Studio key; powers all TTS).
//   No Supabase URL/anon needed: this function has no DB access.
//
// RATE LIMITS (why the 429 handling exists):
//   The Gemini TTS free tier allows only 10 requests/minute on the shared
//   key — and the client already throttles to >=1.2s between its own chunks,
//   so a few learners chatting at once (or a burst right after a deploy)
//   trips the per-minute bucket and Gemini answers 429 with a "retry in Ns"
//   message (and occasionally a 200 carrying an EMPTY audio part instead of
//   an error). Both are handled below: parse the suggested delay and retry
//   ONCE when the wait is short (<=25s); a long quota wait fails fast — the
//   client aborts at 30s and has its own retry/backoff, so sleeping here
//   would only waste the function's execution budget. Empty-audio 200s are
//   retryable up to MAX_RETRIES.
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
// Gemini 2.5 Flash TTS — the model family the client's voice names
// (Algieba/Schedar/Achird/Puck) come from. Language is auto-detected from
// the text, so no langCode is required; we pass one as a hint when known.
const TTS_MODEL = Deno.env.get("GEMINI_TTS_MODEL") ?? "gemini-2.5-flash-preview-tts";
const MAX_RETRIES = 2;

// BCP-47 hint per client lang key (zh → Mandarin). Thai/English map 1:1.
const LANG_CODE: Record<string, string> = { th: "th", en: "en", zh: "cmn" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
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
async function synthOnce(text: string, voice: string, lang: string): Promise<string> {
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
    `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`,
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

async function synth(text: string, voice: string, lang: string): Promise<string> {
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
      const b64 = await synthOnce(text, voice, lang);
      if (b64) return toWavBase64(b64); // PCM → WAV, the client's expected container
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }
  if (!GEMINI_API_KEY) {
    return json({ error: "GEMINI_API_KEY not configured" }, 500);
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
  const voice = typeof payload?.voice === "string" && payload.voice ? payload.voice : "Algieba";
  const lang = typeof payload?.lang === "string" ? payload.lang : "en";

  try {
    const audio = await synth(text, voice, lang);
    return json({ audio, v: "2.1" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 502);
  }
});
