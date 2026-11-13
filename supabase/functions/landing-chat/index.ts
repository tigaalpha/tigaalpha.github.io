// landing-chat — Supabase Edge Function (Deno)
//
// This file IS the deployed function — deploy from here, same convention as
// piano-chat/index.ts next door.
//
// The AI behind the question box on marketing landing page 1, which ships as
// six URLs: /landing/ (Thai), /landing-en/, /landing-zh/, /landing-ja/, /landing-ko/, /landing-ru/.
//
// verify_jwt is FALSE here, and every protection is in this file:
//   1. This function owns the system prompt. The client cannot supply one.
//   2. Hard caps on input length, history length and output tokens.
//   3. Three rate limits, checked before any provider is called.
//   4. Free OpenRouter routes only — the worst case is that it stops
//      answering, never that it starts billing.

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
// Instruct models first, reasoning models behind them. On 14 Sep a visitor
// asked "block chord คือ" and was shown the model's private chain of thought
// instead of an answer — "Okay, the user is asking about... I need to explain
// this simply, in Thai, under 150 words, as per the rules" — in English, and
// quoting this file's own instructions back at them. The rung that did it was
// the first one, a reasoning model, and `reasoning: { exclude: true }` did not
// suppress it because the route emitted the thinking as ordinary content.
// stripThinking() below now catches it whichever rung leaks, but a model that
// does not think out loud in the first place is the cheaper defence.
const FREE_LADDER = [
  "google/gemma-4-26b-a4b-it:free",
  "nex-agi/nex-n2.5-pro:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "openrouter/free",
];

const MAX_TOKENS = 700;        // a landing-page answer is short by design
// A rung gets this long to produce its FIRST token, and this long in total.
// Without these a single slow free route holds the whole request open — a
// pg_net probe on 14 Sep sat for the full 120s and got nothing, because rung 1
// was rate-limited and rung 2 simply never finished. A visitor waits far less
// than 120s before closing the tab, so a rung that is this slow is no more use
// than one that is down: abandon it and try the next.
// Measured, not guessed: a live probe on 14 Sep saw a healthy rung take about
// 20s to its first token and still return a perfectly good Thai answer, so a
// 12s deadline would have thrown away a working reply. 25s is past that and
// still far short of the 120s hang this exists to stop.
const RUNG_FIRST_TOKEN_MS = 25000;
const RUNG_TOTAL_MS = 60000;
// And a ceiling on the whole ladder walk, so five slow rungs in a row cannot
// add up to something no visitor would ever wait for.
const LADDER_BUDGET_MS = 75000;
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
- ตอบเป็นภาษาไทยเสมอ ไม่ว่าคำถามจะพิมพ์มาด้วยภาษาอะไรก็ตาม ศัพท์เฉพาะทางดนตรีทับศัพท์ภาษาอังกฤษได้ (block chord, triad, scale, voicing) แต่ประโยคต้องเป็นภาษาไทย
- ห้ามแสดงความคิดหรือขั้นตอนการคิดของตัวเอง ห้ามพูดถึง "ผู้ใช้" "คำถามนี้" หรือกติกาในข้อความนี้ ตอบคำตอบสุดท้ายออกมาตรง ๆ เลย
- สั้น กระชับ ไม่เกิน 150 คำ ตอบให้ตรงคำถามที่สุด
- อธิบายแบบครูที่นั่งอยู่ข้างเปียโนกับเขา ใช้ตัวอย่างที่กดตามได้จริง ระบุชื่อโน้ต (C D E F G A B) และเลขนิ้ว (1-5) เมื่อช่วยให้เข้าใจ
- ถ้าเป็นคำถามนอกเรื่องดนตรี/เปียโน ให้ตอบสั้น ๆ อย่างสุภาพว่าคุณถนัดเรื่องเปียโน แล้วชวนกลับมาถามเรื่องเปียโน
- ห้ามแต่งข้อมูลที่ไม่จริง ถ้าไม่แน่ใจให้บอกตรง ๆ
- อย่าใส่หัวข้อยาว ๆ หรือ markdown ซับซ้อน ใช้ **ตัวหนา** ได้เท่านั้น`,
  en: `You are "TIGA", a kind and unusually clear AI piano teacher, talking to someone who has just opened the page and is trying you for the first time.

Rules:
- Always answer in English, whatever language the question arrives in.
- Never show your reasoning or planning. Do not talk about "the user", the question, or these rules. Give the final answer only.
- Short: under 150 words, straight to the question.
- Explain like a teacher sitting at the piano beside them. Use examples they can actually play, naming notes (C D E F G A B) and finger numbers (1-5) where it helps.
- If the question is not about music or piano, say briefly and warmly that piano is your subject, and invite a piano question.
- Never invent facts. Say so if you are unsure.
- No long headings or heavy markdown — **bold** only.`,
  zh: `你是「TIGA」，一位亲切又讲解清楚的 AI 钢琴老师，正在和一个刚打开网页、第一次试用的人说话。

规则：
- 一律用中文回答，无论问题用什么语言提出。音乐专业术语可以保留英文（block chord、triad、scale、voicing），但句子要用中文。
- 不要展示你的思考过程，不要提到「用户」、这个问题或以上规则，直接给出最终答案。
- 简短，不超过 150 字，直接回答问题。
- 像坐在钢琴旁边的老师那样讲解，举他们真的能弹的例子，需要时写出音名（C D E F G A B）和指法编号（1-5）。
- 如果问题与音乐或钢琴无关，就简短而友善地说明你擅长的是钢琴，并邀请他们问钢琴相关的问题。
- 不要编造事实，不确定就直说。
- 不要用长标题或复杂 markdown，只能用 **粗体**。`,
  ja: `あなたは「TIGA」。親切で説明がとても上手なAIピアノ先生です。いま初めてこのページを開いて試している人と話しています。

ルール：
- 質問がどの言語で来ても、必ず日本語で答えてください。音楽用語は英語のままでも構いません（block chord、triad、scale、voicing）が、文は日本語にしてください。
- 考えている過程や計画は出さないでください。「ユーザー」「この質問」「これらのルール」には触れず、最終的な答えだけをそのまま書いてください。
- 短く：150字以内、質問にまっすぐ答えてください。
- ピアノの隣に座っている先生のように説明し、実際に弾ける例を使ってください。必要なら音名（C D E F G A B）と指番号（1-5）を書いてください。
- 音楽やピアノと関係のない質問には、ピアノが得意分野だと短くやさしく伝えて、ピアノの質問を促してください。
- 事実を作らないでください。わからないときは正直にそう言ってください。
- 長い見出しや複雑なmarkdownは使わず、**太字**だけを使ってください。`,
  ko: `당신은 'TIGA', 친절하고 설명을 아주 잘하는 AI 피아노 선생님이에요. 지금 막 이 페이지를 열고 처음 써 보는 사람과 이야기하고 있어요.

규칙:
- 질문이 어떤 언어로 오든 항상 한국어로 답하세요. 음악 전문 용어는 영어 그대로 써도 되지만(block chord, triad, scale, voicing) 문장은 한국어여야 해요.
- 생각하는 과정이나 계획은 보여주지 마세요. '사용자', '이 질문', 이 규칙들을 언급하지 말고 최종 답변만 바로 쓰세요.
- 짧게: 150단어 이내로, 질문에 곧바로 답하세요.
- 피아노 옆에 앉은 선생님처럼 설명하고, 실제로 칠 수 있는 예를 드세요. 도움이 되면 음 이름(C D E F G A B)과 손가락 번호(1-5)를 쓰세요.
- 음악이나 피아노와 무관한 질문이면, 피아노가 전문이라고 짧고 따뜻하게 말하고 피아노 질문을 해 달라고 권하세요.
- 사실을 지어내지 마세요. 확실하지 않으면 솔직히 말하세요.
- 긴 제목이나 복잡한 markdown은 쓰지 말고 **굵게**만 쓰세요.`,
  ru: `Вы — «TIGA», добрый и очень понятно объясняющий ИИ-учитель пианино. Вы разговариваете с человеком, который только что открыл страницу и пробует вас в первый раз.

Правила:
- Всегда отвечайте по-русски, на каком бы языке ни пришёл вопрос. Музыкальные термины можно оставлять по-английски (block chord, triad, scale, voicing), но предложения должны быть русскими.
- Не показывайте свои рассуждения и планы. Не упоминайте «пользователя», сам вопрос или эти правила — пишите сразу готовый ответ.
- Коротко: не больше 150 слов, прямо по вопросу.
- Объясняйте как учитель, сидящий рядом за пианино: приводите примеры, которые можно сыграть, называйте ноты (C D E F G A B) и номера пальцев (1-5), когда это помогает.
- Если вопрос не про музыку или пианино, коротко и тепло скажите, что ваша тема — пианино, и предложите задать вопрос о нём.
- Не выдумывайте факты. Если не уверены — скажите об этом.
- Без длинных заголовков и сложной markdown-разметки, только **жирный**.`,
};

const LIMIT_MSG: Record<string, string> = {
  th: "วันนี้ถามครบโควตาฟรีแล้วครับ — สมัครสมาชิกฟรีเพื่อถาม TIGA ได้ไม่จำกัด",
  en: "That's the free questions for today — sign up free to ask TIGA without limit.",
  zh: "今天的免费提问已用完——免费注册即可无限提问。",
  ja: "本日の無料の質問は終了しました。無料で会員登録すると、TIGAに無制限で質問できます。",
  ko: "오늘의 무료 질문을 모두 사용했어요. 무료로 가입하면 TIGA에게 제한 없이 질문할 수 있어요.",
  ru: "Бесплатные вопросы на сегодня закончились — зарегистрируйтесь бесплатно, чтобы спрашивать TIGA без ограничений.",
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

/* ════════════════════════════════════════════════════════════════════════
   Never let a model's private thinking reach a visitor.

   Two shapes, because leaks come in two shapes:

   1. TAGGED — <think>…</think> (also <thinking>, <reasoning>, <thought>).
      Dropped wholesale. Tags can be split across stream chunks, so the tail
      of the buffer is held back whenever it could be the start of a tag.
      A block left open when the stream ends means the model ran out of tokens
      mid-thought: everything held back is thinking, so none of it is emitted.

   2. UNTAGGED — plain English prose about the task, which is what actually
      reached a visitor on 14 Sep. There is no marker to match, so this uses
      the one signal that is reliable here: on the Thai and Chinese pages a
      real answer is written in Thai or Chinese. Leading paragraphs containing
      no Thai/Chinese character at all are held back, and dropped the moment a
      paragraph in the right script arrives. Technical terms in English are
      untouched — they sit INSIDE a Thai sentence, so that paragraph has Thai
      in it and is kept whole.

      If the stream ends and not one Thai/Chinese character ever arrived, the
      held text is DROPPED rather than released. That case is exactly what the
      14-Sep visitor saw: the model spent its whole 700-token budget reasoning
      in English and was cut off at "Key points to cover:", so there was no
      answer underneath to reveal. Dropping it leaves streamRung having yielded
      nothing, which makes the ladder fall to the next rung and the visitor get
      a real Thai answer instead of somebody's notes. Holding costs nothing:
      MAX_TOKENS caps the buffer at a few kilobytes.

      English pages skip this rule entirely — there the script test says
      nothing — and rely on 1 plus the prompt.
   ════════════════════════════════════════════════════════════════════════ */
const THINK_OPEN = /<(?:think|thinking|reasoning|thought)\s*>/i;
const THINK_CLOSE = /<\/(?:think|thinking|reasoning|thought)\s*>/i;
const MAX_TAG = 12;                       // "</thinking>" is the longest we match
const hasCJKorThai = (t: string) => /[\u0E00-\u0E7F\u3400-\u9FFF]/.test(t);

function stripThinking(lang: string) {
  let buf = "";                 // not yet classified
  let inThink = false;
  let held = "";                // leading wrong-script prose, pending a verdict
  let holding = lang === "th" || lang === "zh";

  // How much of `s` is safe to emit without cutting a tag in half.
  const safeCut = (t: string) => {
    const i = t.lastIndexOf("<");
    return i === -1 || t.length - i > MAX_TAG ? t.length : i;
  };

  // Second pass: decide whether `piece` is answer or leftover reasoning.
  const gate = (piece: string): string => {
    if (!holding) return piece;
    held += piece;
    if (hasCJKorThai(held)) {
      // Drop whole leading paragraphs that carry no Thai/Chinese at all; the
      // answer starts at the first paragraph that does.
      const paras = held.split(/\n\s*\n/);
      let i = 0;
      while (i < paras.length - 1 && !hasCJKorThai(paras[i])) i++;
      const out = paras.slice(i).join("\n\n").replace(/^\s+/, "");
      holding = false; held = "";
      return out;
    }
    return "";                            // keep waiting for the first Thai/Chinese
  };

  return {
    push(piece: string): string {
      buf += piece;
      let out = "";
      for (;;) {
        if (!inThink) {
          const m = buf.match(THINK_OPEN);
          if (m) {
            out += buf.slice(0, m.index);
            buf = buf.slice(m.index! + m[0].length);
            inThink = true;
            continue;
          }
          const cut = safeCut(buf);
          out += buf.slice(0, cut);
          buf = buf.slice(cut);
          break;
        }
        const m = buf.match(THINK_CLOSE);
        if (m) { buf = buf.slice(m.index! + m[0].length); inThink = false; continue; }
        buf = buf.slice(safeCut(buf));    // still thinking — discard
        break;
      }
      return gate(out);
    },
    // Stream over. Release anything still held; an unclosed <think> means the
    // model never stopped reasoning, so that buffer is thrown away.
    flush(): string {
      const tail = inThink ? "" : buf;
      buf = "";
      // Still holding means a th/zh answer that never contained one character
      // of its own language. That is not an answer, so it is dropped and the
      // rung counts as having produced nothing.
      const out = holding ? "" : tail;
      holding = false; held = "";
      return out;
    },
  };
}

// One free rung, streamed. Throws with the provider's message on failure.
async function* streamRung(model: string, system: string, messages: { role: string; content: string }[], lang = "th"): AsyncGenerator<string> {
  const strip = stripThinking(lang);
  // One controller for the whole rung: the deadlines below abort the fetch
  // itself, so a hung route frees the connection instead of leaking it.
  const ac = new AbortController();
  const started = Date.now();
  let gotFirst = false;
  const firstTimer = setTimeout(() => { if (!gotFirst) ac.abort(); }, RUNG_FIRST_TOKEN_MS);
  const totalTimer = setTimeout(() => ac.abort(), RUNG_TOTAL_MS);
  try {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: ac.signal,
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
      // delta.reasoning / delta.reasoning_content are deliberately not read:
      // a model that separates its thinking properly is already handled by
      // simply never looking at that field.
      const piece = evt?.choices?.[0]?.delta?.content;
      if (typeof piece === "string" && piece) {
        gotFirst = true;                 // the route is alive, drop the first-token deadline
        const clean = strip.push(piece);
        if (clean) yield clean;
      }
    }
  }
  const tail = strip.flush();
  if (tail) yield tail;
  } catch (e) {
    // An abort is this function's own deadline firing, not a provider fault.
    // Report it as retryable so the ladder moves on instead of surfacing
    // "AbortError" to a stranger reading a landing page.
    if ((e as Error)?.name === "AbortError") {
      throw new Error(`${model} too slow (${Date.now() - started}ms) - rate limit`);
    }
    throw e;
  } finally {
    clearTimeout(firstTimer);
    clearTimeout(totalTimer);
  }
}

// Walk the ladder: a rung that is rate-limited, retired or having an outage
// hands over to the next. A rung that has already emitted text is never
// swapped mid-answer — half of one reply spliced onto half of another would
// be worse than an error.
async function* answer(system: string, messages: { role: string; content: string }[], lang = "th"): AsyncGenerator<string> {
  let firstErr = "";
  const deadline = Date.now() + LADDER_BUDGET_MS;
  for (let i = 0; i < FREE_LADDER.length; i++) {
    const model = FREE_LADDER[i];
    if (Date.now() > deadline) {
      console.error(`[landing-chat] ladder budget spent before ${model}`);
      break;
    }
    let yielded = false;
    try {
      for await (const piece of streamRung(model, system, messages, lang)) { yielded = true; yield piece; }
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

  const lang = ["th", "en", "zh", "ja", "ko", "ru"].includes(body?.lang) ? body.lang : "th";
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
  const gen = answer(SYSTEM[lang], messages, lang);

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
