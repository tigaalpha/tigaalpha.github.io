/* ── tigamodel/roadmap-100.js ──
   The owner's 100-item development plan for TIGA Piano Model, as structured
   data (mirrors docs/02-roadmap-100.md — that doc stays the narrative source;
   this file is what the Model Lab renders and what smoke tests assert on).

   Selection principle (owner directive 2026-09-18): everything a world-class
   HUMAN piano teacher can do, this model must eventually do — each item is
   one capability gap between tigamodel today and that bar.

   status: "done" = shipped and wired into the app · "partial" = a real
   module exists but covers a fraction of the target · "todo" = not started.
   stars: 3 = do first (fastest path to a smarter model) · 2 = next round ·
   1 = once the foundation is stable. The 🔒 outcome-dataset item stays gated
   on owner-approved SQL migration per repo rule. ── */

export const ROADMAP_STATUS = {
  done: { th: "เสร็จแล้ว", en: "done", zh: "完成", color: "var(--ok, #3f9d63)" },
  partial: { th: "บางส่วน", en: "partial", zh: "部分", color: "var(--warn, #b8860b)" },
  todo: { th: "รอทำ", en: "todo", zh: "待办", color: "var(--muted)" },
};

export const ROADMAP_GROUPS = [
  {
    id: "A", letter: "ก", icon: "🎼", th: "ความรู้ดนตรี (Knowledge Base)", en: "Music knowledge",
    items: [
      { n: 1, th: "โหมด 7 โหมด + การใช้ในเพลงจริง", en: "7 modes + real usage", stars: 3, status: "todo" },
      { n: 2, th: "คอร์ดขั้นสูง 9th/11th/13th, sus, slash", en: "Advanced chords", stars: 3, status: "todo" },
      { n: 3, th: "การจัดคอร์ด (voicing): open/close/drop-2/shell", en: "Voicing", stars: 3, status: "todo" },
      { n: 4, th: "Jazz: ii-V-I ทุกคีย์, tritone sub, bebop scales", en: "Jazz theory", stars: 3, status: "todo" },
      { n: 5, th: "Blues form 12/8-bar + minor blues + licks", en: "Blues forms", stars: 2, status: "todo" },
      { n: 6, th: "Harmonic function + cadence ทุกชนิด", en: "Harmonic function", stars: 2, status: "todo" },
      { n: 7, th: "Modulation ทุกเทคนิค", en: "Modulation techniques", stars: 2, status: "todo" },
      { n: 8, th: "Counterpoint พื้นฐาน (Fux 1-2)", en: "Counterpoint basics", stars: 1, status: "todo" },
      { n: 9, th: "Form analysis: sonata/rondo/binary/ternary", en: "Form analysis", stars: 2, status: "todo" },
      { n: 10, th: "Harmonic rhythm + reharmonization", en: "Reharmonization", stars: 2, status: "todo" },
      { n: 11, th: "Figured bass + Roman numerals ครบ", en: "Figured bass / RN", stars: 1, status: "todo" },
      { n: 12, th: "สเกลพิเศษ: whole-tone/octatonic/minors", en: "Exotic scales", stars: 2, status: "todo" },
      { n: 13, th: "Chord-tone vs scale approach ต่อคอร์ด", en: "Improv roadmap", stars: 2, status: "todo" },
      { n: 14, th: "Rhythmic vocabulary: syncopation/polyrhythm", en: "Rhythmic vocab", stars: 2, status: "todo" },
      { n: 15, th: "ศัพท์ดนตรี 3 ภาษา ครบชุดสอบเกรด", en: "Grade exam terms", stars: 3, status: "todo" },
      { n: 16, th: "Ornamentation วิธีเล่นยุคต่อยุค", en: "Ornamentation", stars: 2, status: "todo" },
      { n: 17, th: "Pedaling theory ทุกแบบ", en: "Pedaling theory", stars: 2, status: "todo" },
      { n: 18, th: "เกรด 1-8 (Trinity/ABRSM) เทียบ Pathway", en: "Grade syllabus map", stars: 3, status: "todo" },
      { n: 19, th: "Sight-reading pedagogy", en: "Sight-reading pedagogy", stars: 2, status: "todo" },
      { n: 20, th: "ประวัติดนตรี 6 ยุค + สไตล์เล่นต่างกัน", en: "6 eras + style", stars: 2, status: "todo" },
    ],
  },
  {
    id: "B", letter: "ข", icon: "🖐️", th: "คราฟต์การเล่น (Piano Craft)", en: "Piano craft",
    items: [
      { n: 21, th: "ฟิงเกอร์ริ่งสเกลทุกคีย์ สองมือ + เหตุผล", en: "Scale fingering all keys", stars: 3, status: "todo" },
      { n: 22, th: "ฟิงเกอร์ริ่งอาร์เปจโจ้ + คอร์ดทุกตำแหน่ง", en: "Arpeggio/chord fingering", stars: 3, status: "todo" },
      { n: 23, th: "Hanon/Czerny ลำดับ 1-60 + จุดประสงค์", en: "Technique canon", stars: 2, status: "todo" },
      { n: 24, th: "Warm-up routines 5/10/15 นาทีตามระดับ", en: "Warm-up routines", stars: 3, status: "todo" },
      { n: 25, th: "Technique recipes: staccato/legato/portato", en: "Touch recipes", stars: 2, status: "todo" },
      { n: 26, th: "Octaves/chords technique กันบาดเจ็บ", en: "Safe octaves", stars: 1, status: "todo" },
      { n: 27, th: "Jump/leap accuracy drills 5 ระดับ", en: "Leap drills", stars: 2, status: "todo" },
      { n: 28, th: "Trills practice system", en: "Trill system", stars: 1, status: "todo" },
      { n: 29, th: "Hand independence roadmap 20 ขั้น", en: "Independence roadmap", stars: 2, status: "todo" },
      { n: 30, th: "Polyrhythm trainer logic 2:3, 3:4", en: "Polyrhythm logic", stars: 1, status: "todo" },
      { n: 31, th: "Voicing มือเดียว: melody ดังกว่า harmony", en: "Single-hand voicing", stars: 1, status: "todo" },
      { n: 32, th: "Speed development: chunking/tempo ladder", en: "Speed building", stars: 2, status: "todo" },
      { n: 33, th: "Memorization systems: 4-type memory", en: "Memorization", stars: 2, status: "todo" },
      { n: 34, th: "Sight-reading drills 30 ขั้น", en: "Reading drills", stars: 2, status: "todo" },
      { n: 35, th: "Tone production: arm weight/cantabile", en: "Tone production", stars: 2, status: "todo" },
    ],
  },
  {
    id: "C", letter: "ค", icon: "🧑‍🏫", th: "คราฟต์ครู (Teacher Craft)", en: "Teacher craft",
    items: [
      { n: 36, th: "Error taxonomy 50 แบบ + วิธีแก้ทีละแบบ", en: "Error taxonomy", stars: 3, status: "todo" },
      { n: 37, th: "คลังประโยคครู 200 ประโยค", en: "Teacher phrase bank", stars: 3, status: "todo" },
      { n: 38, th: "Analogies bank 60 แบบ", en: "Analogy bank", stars: 2, status: "todo" },
      { n: 39, th: "Metaphor per culture ไทย/จีน/อังกฤษ", en: "Cultural metaphors", stars: 2, status: "todo" },
      { n: 40, th: "สอนเด็ก 3-6 ปี: attention + เกม 30 เกม", en: "Teaching ages 3-6", stars: 3, status: "todo" },
      { n: 41, th: "สอนผู้สูงวัย", en: "Teaching seniors", stars: 2, status: "todo" },
      { n: 42, th: "Adult beginners: เพลงที่ชอบเร็วที่สุด", en: "Adult beginners", stars: 3, status: "todo" },
      { n: 43, th: "Special needs: ADHD/autism patterns", en: "Special needs", stars: 1, status: "todo" },
      { n: 44, th: "Growth-mindset scripts 12 สถานการณ์", en: "Mindset scripts", stars: 3, status: "todo" },
      { n: 45, th: "Lesson arc library 10 โครงคลาส", en: "Lesson arcs", stars: 2, status: "todo" },
      { n: 46, th: "Mastery criteria ต่อทักษะ", en: "Mastery criteria", stars: 3, status: "done" },
      { n: 47, th: "Deliberate practice: กฎ 3 ครั้งสมบูรณ์", en: "Deliberate practice", stars: 3, status: "todo" },
      { n: 48, th: "Practice-slow system: tempo 80%→100%", en: "Tempo ladder auto", stars: 2, status: "todo" },
      { n: 49, th: "การบ้านที่ทำได้จริงใน 15 นาที", en: "Real homework", stars: 2, status: "todo" },
      { n: 50, th: "Re-ignition playbooks 10 แบบ", en: "Motivation playbooks", stars: 2, status: "todo" },
    ],
  },
  {
    id: "D", letter: "ง", icon: "🧠", th: "วิชาการเรียนรู้ (Learning Science)", en: "Learning science",
    items: [
      { n: 51, th: "Spaced repetition ปับ interval จากผลจริง", en: "Adaptive SRS", stars: 3, status: "partial" },
      { n: 52, th: "Interleaving: กฎตัดสินใจบล็อก/ผสม", en: "Interleaving rules", stars: 2, status: "todo" },
      { n: 53, th: "Desirable difficulties ต่อ persona", en: "Good struggles", stars: 1, status: "todo" },
      { n: 54, th: "Flow theory: ความยาก ±10%", en: "Flow targeting", stars: 3, status: "todo" },
      { n: 55, th: "Cognitive load: chunking ข้อความ AI", en: "Load-aware messages", stars: 3, status: "todo" },
      { n: 56, th: "SDT: autonomy/competence/relatedness", en: "Motivation (SDT)", stars: 2, status: "todo" },
      { n: 57, th: "Habit loops: trigger ต่อ persona", en: "Habit triggers", stars: 2, status: "todo" },
      { n: 58, th: "Regression handling: พูดยังไง ซ้อมยังไง", en: "Regression handling", stars: 3, status: "todo" },
      { n: 59, th: "Performance anxiety: 5 เทคนิค + ซ้อมจำลอง", en: "Stage-fright toolkit", stars: 2, status: "todo" },
      { n: 60, th: "errorless → errorful ตารางเวลา", en: "Error schedule", stars: 1, status: "todo" },
    ],
  },
  {
    id: "E", letter: "จ", icon: "👨‍🎓", th: "โมเดลนักเรียน (Student Model)", en: "Student model",
    items: [
      { n: 61, th: "รวม tg_memory+progress+history เป็น graph", en: "Unified learner graph", stars: 3, status: "partial" },
      { n: 62, th: "Skill graph 80 โหนด + prerequisite edges", en: "Skill graph", stars: 3, status: "done" },
      { n: 63, th: "ตรวจความเหนื่อย/สมาธิจาก pattern การเล่น", en: "Fatigue/focus signal", stars: 2, status: "todo" },
      { n: 64, th: "Emotion estimate (probability+evidence)", en: "Emotion estimate", stars: 2, status: "todo" },
      { n: 65, th: "Persona detection ปรับโทนอัตโนมัติ", en: "Persona detection", stars: 3, status: "done" },
      { n: 66, th: "Goal tree + drift tracking", en: "Goal tree", stars: 2, status: "todo" },
      { n: 67, th: "Long-term memory เรื่องส่วนตัวผู้เรียน", en: "Long-term memory", stars: 2, status: "partial" },
      { n: 68, th: "Confusion detector: สรุป 'ยังงงอะไร'", en: "Confusion detector", stars: 3, status: "todo" },
      { n: 69, th: "Streak intelligence: พัก vs ผลัก", en: "Burnout guard", stars: 2, status: "todo" },
      { n: 70, th: "Confidence calibration ต่อคำชม", en: "Calibrated praise", stars: 1, status: "todo" },
    ],
  },
  {
    id: "F", letter: "ฉ", icon: "🔁", th: "วงจรสอน + นโยบาย (Teaching Loop/Policy)", en: "Teaching loop & policy",
    items: [
      { n: 71, th: "ต่อ teaching-loop เข้า use-practice-mode จริง", en: "Loop wired to practice", stars: 3, status: "done" },
      { n: 72, th: "Policy table ขยาย 50 กติกา", en: "50-rule policy", stars: 3, status: "partial" },
      { n: 73, th: "Hint ladder 4 ชั้น", en: "Hint ladder", stars: 3, status: "done" },
      { n: 74, th: "Session state machine warmup→recap", en: "Session machine", stars: 2, status: "todo" },
      { n: 75, th: "Adaptive difficulty จาก skill graph", en: "Adaptive difficulty", stars: 3, status: "partial" },
      { n: 76, th: "Micro-lesson generator 90 วินาที", en: "Micro-lessons", stars: 2, status: "todo" },
      { n: 77, th: "Demonstration planner", en: "When to demonstrate", stars: 2, status: "todo" },
      { n: 78, th: "Recap generator 3 ข้อ + การบ้าน", en: "Recap generator", stars: 3, status: "done" },
      { n: 79, th: "Safety rules: เทคนิคตามวัย, ปวด→หยุด", en: "Safety expansion", stars: 2, status: "todo" },
      { n: 80, th: "Multilingual tone pack ไทย-อังกฤษ-จีน", en: "Tone pack 3 langs", stars: 3, status: "todo" },
    ],
  },
  {
    id: "G", letter: "ช", icon: "📊", th: "การประเมินผล (Evaluation)", en: "Evaluation",
    items: [
      { n: 81, th: "Eval cases 30→120 เคส", en: "120 eval cases", stars: 3, status: "done" },
      { n: 82, th: "Golden answers โดยครูจริง 20 ข้อ", en: "Golden answers", stars: 3, status: "done" },
      { n: 83, th: "Auto-grader ทฤษฎีอัตโนมัติ", en: "Theory auto-grader", stars: 3, status: "done" },
      { n: 84, th: "A/B สองโมเดลดู diff ข้างกัน", en: "Model A/B diff", stars: 2, status: "todo" },
      { n: 85, th: "Regression alarm ก่อนเปิดใช้", en: "Regression alarm", stars: 3, status: "done" },
      { n: 86, th: "Rubric คุณภาพการสอน 6 มิติ", en: "6-dim rubric", stars: 3, status: "done" },
      { n: 87, th: "LLM-as-judge สำหรับเคสบทสนทนา", en: "LLM judge", stars: 2, status: "todo" },
      { n: 88, th: "Latency/cost tracking ใน eval report", en: "Cost/latency report", stars: 2, status: "todo" },
      { n: 89, th: "🔒 Outcome dataset (teaching_outcomes) — รออนุมัติ SQL", en: "🔒 Outcome dataset (needs SQL approval)", stars: 3, status: "todo", gated: true },
      { n: 90, th: "Dashboard ผล eval ใน Model Lab", en: "Eval dashboard", stars: 2, status: "todo" },
    ],
  },
  {
    id: "H", letter: "ซ", icon: "📡", th: "สัญญาณการเล่น (Signals & Multimodal)", en: "Signals",
    items: [
      { n: 91, th: "Practice-signal pack → TIGARequest", en: "Signal pack", stars: 3, status: "partial" },
      { n: 92, th: "Camera posture verdict เข้า loop", en: "Posture into loop", stars: 2, status: "todo" },
      { n: 93, th: "Rhythm report → metronome อัตโนมัติ", en: "Auto metronome advice", stars: 2, status: "todo" },
      { n: 94, th: "Dynamics curve → คำแนะนำ phrasing", en: "Phrasing advice", stars: 1, status: "todo" },
      { n: 95, th: "MIDI vs acoustic เลือกเส้นทางวิเคราะห์", en: "MIDI/acoustic split", stars: 2, status: "todo" },
    ],
  },
  {
    id: "I", letter: "ฌ", icon: "🗂", th: "ความจำระบบ (Memory & RAG)", en: "Memory & RAG",
    items: [
      { n: 96, th: "RAG บน KB: ค้นความรู้ก่อนตอบ", en: "KB retrieval", stars: 3, status: "partial" },
      { n: 97, th: "Lesson memory compression", en: "Lesson compression", stars: 3, status: "partial" },
      { n: 98, th: "Prompt composer กลาง", en: "Central prompt composer", stars: 3, status: "partial" },
      { n: 99, th: "KB versioning + provenance", en: "KB versioning", stars: 2, status: "todo" },
      { n: 100, th: "Cost governor ต่อ session ตามแพ็กเกจ", en: "Cost governor", stars: 2, status: "todo" },
    ],
  },
];

export function roadmapAllItems() {
  return ROADMAP_GROUPS.flatMap(g => g.items.map(it => ({ ...it, group: g.letter, groupTh: g.th, groupEn: g.en })));
}

export function roadmapProgress() {
  const all = roadmapAllItems();
  const by = (s) => all.filter(i => i.status === s).length;
  const stars3 = all.filter(i => i.stars === 3 && i.status !== "done").length;
  return { total: all.length, done: by("done"), partial: by("partial"), todo: by("todo"), nextSprint: stars3 };
}
