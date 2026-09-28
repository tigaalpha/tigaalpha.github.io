/* ── tigamodel/teaching/knowledge-surfaces.js — plan v3.4 6.3/6.4/6.9/6.10/11.2/11.3/11.4
   Product surfaces for the new knowledge pillars. Every function:
   • takes the KB (from web.js) as its first argument — no import cycles
   • returns trilingual {th,en,zh} text or null (honest-null contract)
   • cites the KB entry ids it drew from (sources) so claims are auditable
   • NEVER fabricates statistics and NEVER makes medical claims — the
     therapy surfaces speak wellbeing only, and every therapy reply ends
     with the disclaimer line. ── */

const pick = (kb, id) => { try { return kb.get(id) || null; } catch (e) { return null; } };

/* 6.3 — after a song ends: the one-step-up next-song advice (KB: mkt:seq:*).
   Uses the learner's real memory (last struggles/song) when present. */
export function nextSongAdvice(kb, memory, lang) {
  const base = pick(kb, "mkt:seq:one-level-up") || pick(kb, "mkt:seq:same-groove-first");
  if (!base) return null;
  const mem = memory || {};
  const struggle = (mem.struggles || [])[0] || null;
  const label = struggle && typeof struggle === "object" ? (struggle.label || struggle.th || struggle.en || "") : (typeof struggle === "string" ? struggle : "");
  const tip = {
    th: label
      ? `เพลงถัดไป: ยก "หนึ่งขั้น" จากเพลงที่เพิ่งเล่น — ซ้อมท่อนที่มี "${label}" ในเพลงใหม่ให้ชนะ 1 รอบ แล้วเพลงเก่าจะลื่นขึ้นเอง`
      : "เพลงถัดไป: เลือกเพลงที่ยากขึ้น 'หนึ่งขั้น' เท่านั้น — บันไดทีละขั้นคือวิธีที่ผู้เรียนอยู่ต่อได้ยาว",
    en: label
      ? `Next song: exactly one step up — win one run of the "${label}" section inside the new piece, and the old one gets smoother for free`
      : "Next song: pick one that's only one step harder — step-by-step ladders are how learners last",
    zh: label
      ? `下一首：只难一级——在新曲里赢一次含“${label}”的段落，旧曲自然更顺`
      : "下一首：选只难一级的曲子——一级一级的阶梯才是长久的学法",
  };
  return { tip, sources: ["mkt:seq:one-level-up", label ? "mkt:seq:same-groove-first" : "mkt:seq:one-level-up"], via: "marketing-kb" };
}

/* 6.4/6.10 — parent report "long-term value" section: what this path leads to.
   Built ONLY from the report's own real fields (rep) + the education-market KB.
   Null when the report is absent. */
export function longTermValueSection(kb, rep, lang) {
  if (!rep) return null;
  const e1 = pick(kb, "edu:parents:future-skills");
  const e2 = pick(kb, "edu:lifecycle:milestone-climb");
  if (!e1 || !e2) return null;
  const improved = (rep.improvements || []).length;
  const lines = {
    th: [
      "การเรียนดนตรีสร้างทักษะที่ติดตัวลูกทั้งชีวิต: วินัย · ความมั่นใจ · ความอดทน — ไม่ใช่แค่เพลงที่เล่นผ่าน",
      improved > 0
        ? `สัปดาห์นี้เห็นจริง ${improved} จุดที่ดีขึ้น — ความคืบหน้าที่ 'เห็นได้' คือเชื้อเพลิงของเส้นทางระยะยาว`
        : "ทุกเป้าหมายที่จบได้จริง (เพลงหนึ่ง · ท่อนหนึ่ง) คือบันไดขั้นถัดไปที่ลูกจะไต้ต่อเอง",
    ],
    en: [
      "Music study builds life-long skills: discipline, confidence, perseverance — not just songs completed.",
      improved > 0
        ? `${improved} real improvement${improved > 1 ? "s" : ""} this week — visible progress is the fuel of the long road`
        : "Every finishable goal (one song, one section) is the next rung the child climbs on their own",
    ],
    zh: [
      "学琴培养伴随一生的素质：自律、自信、坚持——不只是弹过的曲子。",
      improved > 0
        ? `本周有 ${improved} 处真实进步——看得见的进步是长路的燃料`
        : "每个能完成的目标（一首曲、一段落）都是孩子自己攀上的下一级台阶",
    ],
  };
  return { title: { th: "เส้นทางระยะยาวของลูก", en: "The long-term path", zh: "孩子的长期之路" }, lines: lines[lang] ? lines : lines.th ? { ...lines } : lines, sources: [e1.id, e2.id], via: "education-market-kb" };
}

/* 6.9 — career pathway answers: "เรียนเปียโนไปได้อะไร" — grounded ONLY in
   music-business KB entries; null when the question isn't career-shaped. */
export function careerPathwayReply(kb, question, lang) {
  const q = String(question || "").toLowerCase();
  const keys = ["อาชีพ", "ทำมาหากิน", "เรียนไปทำไม", "ไปได้อะไร", "มีทางไหม", "สอนได้", "career", "profession", "职业", "出路", "当老师"];
  if (!keys.some(k => q.includes(k))) return null;
  const e1 = pick(kb, "biz:brand:diversify");
  const e2 = pick(kb, "biz:live:live-is-core");
  const e3 = pick(kb, "biz:rights:sync-meaning");
  if (!e1) return null;
  const paths = {
    th: "เส้นทางอาชีพดนตรียุคนี้เป็นพอร์ตโฟลิโอหลายสายรวมกัน: สอน · รับจ้างเล่น/แต่งขาย · คอนเทนต์ · งานสด — คนที่ผสมได้ยั่งยืนกว่าพึ่งสายเดียว",
    en: "A modern music career is a portfolio: teaching, session/writing work, content, live shows — blending streams beats relying on one",
    zh: "现代音乐生涯是组合：教学、伴奏/创作、内容、演出——多线并存比单线更可持续",
  };
  return {
    text: { th: paths.th + (e2 ? " และ 'เล่นให้คนฟังได้จริง' คือทักษะธุรกิจตรง ๆ ที่ซ้อมวันนี้ก็คือลงทุนเวทีวันหน้า" : ""), en: paths.en + (e2 ? " 'Playable for a real audience' is a direct business skill — today's practice is stage investment." : ""), zh: paths.zh + (e2 ? " '能真正弹给观众听'就是直接的职业技能——今天练习就是明天舞台的投资。" : "") },
    sources: [e1.id, e2 && e2.id, e3 && e3.id].filter(Boolean),
    via: "music-business-kb",
  };
}

/* 11.2 — calming session intro (wellbeing frame, no medical language) */
export function calmModeIntro(kb, lang) {
  const e = pick(kb, "thx:practice:calm-session");
  if (!e) return null;
  return {
    intro: {
      th: "🌙 โหมดผ่อนคลาย: จบวันด้วยเพลงช้าที่คุณเล่นได้ — หายใจเข้าออกยาวตามห้องดนตรี ให้ช่วงนี้เป็นเวลาพักของใจคุณ",
      en: "🌙 Calm mode: end the day with a slow piece you can play — breathe long with the bars; let this be your mind's rest",
      zh: "🌙 放松模式：用你会弹的慢曲结束今天——随小节深呼吸，把这段时间留给心",
    },
    sources: [e.id], via: "music-therapy-kb",
  };
}

/* 11.3 — ISO mood check-in → song pick. candidates: [{ id, title, energy }]
   energy 1 (ที่สุดของความนุ่ม) … 5 (ที่สุดของความสด) — engine picks the
   candidate at the ISO ladder's first step for the reported mood. */
export function isoSongPick(kb, mood, candidates, lang) {
  const principle = pick(kb, "thx:core:iso-principle");
  const list = Array.isArray(candidates) ? candidates.filter(c => c && c.title && typeof c.energy === "number") : [];
  if (!principle || !list.length) return null;
  const target = mood === "down" ? 2 : mood === "stressed" ? 2 : mood === "up" ? 4 : 3;
  let best = null, bestGap = Infinity;
  for (const c of list) { const gap = Math.abs(c.energy - target); if (gap < bestGap) { bestGap = gap; best = c; } }
  const tip = {
    th: "หลัก ISO: เริ่มจากเพลงที่เข้ากับอารมณ์ตอนนี้ก่อน แล้วค่อยขยับไปอารมณ์ที่ต้องการทีละขั้น — ฟังเพลงแรกจนจบ แล้วสังเกตว่าใจเปลี่ยนไปหรือยัง",
    en: "ISO principle: start from a song matching this moment, then step gradually toward the one you want — finish the first song and notice how the heart moves",
    zh: "ISO 原则：先从贴合此刻情绪的歌开始，再一步步走向想要的状态——听完第一首，留意心的变化",
  };
  return { song: best ? { id: best.id, title: best.title } : null, tip, sources: [principle.id], via: "music-therapy-kb" };
}

/* 11.4 — the therapy disclaimer every emotional-support surface carries */
export function therapyDisclaimer(kb, lang) {
  const e = pick(kb, "thx:practice:boundary");
  if (!e) return null;
  return {
    th: "ข้อควรรู้: ครู TiGA เป็นครูดนตรี ไม่ใช่ผู้เชี่ยวชาญด้านการแพทย์หรือจิตเวช — ถ้ามีเรื่องหนักกว่าบทเรียน การพบผู้เชี่ยวชาญคือการดูแลตัวเองที่ดีที่สุด",
    en: "Please note: TiGA is a music teacher, not a medical or mental-health professional — for anything heavier than lessons, seeing a professional is the best self-care",
    zh: "请知悉：TiGA 是音乐老师，不是医疗或心理健康专业人士——若遇到比课程更重的事，寻求专业人士是最好的自我关怀",
    source: e.id,
  };
}
