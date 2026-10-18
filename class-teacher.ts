/* class-teacher.ts — the voice and the first path of My Class (owner, 2026-10-17: "act like a teacher: update progress, say what is wrong and how to
   fix it, build discipline, encourage; and teach a brand-new learner well even with no data").
   Pure (no localStorage, no network, no React) so a script can import the real file. Everything it says is derived from the learner's own
   activity log, so nothing here can claim progress that did not happen. It never decides WHAT to practise once there is evidence — that stays
   learnerSignal()'s job (the one decision unit); this file only (a) lays out the FOUNDATION PATH a learner with no data follows, in a fixed
   teaching order built on features the app already has, and (b) words the teacher's note. The order is the owner's call as the piano teacher. */

export const WEEK_GOAL_DAYS = 4;      // a realistic habit target: four practice days a week
const DAY = 86400000;

type L3 = { th: string; en: string; zh: string };
const pick = (o: L3, lang: string) => (lang === "th" ? o.th : lang === "zh" ? o.zh : o.en);

/* ── the foundation path ──
   Each step names ONE existing destination: a feature key `handleCoachNavigate` knows, or Pathway stages (opened as a lesson).
   `done` is read from evidence only (the act log / finished Pathway stages), never from a flag the learner ticks. */
export const FOUNDATION = [
  { id: "hands", short: { th: "ท่ามือ", en: "Hands", zh: "手型" }, feature: "hand_coach", title: { th: "ท่ามือและนิ้ว", en: "Hand shape and fingers", zh: "手型与指法" },
    why: { th: "มือที่วางถูกตั้งแต่วันแรกกันนิสัยเสียที่แก้ยากทีหลัง", en: "A good hand shape from day one avoids habits that are hard to undo later.", zh: "第一天就摆对手型，可避免日后难改的坏习惯。" } },
  { id: "song", short: { th: "เพลงแรก", en: "1st song", zh: "首歌" }, feature: "play_along", title: { th: "เพลงแรกกับจังหวะ", en: "Your first song and the pulse", zh: "第一首歌与节拍" },
    why: { th: "เล่นเพลงจริงตามจังหวะตั้งแต่ต้น — ดนตรีคือการเล่นไปด้วยกัน ไม่ใช่การท่องโน้ต", en: "Play a real song to a steady pulse from the start — music is playing together, not memorising notes.", zh: "一开始就跟着稳定节拍弹真歌——音乐是一起演奏，不是背音符。" } },
  { id: "ear", short: { th: "ฝึกหู", en: "Ear", zh: "练耳" }, feature: "ear_training", title: { th: "ฝึกหู: ได้ยินแล้วรู้ว่าอะไร", en: "Ear training: hear it, name it", zh: "练耳：听到就能说出" },
    why: { th: "หูที่ฟังออกทำให้เรียนคอร์ดและเล่นตามเพลงเร็วขึ้นมาก", en: "A trained ear makes chords and playing by ear much faster to learn.", zh: "听得出来，学和弦和听音弹奏会快很多。" } },
  { id: "read", short: { th: "อ่านโน้ต", en: "Reading", zh: "识谱" }, feature: "sight_reading", title: { th: "อ่านโน้ตบนบรรทัดห้าเส้น", en: "Reading notes on the staff", zh: "五线谱识谱" },
    why: { th: "อ่านโน้ตได้คล่องคือเครื่องมือที่ใช้ตลอดชีวิต ฝึกวันละนิดดีกว่าฝึกทีเดียวนาน", en: "Fluent reading is a lifelong tool — a little each day beats one long session.", zh: "流畅识谱是终身工具——每天一点点胜过一次练很久。" } },
  { id: "scale", short: { th: "สเกล", en: "Scales", zh: "音阶" }, stages: ["scale", "interval"], title: { th: "สเกลและขั้นคู่", en: "Scales and intervals", zh: "音阶与音程" },
    why: { th: "สเกลคือแผนที่ของเพลง ขั้นคู่คือระยะที่ใช้วัดทุกอย่าง", en: "Scales are the map of a piece; intervals are the distances everything is measured in.", zh: "音阶是乐曲的地图，音程是衡量一切的距离。" } },
  { id: "triad", short: { th: "คอร์ด 3", en: "Triads", zh: "三和弦" }, stages: ["triad"], title: { th: "คอร์ดสามเสียง (Triad)", en: "Triads", zh: "三和弦" },
    why: { th: "คอร์ดสามเสียงคืออิฐก้อนแรกของเพลงป๊อป แจ๊ส และเพลงส่วนใหญ่ที่คุณรู้จัก", en: "Triads are the first building block of pop, jazz and most songs you know.", zh: "三和弦是流行、爵士和大多数你熟悉歌曲的第一块积木。" } },
  { id: "prog", short: { th: "คอร์ด 7", en: "7ths", zh: "七和弦" }, stages: ["seventh", "progression"], title: { th: "คอร์ดเจ็ดและทางคอร์ด", en: "Seventh chords and progressions", zh: "七和弦与和弦进行" },
    why: { th: "ทางคอร์ดคือหัวใจของการแต่งและเล่นแบ็คอัพ — ถึงตรงนี้คุณเล่นเพลงเองได้แล้ว", en: "Progressions are the heart of writing and accompanying — from here you can make your own music.", zh: "和弦进行是创作与伴奏的核心——到这里你就能自己做音乐了。" } },
] as const;

export type FoundationStep = { id: string; feature?: string; stages?: readonly string[]; short: L3; title: L3; why: L3; done: boolean; current: boolean };

type Entry = { t?: number; d?: string; k?: string; id?: string; ok?: number; miss?: number; sec?: number };

function stepDone(s: any, log: Entry[], pathDone: Set<string>): boolean {
  if (s.id === "hands") return log.some(e => e && e.id === "hand_coach");
  if (s.id === "song") return log.some(e => e && e.k === "game");
  if (s.id === "ear") return log.some(e => e && e.k === "ear");
  if (s.id === "read") return log.some(e => e && e.k === "read");
  return (s.stages || []).every((id: string) => pathDone.has(id));
}

export function foundationPath(log: Entry[], pathDone: Iterable<string> | Set<string>): { steps: FoundationStep[]; doneN: number; current: FoundationStep | null; finished: boolean } {
  const pd = pathDone instanceof Set ? pathDone : new Set(pathDone || []);
  const L = Array.isArray(log) ? log : [];
  const steps: FoundationStep[] = FOUNDATION.map(s => ({ id: s.id, feature: (s as any).feature, stages: (s as any).stages, short: (s as any).short, title: s.title, why: s.why, done: stepDone(s, L, pd), current: false }));
  const cur = steps.find(s => !s.done) || null;
  if (cur) cur.current = true;
  return { steps, doneN: steps.filter(s => s.done).length, current: cur, finished: !cur };
}

/* ── the week, from the log ── */
function localDay(t: number): string { const z = new Date(t); return z.getFullYear() + "-" + String(z.getMonth() + 1).padStart(2, "0") + "-" + String(z.getDate()).padStart(2, "0"); }

export function weekStats(log: Entry[], now: number = Date.now()) {
  const L = (Array.isArray(log) ? log : []).filter(e => e && typeof e.t === "number");
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) dayKeys.push(localDay(now - i * DAY));
  const inWeek = (e: Entry, from: number, to: number) => (e.t as number) > now - to * DAY && (e.t as number) <= now - from * DAY;
  const thisW = L.filter(e => inWeek(e, 0, 7)), prevW = L.filter(e => inWeek(e, 7, 14));
  const acc = (xs: Entry[]) => { let ok = 0, miss = 0; for (const e of xs) { ok += e.ok || 0; miss += e.miss || 0; } return { n: ok + miss, pct: ok + miss ? Math.round((ok / (ok + miss)) * 100) : null }; };
  const days = dayKeys.map(k => L.some(e => localDay(e.t as number) === k));
  const last = L.length ? Math.max(...L.map(e => e.t as number)) : null;
  const a = acc(thisW), b = acc(prevW);
  return {
    days,                                              // seven booleans, oldest first, today last
    daysN: days.filter(Boolean).length,
    minutes: Math.round(thisW.reduce((s, e) => s + (e.sec || 0), 0) / 60),
    practicedToday: days[6],
    sinceDays: last == null ? null : Math.floor((localDay(now) === localDay(last) ? 0 : (now - last) / DAY)),
    accNow: a.n >= 10 ? a.pct : null,                  // fewer than ten graded attempts is too thin to quote
    accPrev: b.n >= 10 ? b.pct : null,
    ever: L.length,
  };
}

/* ── the teacher's note: greeting, progress, discipline, encouragement ──
   `problem` is what learnerSignal/the diagnosis already found (a label), or null; the fix sentence comes from the caller too — this file
   only frames them, it never invents a weakness. */
export function teacherNote(input: { log: Entry[]; streak?: number; now?: number; track: ReturnType<typeof foundationPath>; allDone?: boolean }, lang: string) {
  const w = weekStats(input.log, input.now);
  const streak = input.streak || 0;
  const left = Math.max(0, WEEK_GOAL_DAYS - w.daysN);
  let tone: "new" | "comeback" | "done" | "streak" | "steady" = "steady";
  let hello: L3, line: L3;
  if (w.ever === 0) {
    tone = "new";
    hello = { th: "ยินดีต้อนรับสู่คลาสครับ", en: "Welcome to class.", zh: "欢迎来到课堂。" };
    line = { th: "ผมจะพาคุณเรียนทีละขั้น วันนี้แค่ขั้นแรกก็พอ ใช้เวลาไม่กี่นาที", en: "I'll take you one step at a time. Today, just the first step is enough — a few minutes.", zh: "我会带你一步一步来。今天只做第一步就够了，几分钟即可。" };
  } else if (input.allDone || w.practicedToday) {
    tone = "done";
    hello = { th: "วันนี้คุณซ้อมแล้ว เยี่ยมมาก", en: "You practised today — well done.", zh: "今天你已经练习了，很棒。" };
    line = left > 0
      ? { th: `เป้าหมายสัปดาห์นี้ ${WEEK_GOAL_DAYS} วัน — ซ้อมแล้ว ${w.daysN} วัน เหลืออีก ${left} วัน`, en: `This week's goal is ${WEEK_GOAL_DAYS} days — ${w.daysN} done, ${left} to go.`, zh: `本周目标 ${WEEK_GOAL_DAYS} 天——已练 ${w.daysN} 天，还差 ${left} 天。` }
      : { th: `ครบเป้าหมาย ${WEEK_GOAL_DAYS} วันของสัปดาห์นี้แล้ว นี่แหละวินัยที่ทำให้เก่งขึ้น`, en: `You've hit this week's ${WEEK_GOAL_DAYS}-day goal. This is the discipline that makes people good.`, zh: `本周 ${WEEK_GOAL_DAYS} 天目标已达成。这就是让人进步的自律。` };
  } else if (w.sinceDays != null && w.sinceDays >= 3) {
    tone = "comeback";
    hello = { th: "ยินดีที่กลับมาครับ", en: "Good to see you back.", zh: "欢迎回来。" };
    line = { th: `ห่างไป ${w.sinceDays} วัน ไม่เป็นไร เริ่มใหม่แค่ 10 นาทีก็พอ ไม่ต้องชดเชย`, en: `It's been ${w.sinceDays} days — that's fine. Ten minutes is enough to restart; no need to make up for it.`, zh: `已经 ${w.sinceDays} 天没练了——没关系。重新开始 10 分钟就够，不用补。` };
  } else if (streak >= 3) {
    tone = "streak";
    hello = { th: `ซ้อมต่อเนื่อง ${streak} วันแล้ว`, en: `${streak} days in a row.`, zh: `已连续练习 ${streak} 天。` };
    line = { th: "ความสม่ำเสมอสำคัญกว่าซ้อมหนักครั้งเดียว วันนี้ทำต่ออีกนิดเพื่อรักษาสถิติ", en: "Steady beats intense. A little today keeps the streak alive.", zh: "持之以恒胜过突击。今天再练一点来保持连续记录。" };
  } else {
    hello = { th: "ไปต่อกันครับ", en: "Let's keep going.", zh: "我们继续。" };
    line = { th: `สัปดาห์นี้ซ้อมแล้ว ${w.daysN} จาก ${WEEK_GOAL_DAYS} วันที่ตั้งเป้าไว้`, en: `This week: ${w.daysN} of your ${WEEK_GOAL_DAYS}-day goal.`, zh: `本周：目标 ${WEEK_GOAL_DAYS} 天，已练 ${w.daysN} 天。` };
  }
  // an honest trend sentence only when both weeks have enough graded attempts
  let trend: string | null = null;
  if (w.accNow != null && w.accPrev != null) {
    const d = w.accNow - w.accPrev;
    if (d >= 3) trend = pick({ th: `ความแม่นยำสัปดาห์นี้ ${w.accNow}% สูงขึ้นจาก ${w.accPrev}% — การซ้อมเริ่มเห็นผลแล้ว`, en: `Accuracy this week is ${w.accNow}%, up from ${w.accPrev}% — the practice is showing.`, zh: `本周准确率 ${w.accNow}%，高于上周的 ${w.accPrev}%——练习开始见效。` }, lang);
    else if (d <= -3) trend = pick({ th: `ความแม่นยำสัปดาห์นี้ ${w.accNow}% ลดจาก ${w.accPrev}% ไม่ต้องกังวล ลองช้าลงและฝึกจุดที่พลาดซ้ำ`, en: `Accuracy is ${w.accNow}% this week, down from ${w.accPrev}%. No worry — slow down and drill the spots you keep missing.`, zh: `本周准确率 ${w.accNow}%，比上周的 ${w.accPrev}% 低。别担心——放慢速度，针对反复出错的地方练。` }, lang);
    else trend = pick({ th: `ความแม่นยำทรงตัวที่ ${w.accNow}% ลองเพิ่มความยากอีกนิด`, en: `Accuracy is holding at ${w.accNow}%. Try something a little harder.`, zh: `准确率稳定在 ${w.accNow}%。可以试试稍难一点的。` }, lang);
  }
  const tail = input.track.finished ? null : pick({ th: `เส้นทางพื้นฐาน ${input.track.doneN}/${input.track.steps.length} ขั้น`, en: `Foundation path: ${input.track.doneN} of ${input.track.steps.length} steps`, zh: `基础路径：${input.track.doneN}/${input.track.steps.length} 步` }, lang);
  return { tone, hello: pick(hello, lang), line: pick(line, lang), trend, tail, week: w };
}

/** The daily foundation patch (owner, 2026-10-18): ONE foundation step for today that changes every day with the learner's level. The pool is
    every step they have reached (the ones done, for review, plus the one they are on); the current step comes up every other day, the rest take
    turns, so the patch moves daily but never asks for something beyond their level. */
export function dailyPatch(track: ReturnType<typeof foundationPath>, daySeed: number): FoundationStep | null {
  const reached = track.steps.filter(x => x.done || x.current);
  if (!reached.length) return null;
  const cur = track.current, rest = reached.filter(x => !cur || x.id !== cur.id);
  if (cur && (daySeed % 2 === 0 || !rest.length)) return cur;
  return rest.length ? rest[Math.floor(daySeed / 2) % rest.length] : cur;
}
