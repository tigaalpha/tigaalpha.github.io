/* ── chat-starters.ts ──
   What the full-screen chat offers before the learner has typed a word. The
   chat used to open on a bare welcome bubble and an empty box, which asks a
   beginner to invent a good question; these are the questions, ready to tap.

   First, what the app really knows about THIS learner (a skill they keep
   missing, a piece they just played) written in the learner's own voice — a
   tap sends it as their message, so it has to read like something a learner
   would say, not like the app talking to them. The TIGA hub supplies these
   (tigaHub.chatStartersFor); personalAsks below is the plain read of the same
   memory, used before the hub has loaded or when it has nothing. Then everyday beginner
   questions, rotated by day so the row is not the same on every visit.
   Pure and synchronous; the only inputs are the learner's memory and the day. */
import { tr } from "./i18n";

export type ChatAsk = { key: string; icon: string; label: string; q: string; personal: boolean };
type Tri = { th: string; en: string; zh: string };

const GENERIC: Array<{ id: string; icon: string; label: Tri; q: Tri }> = [
  { id: "start", icon: "🎹",
    label: { th: "เริ่มเรียนจากศูนย์", en: "Start from zero", zh: "从零开始" },
    q: { th: "ฉันเพิ่งเริ่มเรียนเปียโน ควรเริ่มจากตรงไหนดี", en: "I'm brand new to piano — where should I start?", zh: "我刚开始学钢琴，该从哪里开始？" } },
  { id: "practice", icon: "⏱️",
    label: { th: "ซ้อมยังไงให้เก่งเร็ว", en: "Practise smarter", zh: "怎么练进步快" },
    q: { th: "ซ้อมวันละกี่นาที และซ้อมยังไงให้เก่งขึ้นเร็วที่สุด", en: "How long should I practise each day, and how do I improve fastest?", zh: "每天该练多久，怎样才能进步最快？" } },
  { id: "song", icon: "🎵",
    label: { th: "เพลงง่าย ๆ ที่เล่นได้เลย", en: "An easy song to play", zh: "一首能马上弹的简单曲子" },
    q: { th: "แนะนำเพลงง่าย ๆ ที่ฉันเล่นได้เลยหน่อย", en: "Recommend an easy song I can play right now", zh: "推荐一首我现在就能弹的简单曲子" } },
  { id: "read", icon: "🎼",
    label: { th: "เริ่มอ่านโน้ต", en: "Start reading notes", zh: "开始读谱" },
    q: { th: "อ่านโน้ตเบื้องต้นเริ่มจากตรงไหนดี", en: "Where do I start with reading sheet music?", zh: "读谱该从哪里开始？" } },
  { id: "hands", icon: "🖐️",
    label: { th: "ท่านั่งและท่ามือ", en: "Posture and hands", zh: "坐姿和手型" },
    q: { th: "ท่านั่งและท่ามือที่ถูกต้องเวลาเล่นเปียโนเป็นยังไง", en: "What is the right posture and hand shape for playing piano?", zh: "弹钢琴时正确的坐姿和手型是什么样的？" } },
  { id: "rhythm", icon: "🥁",
    label: { th: "จับจังหวะไม่ได้", en: "Keeping the beat", zh: "节奏总不稳" },
    q: { th: "ฉันจับจังหวะไม่ค่อยได้ ควรฝึกยังไง", en: "I can't keep a steady beat — how should I train it?", zh: "我总是打不准节奏，该怎么练？" } },
];

const labelOf = (x: any): string => String((x && typeof x === "object" ? (x.label || x.song || "") : x) || "").trim().slice(0, 40);

/* Asks built from the learner's real record — at most one for the skill they
   struggle with most, one for the piece they played last. */
export function personalAsks(memory: any, lang: string): ChatAsk[] {
  const out: ChatAsk[] = [];
  const struggle = labelOf(memory && memory.struggles && memory.struggles[0]);
  const recent = labelOf(memory && memory.recent && memory.recent[0]);
  const L = (th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
  if (struggle) {
    out.push({
      key: "p-struggle", icon: "🧠", personal: true,
      label: L(`ฝึก "${struggle}"`, `Practise "${struggle}"`, `练“${struggle}”`),
      q: L(`ช่วยแนะนำวิธีฝึก "${struggle}" หน่อยครับ ฉันยังพลาดเรื่องนี้อยู่`, `Can you help me practise "${struggle}"? I still keep missing it.`, `能帮我练一下“${struggle}”吗？我还是总出错。`),
    });
  }
  if (recent && recent !== struggle) {
    out.push({
      key: "p-recent", icon: "🧠", personal: true,
      label: L(`เล่น "${recent}" ให้ดีขึ้น`, `Play "${recent}" better`, `把“${recent}”弹得更好`),
      q: L(`ช่วยบอกวิธีเล่น "${recent}" ให้ดีขึ้นหน่อยครับ`, `How can I play "${recent}" better?`, `怎样才能把“${recent}”弹得更好？`),
    });
  }
  return out;
}

/* n chips: the learner's own (the caller passes them — the TIGA hub's, or
   personalAsks as the stand-in) first, then the everyday questions, starting from
   a different one each day (a stable hash of the day key — two visits on one day
   see the same row, tomorrow's row differs). */
export function chatAsks(lang: string, personal: ChatAsk[], dayKey: string, n = 4): ChatAsk[] {
  const out = (personal || []).slice(0, 2);
  let h = 0;
  for (let i = 0; i < dayKey.length; i++) h = (h * 31 + dayKey.charCodeAt(i)) | 0;
  const start = Math.abs(h) % GENERIC.length;
  for (let k = 0; out.length < n && k < GENERIC.length; k++) {
    const g = GENERIC[(start + k) % GENERIC.length];
    out.push({ key: "g-" + g.id, icon: g.icon, personal: false, label: tr(g.label, lang), q: tr(g.q, lang) });
  }
  return out;
}
