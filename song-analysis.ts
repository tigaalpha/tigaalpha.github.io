import { readMemory } from "./ai-chat-context";
import { validateTip } from "./use-autoteach";

/* ── song-analysis.ts — วิเคราะห์จบเพลงด้วย TIGA Piano Model (Play Along plan #7)
   อัปเกรดจากการยิง AI ตรงๆ เป็น 3 ชั้น:
     1) TIGA teaching loop วิเคราะห์สัญญาณจริงก่อนเสมอ (กลยุทธ์ + diagnosis
        จากตัวเลขจริงของรอบที่เพิ่งเล่น) — เหมือนที่ Auto Teaching ทำ
     2) AI ภายนอกแค่เรียบเรียงภาษาตามกลยุทธ์ที่โมเดลเลือก → ตรวจก่อนแสดง
        (validateTip เดียวกับ Auto Teaching — คำแนะนำสากล/หลุดขอบเขตไม่มีทางโชว์)
     3) พลาดทุกชั้น → fallback จากข้อมูลจริงของรอบนั้น (โน้ตที่พลาดจริง)
   ไม่มี I/O อื่นใดในไฟล์นี้ — โมเดล/AI ถูกส่งเข้ามาเป็นพารามิเตอร์
   (loopFn/askAi) เพื่อให้ทดสอบ headless กับ teaching loop จริงได้ ── */

const STRATEGY = {
  praise:            { th: "เน้นชมความก้าวหน้าก่อนแล้วค่อยแนะนำเล็กน้อย", en: "lead with praise before a small suggestion", zh: "先表扬进步再给小建议" },
  micro_challenge:   { th: "ท้าทายสั้น ๆ ที่ทำได้แน่ (micro-challenge)",        en: "a small winnable micro-challenge",              zh: "一个稳赢的小挑战" },
  tiny_task:         { th: "ให้งานเล็กที่เสร็จได้ใน 2 นาที",                    en: "a tiny task doable in 2 minutes",               zh: "两分钟内能完成的小任务" },
  normalize_struggle:{ th: "ปลอบว่าติดตรงนี้เป็นเรื่องปกติของทุกคนแล้วให้ขั้นตอนเล็ก", en: "normalize the struggle, then give a small step", zh: "正常化困难再给小步骤" },
  encourage:         { th: "ให้กำลังใจเป็นหลัก ไม่กดดัน",                       en: "encouragement first, no pressure",              zh: "以鼓励为主不加压" },
  check_in:          { th: "ถามอาการ/ความเหนื่อยก่อนว่าพร้อมฝึกต่อไหม",          en: "check in on energy before continuing",          zh: "先关心状态再继续" },
};
function strategyLine(strategyId, modelText, lang) {
  const s = STRATEGY[strategyId];
  const line = s ? (s[lang] || s.en) : (strategyId || null);
  if (!line && !modelText) return null;
  return modelText ? `${line || ""} — ${modelText}` : line;
}

/* Fallback from REAL data — mirrors buildFallbackTip's intent for songs.
   Uses the song's own numbers (missed notes / accuracy) — never generic. */
export function buildSongFallback(lang, label, result) {
  const missed = result.missedNotes || [];
  const top = missed[0] || null;
  const th = {
    weakness: missed.length
      ? `ช่วงที่มี "${top}" ยังไม่มั่น — พลาด ${missed.length} จาก ${result.total} โน้ต`
      : "เล่นครบทุกโน้ตแล้ว เหลือแค่เพิ่มความมั่นใจและเสถียรภาพจังหวะ",
    steps: missed.length
      ? [`ซ้อมโน้ต "${top}" ช้า ๆ 3 ครั้ง ก่อนรวมทั้งท่อน`, "เปิดเท็มโป 0.8x ซ้อมทั้งเพลงอีก 1 รอบ"]
      : ["เปิดเท็มโป 1.2x ท้าตัวเองอีก 1 รอบ", "ลองโหมดมือซ้ายเพิ่มความท้าทาย"],
  };
  const en = {
    weakness: missed.length
      ? `The "${top}" section is shaky — ${missed.length} of ${result.total} notes missed`
      : "Every note hit — now build confidence and steadier timing",
    steps: missed.length
      ? [`Slow-drill "${top}" 3 times, then join the whole phrase`, "Run the full song once at 0.8x tempo"]
      : ["Challenge yourself once at 1.2x tempo", "Try left-hand mode for a new challenge"],
  };
  const zh = {
    weakness: missed.length
      ? `“${top}” 段还不稳 — ${result.total} 个音错了 ${missed.length} 个`
      : "全部弹对了 — 继续建立信心和稳定节奏",
    steps: missed.length
      ? [`慢速练 "${top}" 3 次，再连整段`, "用 0.8x 速度完整跑一遍"]
      : ["用 1.2x 速度挑战一次", "试试左手模式"],
  };
  const c = lang === "th" ? th : lang === "zh" ? zh : en;
  return { weakness: c.weakness, steps: c.steps, fallback: true };
}

/* Single entry point. All I/O injected:
   loopFn — optional override of tigamodel runTeachingLoopForPractice(stats)
            (headless tests pass the pure teaching-loop directly)
   askAi  — optional ({system, message}) => Promise<string> external copywriter
   Returns {weakness, steps, strategy?} — never throws; on total failure the
   caller still gets the real-data fallback so the card is never empty. */
export async function analyzeSongRun(lang, label, result, loopFn, askAi, profile) {
  const L3 = lang === "th" ? "th" : lang === "zh" ? "zh" : "en";
  const buildSys = (stratLine) => ({
    th: `คุณคือ "ครู TiGA" ผู้เชี่ยวชาญสอนผู้เริ่มต้น ชมก่อนแล้วค่อยแนะนำ เจาะจงเสมอ ห้ามพูดกว้าง ๆ เช่น "ฝึกสม่ำเสมอ" ไม่แนะนำทฤษฎีขั้นสูง ตอบ JSON เท่านั้น {"weakness":"...","steps":["...","...","..."]} — weakness ไม่เกิน 15 คำ, steps 2-3 ข้อ ข้อละไม่เกิน 20 คำ${stratLine ? `\nกลยุทธ์ที่โมเดลสอนเลือก (ต้องทำตาม ห้ามขัด): ${stratLine}` : ""}`,
    zh: `你是"TiGA老师"，专教零基础学员。先表扬再建议，必须具体，禁止"多练习"这类空话，不提高阶乐理。只回JSON {"weakness":"...","steps":["...","...","..."]} — weakness≤15字，steps 2-3条每条≤20字${stratLine ? `\n模型已选教学策略（必须遵循）：${stratLine}` : ""}`,
    en: `You are "Teacher TiGA", specialized in absolute beginners. Praise before correcting. Always specific — never generic advice like "practice regularly". No advanced theory. Reply ONLY with JSON {"weakness":"...","steps":["...","...","..."]} — weakness ≤15 words, steps 2-3 items ≤20 words each.${stratLine ? `\nTeaching strategy chosen by the model (must follow): ${stratLine}` : ""}`,
  });
  const buildMsg = (stratLine) => {
    const missed = result.missedNotes || [];
    const okAll = result.hits === result.total && result.total > 0; // flawless run — validateTip's ≥4-char gate needs praise ≥4 chars
    const missedTxt = missed.length ? missed.slice(0, 20).join(", ") : (L3 === "th" ? "ไม่มีเลย — เล่นถูกทุกโน้ต ชมเป็นพิเศษ" : L3 === "zh" ? "无 — 全部弹对，特别表扬" : "none — every note was hit, praise specially");
    if (okAll && stratLine && /^(?:normalize_struggle|check_in)/i.test(stratLine)) stratLine = null; // wrong strategy for a flawless run
    let pastTxt = "";
    try {
      const struggles = (readMemory() && readMemory().struggles) || [];
      const past = label ? struggles.find(s => s.label === label || String(label).includes(s.label) || String(s.label).includes(label)) : null;
      if (past) pastTxt = L3 === "th" ? `\nจุดอ่อนเดิม: ${past.label} (${past.acc}%)` : L3 === "zh" ? `\n旧弱点：${past.label} (${past.acc}%)` : `\nPrior struggle: ${past.label} (${past.acc}%)`;
    } catch (e) {}
    return {
      th: `เพลง "${label}" ความแม่นยำ ${result.acc}% (ถูก ${result.hits}/${result.total}) โน้ตที่พลาด: ${missedTxt}${pastTxt}\nวิเคราะห์รูปแบบที่พลาด แล้วให้วิธีฝึกแก้ ตอบ JSON เท่านั้น`,
      zh: `歌曲"${label}"，准确率 ${result.acc}%（对 ${result.hits}/${result.total}）。错音：${missedTxt}${pastTxt}\n分析错误模式并给出练习方法，只回JSON`,
      en: `Song "${label}", accuracy ${result.acc}% (${result.hits}/${result.total} hit). Missed notes: ${missedTxt}.${pastTxt}\nAnalyze the miss pattern, give a fix. Reply JSON only.`,
    };
  };

  // ── 1) TIGA model first: teaching loop on the real run numbers ──
  let stratLine = null;
  try {
    let loop = null;
    if (typeof loopFn === "function") {
      loop = await Promise.resolve(loopFn({
        accuracy: result.acc,
        repeatedErrors: Math.min((result.missedNotes || []).length, 4),
        repeatedErrorLabel: (result.missedNotes || [])[0] || label,
        pauses: 0, rhythmScore: null, speedRatio: null, weekAgoAccuracy: null,
      }));
    } else {
      const { runTeachingLoopForPractice } = await import("./tigamodel/web.js");
      loop = await Promise.resolve(runTeachingLoopForPractice({
        accuracy: result.acc,
        repeatedErrors: Math.min((result.missedNotes || []).length, 4),
        repeatedErrorLabel: (result.missedNotes || [])[0] || label,
        pauses: 0, rhythmScore: null, speedRatio: null, weekAgoAccuracy: null,
      }));
    }
    if (loop && loop.response) {
      stratLine = strategyLine(loop.decision ? loop.decision.strategy_id : null, loop.response.text || "", L3);
    }
  } catch (e) { stratLine = null; }

  // ── 2) external AI renders the language — one attempt, strictly validated ──
  // (skipped entirely for guests — same silent bonus treatment as before, and
  // the injected askAi closure does its own auth gate anyway)
  if (askAi) {
    try {
      const sys = buildSys(stratLine)[L3];
      const msg = buildMsg(stratLine)[L3];
      const txt = await askAi({ system: sys, message: msg });
      const jm = typeof txt === "string" && txt.match(/\{[\s\S]*\}/);
      if (jm) {
        const obj = JSON.parse(jm[0]);
        obj.steps = Array.isArray(obj.steps) ? obj.steps.slice(0, 3) : [];
        delete obj.feature; // this card has no navigation feature — a stray key must not fail validation
        if (validateTip(obj, [])) {
          return { weakness: obj.weakness, steps: obj.steps, strategy: stratLine || null };
        }
      }
    } catch (e) { /* fall through to fallback */ }
  }
  // ── 3) fallback from real data (still specific, never generic) ──
  return buildSongFallback(lang, label, result);
}
