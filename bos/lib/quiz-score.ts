// Piano Level Quiz scoring — the pure logic behind the public lead-capture
// page at /quiz (the lead magnet the dashboard's lead-quiz page shares as
// /studio/quiz). Deliberately free of React/DOM imports so vitest can import
// it directly (same convention as lead-score.ts) and so the level names stay
// in ONE place shared by quiz → CRM → dashboard classification.

export type QuizLevel = "beginner" | "elementary" | "intermediate" | "advanced";

export interface QuizOption {
  label: string;
  points: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "experience",
    question: "เคยเล่นเปียโนมาก่อนไหม?",
    options: [
      { label: "ไม่เคยเลย เริ่มจากศูนย์", points: 0 },
      { label: "เคยลองเล่นบ้าง นานมาแล้ว", points: 1 },
      { label: "เคยเรียนมาแล้ว 1–2 ปี", points: 2 },
      { label: "เล่นได้หลายเพลงแล้ว", points: 3 },
    ],
  },
  {
    id: "reading",
    question: "อ่านโน้ตเพลงเป็นไหม?",
    options: [
      { label: "ไม่เป็นเลย", points: 0 },
      { label: "พออ่านได้ แต่ช้า", points: 1 },
      { label: "อ่านคล่อง", points: 2 },
    ],
  },
  {
    id: "style",
    question: "อยากเล่นสไตล์ไหนเป็นหลัก?",
    options: [
      { label: "เพลงที่ชอบ เล่นตามคลิป/ตามศิลปิน", points: 0 },
      { label: "คลาสสิกคลาสสิกตามหลักสูตร", points: 1 },
      { label: "เล่นสด อิมโพรไวส์ หรือแจ๊ส", points: 2 },
    ],
  },
  {
    id: "goal",
    question: "เป้าหมายของคุณคืออะไร?",
    options: [
      { label: "เล่นเพลงที่ชอบให้ได้สักเพลง", points: 0 },
      { label: "วางพื้นฐานให้แน่น เล่นต่อได้เอง", points: 1 },
      { label: "ยกระดับเทคนิคขึ้นเซียน", points: 2 },
      { label: "สอบ/แข่ง/ขึ้นเวทีจริงจัง", points: 3 },
    ],
  },
  {
    id: "practice",
    question: "ตอนนี้มีเปียโน/คีย์บอร์ดฝึกซ้อมไหม?",
    options: [
      { label: "ยังไม่มี กำลังจะหา", points: 0 },
      { label: "มี แต่ฝึกนานๆ ครั้ง", points: 1 },
      { label: "มี และฝึกได้เกือบทุกวัน", points: 2 },
    ],
  },
];

export interface QuizCourse {
  name: string;
  price: string;
  blurb: string;
}

// Course mapping mirrors the dashboard lead-quiz page's levelConfig — one
// source of truth for "which level → which offer" across quiz and dashboard.
export const QUIZ_LEVEL_RESULT: Record<QuizLevel, { label: string; emoji: string; course: QuizCourse }> = {
  beginner: {
    label: "ผู้เริ่มต้น (Beginner)",
    emoji: "🌱",
    course: {
      name: "Piano Mindset",
      price: "฿990",
      blurb: "คอร์สวิดีโอเริ่มจากศูนย์ เล่นเพลงที่ชอบได้ใน 30 วัน",
    },
  },
  elementary: {
    label: "ระดับต้น (Elementary)",
    emoji: "🎵",
    course: {
      name: "0 to HERO",
      price: "฿1,490",
      blurb: "คอร์สวิดีโอจากมือใหม่สู่เล่นคล่อง พร้อมเทคนิคฝึกที่ถูกวิธี",
    },
  },
  intermediate: {
    label: "ระดับกลาง (Intermediate)",
    emoji: "🎹",
    course: {
      name: "คอร์สเรียนสด Private",
      price: "฿27,000",
      blurb: "เรียนตัวต่อตัวกับครูมืออาชีพ ปรับตามเป้าหมายของคุณโดยเฉพาะ",
    },
  },
  advanced: {
    label: "ระดับสูง (Advanced)",
    emoji: "🎼",
    course: {
      name: "Private Course + Jazz",
      price: "เริ่ม ฿27,000",
      blurb: "เทคนิคขั้นสูง อิมโพรไวส์ และเล่นสด ดีไซน์หลักสูตรเฉพาะคุณ",
    },
  },
};

/** Sum the option points and map to a level. Out-of-range totals (shouldn't
 *  happen from the UI) clamp to the nearest end. */
export function scoreQuiz(totalPoints: number): QuizLevel {
  if (totalPoints <= 2) return "beginner";
  if (totalPoints <= 5) return "elementary";
  if (totalPoints <= 8) return "intermediate";
  return "advanced";
}

/** Score a full answer set (index of the chosen option per question, in
 *  QUIZ_QUESTIONS order). Missing answers count as 0 — the UI only submits
 *  complete sets, but partial sets from a resumed session still produce a
 *  sane level instead of throwing. */
export function scoreQuizAnswers(answerIndices: number[]): QuizLevel {
  let total = 0;
  QUIZ_QUESTIONS.forEach((q, i) => {
    const pick = answerIndices[i];
    if (typeof pick === "number" && pick >= 0 && pick < q.options.length) {
      total += q.options[pick]?.points ?? 0;
    }
  });
  return scoreQuiz(total);
}

/** The lead_source string the quiz stamps into CRM — matches the dashboard
 *  lead-quiz page's classifyLevel() keyword scanning ("quiz" + level), so
 *  quiz leads land in the right funnel bucket automatically. */
export function quizLeadSource(level: QuizLevel): string {
  return `quiz-${level}`;
}
