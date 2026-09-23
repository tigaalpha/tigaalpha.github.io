import { useState } from "react";

/* ── PianoLevelQuiz.tsx ──
   Interactive lead magnet: "What's your piano level?"
   Visitors answer 8 music-related questions → get personalized result →
   must enter name/phone/email to see result → lead captured into CRM.
   
   This is the #6 highest-value feature because:
   - Interactive quizzes have 2-3x higher conversion than static forms
   - The result feels personalized ("your level") → emotional investment
   - Must enter contact to see result → guaranteed lead capture
   - Shareable result → organic viral growth
*/

type QuizAnswer = { q: number; a: number };
type QuizResult = {
  level: string;
  title: string;
  description: string;
  recommended: string;
  emoji: string;
  color: string;
};

const QUESTIONS_TH = [
  {
    q: "คุณเคยเล่นเปียโนมาก่อนหรือไม่?",
    options: ["ไม่เคยเลย", "เคยลองเล่นบ้าง", "เรียนมาแล้ว 1-2 ปี", "เรียนมา 3+ ปี"],
  },
  {
    q: "คุณสามารถอ่านโน้ตดนตรี (Sheet Music) ได้หรือไม่?",
    options: ["ไม่รู้จักเลย", "รู้จักบ้างแต่อ่านไม่ออก", "อ่านได้ช้าๆ", "อ่านได้คล่อง"],
  },
  {
    q: "คุณสามารถเล่น C Major scale ได้หรือไม่?",
    options: ["ไม่รู้ว่าคืออะไร", "เคยได้ยินแต่เล่นไม่ได้", "เล่นได้แต่ไม่ถนัด", "เล่นได้คล่อง"],
  },
  {
    q: "คุณมีเวลาฝึกซ้อมกี่วันต่อสัปดาห์?",
    options: ["น้อยกว่า 1 วัน", "1-2 วัน", "3-4 วัน", "ทุกวัน"],
  },
  {
    q: "เป้าหมายการเรียนของคุณคืออะไร?",
    options: ["เล่นเพลงที่ชอบ", "สอบเกรด/ABRSM", "เล่นเป็นอาชีพ", "ฝึกสมาธิ/ผ่อนคลาย"],
  },
  {
    q: "คุณมีเปียโน/คีย์บอร์ดที่บ้านหรือไม่?",
    options: ["ไม่มี", "มีคีย์บอร์ด", "มีเปียโนไฟฟ้า", "มีเปียโนอคูสติก"],
  },
  {
    q: "คุณอายุเท่าไหร่?",
    options: ["ต่ำกว่า 12 ปี", "12-18 ปี", "19-40 ปี", "มากกว่า 40 ปี"],
  },
  {
    q: "เคยลองเรียนออนไลน์มาก่อนหรือไม่?",
    options: ["ไม่เคย", "เคยลองแต่ไม่ต่อเนื่อง", "เรียนมาสักพักแล้วหยุด", "กำลังเรียนอยู่"],
  },
];

const QUESTIONS_EN = [
  {
    q: "Have you played piano before?",
    options: ["Never", "Tried a few times", "1-2 years of lessons", "3+ years of lessons"],
  },
  {
    q: "Can you read sheet music?",
    options: ["Don't know what it is", "Recognize it but can't read", "Can read slowly", "Can read fluently"],
  },
  {
    q: "Can you play a C Major scale?",
    options: ["Don't know what that is", "Heard of it but can't play", "Can play but not smooth", "Play it fluently"],
  },
  {
    q: "How many days per week can you practice?",
    options: ["Less than 1 day", "1-2 days", "3-4 days", "Every day"],
  },
  {
    q: "What's your learning goal?",
    options: ["Play favorite songs", "Take exams/ABRSM", "Professional career", "Relaxation/mindfulness"],
  },
  {
    q: "Do you have a piano at home?",
    options: ["No instrument", "Keyboard", "Digital piano", "Acoustic piano"],
  },
  {
    q: "What's your age?",
    options: ["Under 12", "12-18", "19-40", "Over 40"],
  },
  {
    q: "Tried online piano lessons before?",
    options: ["Never", "Tried but didn't continue", "Studied then stopped", "Currently learning"],
  },
];

function calculateResult(answers: QuizAnswer[], lang: string): QuizResult {
  const totalScore = answers.reduce((sum, a) => sum + a.a, 0);
  const maxScore = answers.length * 3; // max 3 per question
  
  const results = {
    th: [
      {
        range: [0, 8],
        level: "_BEGINNER",
        title: "🌱 มือใหม่หัดเล่น",
        description: "คุณอยู่จุดเริ่มต้นที่ดีมาก! ทุกคนต้องเริ่มจากจุดนี้ ด้วย AI ครูสอนส่วนตัว คุณจะก้าวหน้าได้เร็วกว่าเรียนเองหลายเท่า",
        recommended: "แนะนำ: คอร์สเบื้องต้น 40 ชั่วโมง (฿27,000) — เริ่มจากศูนย์จนเล่นเพลงได้",
        emoji: "🌱",
        color: "#4ade80",
      },
      {
        range: [9, 16],
        level: "ELEMENTARY",
        title: "🌿 ผู้เริ่มต้น",
        description: "คุณมีพื้นฐานมาบ้างแล้ว แต่ยังต้องการโครงสร้างที่ชัดเจน คอร์สของเราจะช่วยให้คุณอ่านโน้ตได้คล่องและเล่นเพลงง่ายๆ ได้",
        recommended: "แนะนำ: คอร์สต่อเนื่อง 40 ชั่วโมง (฿27,000) — สร้างพื้นฐานที่แข็งแรง",
        emoji: "🌿",
        color: "#22d3ee",
      },
      {
        range: [17, 24],
        level: "INTERMEDIATE",
        title: "🌳 ระดับกลาง",
        description: "คุณเล่นได้พอสมควรแล้ว! ถึงเวลาที่จะยกระดับ AI ครูจะช่วยคุณพัฒนาเทคนิคและสไตล์เฉพาะตัว",
        recommended: "แนะนำ: คอร์สขั้นสูง 40 ชั่วโมง (฿27,000) — เทคนิคและสไตล์",
        emoji: "🌳",
        color: "#a78bfa",
      },
      {
        range: [25, 32],
        level: "ADVANCED",
        title: "🎄 ขั้นสูง",
        description: "คุณมีทักษะดีมาก! AI ครูจะช่วยคุณเจาะลึกเทคนิคขั้นสูง การแสดง และการ improvise",
        recommended: "แนะนำ: คอร์สเฉพาะทาง — ติดต่อเราเพื่อวางแผนการเรียน",
        emoji: "🎄",
        color: "#f472b6",
      },
    ],
    en: [
      {
        range: [0, 8],
        level: "BEGINNER",
        title: "🌱 Complete Beginner",
        description: "You're at a great starting point! Everyone begins here. With an AI personal tutor, you'll progress faster than self-learning.",
        recommended: "Recommended: Foundation Course 40hrs (฿27,000) — from zero to playing songs",
        emoji: "🌱",
        color: "#4ade80",
      },
      {
        range: [9, 16],
        level: "ELEMENTARY",
        title: "🌿 Getting Started",
        description: "You have some basics. Our course gives you the structure to read music fluently and play easy songs.",
        recommended: "Recommended: Continuing Course 40hrs (฿27,000) — build solid foundations",
        emoji: "🌿",
        color: "#22d3ee",
      },
      {
        range: [17, 24],
        level: "INTERMEDIATE",
        title: "🌳 Intermediate",
        description: "You can play well already! Time to level up. The AI tutor helps develop your technique and personal style.",
        recommended: "Recommended: Advanced Course 40hrs (฿27,000) — technique and style",
        emoji: "🌳",
        color: "#a78bfa",
      },
      {
        range: [25, 32],
        level: "ADVANCED",
        title: "🎄 Advanced",
        description: "Excellent skills! The AI tutor helps you dive into advanced techniques, performance, and improvisation.",
        recommended: "Recommended: Specialized Course — contact us to plan",
        emoji: "🎄",
        color: "#f472b6",
      },
    ],
  };

  const levels = results[lang] || results.th;
  const result = levels.find((r) => totalScore >= r.range[0] && totalScore <= r.range[1]) || levels[0];
  return result;
}

export function PianoLevelQuiz({ lang = "th" }: { lang?: string }) {
  const [step, setStep] = useState<"quiz" | "lead" | "result">("quiz");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [result, setResult] = useState<QuizResult | null>(null);

  const questions = lang === "en" ? QUESTIONS_EN : QUESTIONS_TH;
  const t = {
    th: {
      title: "ทดสอบระดับเปียโนของคุณ",
      sub: "ตอบ 8 คำถามสั้นๆ เราจะวิเคราะห์ระดับและแนะนำคอร์สที่เหมาะกับคุณ",
      progress: "คำถาม",
      next: "ถัดไป",
      prev: "ย้อนกลับ",
      seeResult: "ดูผลลัพธ์",
      leadTitle: "เกือบถึงแล้ว!",
      leadSub: "กรอกข้อมูลเล็กน้อยเพื่อดูผลลัพธ์",
      nameLabel: "ชื่อ",
      phoneLabel: "เบอร์โทร",
      emailLabel: "อีเมล (ไม่บังคับ)",
      submitBtn: "ดูผลลัพธ์ของฉัน",
      retry: "ทำแบบทดสอบอีกครั้ง",
      shareBtn: "แชร์ผลลัพธ์",
      lineBtn: "จองเรียนเลย",
      tryAgain: "ทำใหม่",
    },
    en: {
      title: "Test Your Piano Level",
      sub: "Answer 8 quick questions — we'll analyze your level and recommend the perfect course",
      progress: "Question",
      next: "Next",
      prev: "Back",
      seeResult: "See Result",
      leadTitle: "Almost There!",
      leadSub: "Enter a few details to see your personalized result",
      nameLabel: "Name",
      phoneLabel: "Phone",
      emailLabel: "Email (optional)",
      submitBtn: "Show My Result",
      retry: "Retake Quiz",
      shareBtn: "Share Result",
      lineBtn: "Book Now",
      tryAgain: "Try Again",
    },
  };

  const c = t[lang] || t.th;

  function selectAnswer(a: number) {
    const newAnswers = [...answers.filter((x) => x.q !== currentQ), { q: currentQ, a }];
    setAnswers(newAnswers);
    if (currentQ < questions.length - 1) {
      setTimeout(() => setCurrentQ(currentQ + 1), 300);
    }
  }

  function showLeadForm() {
    if (answers.length < questions.length) return;
    setStep("lead");
  }

  function showResult() {
    if (!leadName.trim() || !leadPhone.trim()) return;
    const r = calculateResult(answers, lang);
    setResult(r);

    // Save lead
    const leadData = {
      name: leadName, phone: leadPhone, email: leadEmail,
      quizResult: r.level, quizScore: answers.reduce((s, a) => s + a.a, 0),
      submittedAt: new Date().toISOString(), source: "piano_level_quiz",
    };
    const existing = JSON.parse(localStorage.getItem("tiga_leads") || "[]");
    existing.push(leadData);
    localStorage.setItem("tiga_leads", JSON.stringify(existing));

    // Try Supabase
    try {
      import("./supabase-client").then(({ sb }) => {
        sb.from("customers").upsert({
          full_name: leadName, phone: leadPhone, email: leadEmail || null,
          lead_source: "piano_level_quiz",
          notes: `Quiz result: ${r.level}, Score: ${answers.reduce((s, a) => s + a.a, 0)}`,
          sales_status: "new_lead",
        }, { onConflict: "phone" });
      });
    } catch (e) {}

    setStep("result");
  }

  // Quiz step
  if (step === "quiz") {
    const q = questions[currentQ];
    const progress = ((currentQ + 1) / questions.length) * 100;
    const answered = answers.find((a) => a.q === currentQ);

    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        color: "#fff", padding: 20,
      }}>
        <div style={{ maxWidth: 520, width: "100%" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎹</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{c.title}</h1>
            <p style={{ fontSize: 14, opacity: 0.7 }}>{c.sub}</p>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.6, marginBottom: 6 }}>
              <span>{c.progress} {currentQ + 1}/{questions.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)" }}>
              <div style={{ height: "100%", borderRadius: 2, background: "#d97757", width: `${progress}%`, transition: "width 0.3s" }} />
            </div>
          </div>

          {/* Question */}
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, lineHeight: 1.4 }}>
            {q.q}
          </h2>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => selectAnswer(i)}
                style={{
                  padding: "14px 18px", borderRadius: 12,
                  border: answered?.a === i ? "2px solid #d97757" : "1px solid rgba(255,255,255,0.15)",
                  background: answered?.a === i ? "rgba(217,119,87,0.15)" : "rgba(255,255,255,0.03)",
                  color: "#fff", fontSize: 16, textAlign: "left", cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button
              onClick={() => currentQ > 0 && setCurrentQ(currentQ - 1)}
              disabled={currentQ === 0}
              style={{
                padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent", color: "#fff", fontSize: 14, cursor: "pointer",
                opacity: currentQ === 0 ? 0.3 : 1,
              }}
            >
              ← {c.prev}
            </button>
            {currentQ === questions.length - 1 ? (
              <button
                onClick={showLeadForm}
                disabled={answers.length < questions.length}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: answers.length < questions.length ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #d97757, #c25e3f)",
                  color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
                  opacity: answers.length < questions.length ? 0.5 : 1,
                }}
              >
                {c.seeResult} →
              </button>
            ) : (
              <button
                onClick={() => answered && setCurrentQ(currentQ + 1)}
                disabled={!answered}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: !answered ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #d97757, #c25e3f)",
                  color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
                  opacity: !answered ? 0.5 : 1,
                }}
              >
                {c.next} →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Lead capture step
  if (step === "lead") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        color: "#fff", padding: 20,
      }}>
        <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{c.leadTitle}</h2>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 28 }}>{c.leadSub}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              placeholder={c.nameLabel}
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              style={{
                padding: "14px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 16, outline: "none",
              }}
            />
            <input
              placeholder={c.phoneLabel}
              value={leadPhone}
              onChange={(e) => setLeadPhone(e.target.value)}
              inputMode="tel"
              style={{
                padding: "14px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 16, outline: "none",
              }}
            />
            <input
              placeholder={c.emailLabel}
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              inputMode="email"
              style={{
                padding: "14px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 16, outline: "none",
              }}
            />
          </div>

          <button
            onClick={showResult}
            disabled={!leadName.trim() || !leadPhone.trim()}
            style={{
              width: "100%", marginTop: 20, padding: "14px 0", borderRadius: 12, border: "none",
              background: (!leadName.trim() || !leadPhone.trim())
                ? "rgba(255,255,255,0.1)"
                : "linear-gradient(135deg, #d97757, #c25e3f)",
              color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer",
              opacity: (!leadName.trim() || !leadPhone.trim()) ? 0.5 : 1,
            }}
          >
            {c.submitBtn}
          </button>
        </div>
      </div>
    );
  }

  // Result step
  if (result) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        color: "#fff", padding: 20,
      }}>
        <div style={{ maxWidth: 500, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>{result.emoji}</div>
          <div style={{
            display: "inline-block", padding: "6px 16px", borderRadius: 20,
            background: `${result.color}22`, color: result.color,
            fontSize: 14, fontWeight: 700, marginBottom: 16, letterSpacing: 2,
          }}>
            {result.level}
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>{result.title}</h2>
          <p style={{ fontSize: 16, opacity: 0.85, lineHeight: 1.6, marginBottom: 24 }}>{result.description}</p>
          
          <div style={{
            padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.05)",
            border: `1px solid ${result.color}33`, marginBottom: 28,
          }}>
            <p style={{ fontSize: 15, lineHeight: 1.5 }}>{result.recommended}</p>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => window.open("https://line.me/R/ti/p/@tigastudio", "_blank")}
              style={{
                padding: "14px 28px", borderRadius: 12, border: "none",
                background: "#06C755", color: "#fff", fontSize: 16, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              💬 {c.lineBtn}
            </button>
            <button
              onClick={() => { setStep("quiz"); setCurrentQ(0); setAnswers([]); setResult(null); }}
              style={{
                padding: "14px 28px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent", color: "#fff", fontSize: 16, cursor: "pointer",
              }}
            >
              🔄 {c.tryAgain}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
