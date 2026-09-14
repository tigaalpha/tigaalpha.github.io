// landing-chat — Supabase Edge Function (Deno)
//
// This file IS the deployed function — deploy from here, same convention as
// piano-chat/index.ts next door.
//
// The AI behind the question box on marketing landing page 1, which ships as
// three URLs: /landing/ (Thai), /landing-en/, /landing-zh/.
//
// WHY THIS EXISTS INSTEAD OF piano-chat
// piano-chat has verify_jwt enabled on purpose: it requires a genuine per-user
// session so it cannot be called anonymously off the project's AI budget. The
// landing page needs exactly the thing that lock forbids — a stranger from an
// ad, with no account, typing one real question and getting a real answer —
// so it gets its own door with its own bouncer, rather than unlocking the
// app's.
//
// verify_jwt is therefore FALSE here, and every protection is in this file:
//
//   1. This function owns the system prompt. The client cannot supply one, so
//      this cannot be turned into a free general-purpose LLM proxy.
//   2. Hard caps on input length, history length and output tokens.
//   3. Three rate limits, checked before any provider is called: per visitor,
//      per IP, and a global daily ceiling so the free tier cannot be drained
//      in an afternoon no matter how many machines try.
//   4. Free OpenRouter routes only — the same ladder TIGA Chat itself runs on,
//      walked downward when a rung is rate-limited or retired. There is no
//      paid rung in this file at all: the worst case for this endpoint is that
//      it stops answering, never that it starts billing.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/* Same free ladder piano-chat uses, same order, and deliberately no paid rung.
   OpenRouter retires free routes without notice, so a list that can be walked
   is what keeps a retirement costing a moment instead of the feature. */
const FREE_LADDER = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nex-agi/nex-n2.5-pro:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "openrouter/free",
];

const MAX_TOKENS = 700;        // a landing-page answer is short by design
const MAX_QUESTION = 500;      // characters
const MAX_HISTORY = 4;         // turns kept from whatever the client sends

// ── limits, per rolling 24 hours ──
// PER_VISITOR matches the page's own free run exactly. It is not a slack
// backstop above it, because the page's counter lives in React state and so
// resets on refresh — this is the number that actually means "three
// questions", and without it a reload handed out three more.
const PER_VISITOR = 3;
const PER_IP = 25;             // a household or a school behind one NAT
const GLOBAL = 3000;           // budget guard: the whole endpoint, everyone

const SYSTEM: Record<string, string> = {
  th: `คุณคือ "TIGA" ครูสอนเปียโน AI ที่ใจดีและอธิบายเก่ง กำลังคุยกับคนที่เพิ่งเปิดหน้าเว็บมาลองใช้ครั้งแรก

กติกา:
- ตอบเป็นภาษาไทยเสมอ
- สั้น กระชับ ไม่เกิน 150 คำ ตอบให้ตรงคำถามที่สุด
- อธิบายแบบครูที่นั่งอยู่ข้างเปียโนกับเขา ใช้ตัวอย่างที่กดตามได้จริง ระบุชื่อโน้ต (C D E F G A B) และเลขนิ้ว (1-5) เมื่อช่วยให้เข้าใจ
- ถ้าเป็นคำถามนอกเรื่องดนตรี/เปียโน ให้ตอบสั้น ๆ อย่างสุภาพว่าคุณถนัดเรื่องเปียโน แล้วชวนกลับมาถามเรื่องเปียโน
- ห้ามแต่งข้อมูลที่ไม่จริง ถ้าไม่แน่ใจให้บอกตรง ๆ
- อย่าใส่หัวข้อยาว ๆ หรือ markdown ซับซ้อน ใช้ **ตัวหนา** ได้เท่านั้น`,
  en: `You are "TIGA", a kind and unusually clear AI piano teacher, talking to someone who has just opened the page and is trying you for the first time.

Rules:
- Always answer in English.
- Short: under 150 words, straight to the question.
- Explain like a teacher sitting at the piano beside them. Use examples they can actually play, naming notes (C D E F G A B) and finger numbers (1-5) where it helps.
- If the question is not about music or piano, say briefly and warmly that piano is your subject, and invite a piano question.
- Never invent facts. Say so if you are unsure.
- No long headings or heavy markdown — **bold** only.`,
  zh: `你是「TIGA」，一位亲切又讲解清楚的 AI 钢琴老师，正在和一个刚打开网页、第一次试用的人说话。

规则：
- 一律用中文回答。
- 简短，不超过 150 字，直接回答问题。
- 像坐在钢琴旁边的老师那样讲解，举他们真的能弹的例子，需要时写出音名（C D E F G A B）和指法编号（1-5）。
- 如果问题与音乐或钢琴无关，就简短而友善地说明你擅长的是钢琴，并邀请他们问钢琴相关的问题。
- 不要编造事实，不确定就直说。
- 不要用长标题或复杂 markdown，只能用 **粗体**。`,
};

const LIMIT_MSG: Record<string, string> = {
  th: "วันนี้ถามครบโควตาฟรีแล้วครับ — สมัครสมาชิกฟรีเพื่อถาม TIGA ได้ไม่จำกัด",
  en: "That's the free questions for today — sign up free to ask TIGA without limit.",
  zh: "今天的免费提问已用完——免费注册即可无限提问。",
};

const sse = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
const DONE = "data: [DONE]\n\n";
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

const isFree = (m: string) => /:free$/i.test(m) || m === "openrouter/free";
const isRetryable = (msg: string) =>
  /(429|rate.?limit|too many requests|quota|\b404\b|no endpoints found|model not found|unavailable for free|deprecated|\b5\d\d\b|overloaded|high demand|service unavailable|temporarily unavailable|402|insufficient (credits|funds|balance))/i.test(msg);

// ── how many questions this visitor / this IP / everyone has asked today ──
async function countsFor(anonId: string, ip: string): Promise<{ visitor: number; ip: number; global: number } | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;   // cannot check → fail open, see caller
  const since = new Date(Date.now() - 86400000).toISOString();
  const head = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Prefer: "count=exact",
    Range: "0-0",
  };
  const count = async (q: string): Promise<number> => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/landing_chat_usage?select=id&created_at=gte.${since}${q}`, { headers: head });
    const cr = res.headers.get("content-range") || "";      // "0-0/123"
    const n = parseInt(cr.split("/")[1] || "0", 10);
    return Number.isFinite(n) ? n : 0;
  };
  try {
    const [visitor, ipN, global] = await Promise.all([
      anonId ? count(`&anon_id=eq.${encodeURIComponent(anonId)}`) : Promise.resolve(0),
      ip ? count(`&ip=eq.${encodeURIComponent(ip)}`) : Promise.resolve(0),
      count(""),
    ]);
    return { visitor, ip: ipN, global };
  } catch (_e) {
    return null;
  }
}

async function record(anonId: string, ip: string, lang: string) {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/landing_chat_usage`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ anon_id: anonId || null, ip: ip || null, lang }),
    });
  } catch (_e) { /* never fail the answer over bookkeeping */ }
}

// One free rung, streamed. Throws with the provider's message on failure.
async function* streamRung(model: string, system: string, messages: { role: string; content: string }[]): AsyncGenerator<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "X-Title": "TIGA.AI landing",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      stream: true,
      reasoning: { exclude: true },
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const p = t.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      let evt: any;
      try { evt = JSON.parse(p); } catch { continue; }
      const piece = evt?.choices?.[0]?.delta?.content;
      if (typeof piece === "string" && piece) yield piece;
    }
  }
}

// Walk the ladder: a rung that is rate-limited, retired or having an outage
// hands over to the next. A rung that has already emitted text is never
// swapped mid-answer — half of one reply spliced onto half of another would
// be worse than an error.
async function* answer(system: string, messages: { role: string; content: string }[]): AsyncGenerator<string> {
  let firstErr = "";
  for (let i = 0; i < FREE_LADDER.length; i++) {
    const model = FREE_LADDER[i];
    let yielded = false;
    try {
      for await (const piece of streamRung(model, system, messages)) { yielded = true; yield piece; }
      if (yielded) return;
      if (!firstErr) firstErr = `${model} streamed nothing`;
      console.error(`[landing-chat] ${model} streamed nothing -> next rung`);
    } catch (e) {
      if (yielded) throw e;
      const msg = (e as Error)?.message || "";
      if (!firstErr) firstErr = msg;
      if (isFree(model) && isRetryable(msg) && i < FREE_LADDER.length - 1) {
        console.error(`[landing-chat] ${model} unavailable (${msg.slice(0, 140)}) -> next rung`);
        continue;
      }
      throw e;
    }
  }
  throw new Error(firstErr || "every free route was unavailable");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const lang = ["th", "en", "zh"].includes(body?.lang) ? body.lang : "th";
  const question = String(body?.question ?? "").trim().slice(0, MAX_QUESTION);
  if (!question) return json({ error: "empty question" }, 400);

  // The client may pass recent turns for context, but never a system prompt,
  // and never more than a few turns — both are decided here.
  const history = (Array.isArray(body?.history) ? body.history : [])
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1200) }));

  const anonId = String(body?.anon_id ?? "").slice(0, 64);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64);

  if (!OPENROUTER_API_KEY) return json({ error: "no AI provider configured" }, 503);

  /* Limits are checked before a provider is touched. If the ledger itself
     cannot be read we fail OPEN — a bookkeeping outage should not take the
     landing page's headline feature down — because the global ceiling is a
     budget guard, not a security boundary, and the free ladder cannot bill. */
  const c = await countsFor(anonId, ip);
  if (c) {
    const over = c.global >= GLOBAL ? "global" : c.ip >= PER_IP ? "ip" : c.visitor >= PER_VISITOR ? "visitor" : "";
    if (over) {
      console.error(`[landing-chat] limit hit (${over}) visitor=${c.visitor} ip=${c.ip} global=${c.global}`);
      return json({ error: LIMIT_MSG[lang], limit: true, scope: over }, 429);
    }
  }

  const messages = [...history, { role: "user", content: question }];
  const gen = answer(SYSTEM[lang], messages);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let last = Date.now();
      let any = false;
      // A free reasoning rung can think for several seconds before its first
      // token. A comment line is valid SSE that every parser ignores, but it
      // IS a read on the client, which is what keeps a healthy-but-slow answer
      // from being mistaken for a dead connection.
      const ping = setInterval(() => {
        if (Date.now() - last < 4000) return;
        try { controller.enqueue(enc.encode(": keep-alive\n\n")); last = Date.now(); } catch (_e) {}
      }, 2000);
      try {
        for await (const piece of gen) {
          any = true;
          controller.enqueue(enc.encode(sse({ content: piece })));
          last = Date.now();
        }
        if (any) record(anonId, ip, lang);   // only a real answer costs a question
      } catch (e) {
        console.error("[landing-chat] failed:", (e as Error).message);
        // Never stream a raw provider error into a stranger's first impression
        // of the product — a typed error event, which the page turns into its
        // own friendly line.
        controller.enqueue(enc.encode(sse({ error: (e as Error).message })));
      } finally {
        clearInterval(ping);
        controller.enqueue(enc.encode(DONE));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...CORS_HEADERS, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
});
