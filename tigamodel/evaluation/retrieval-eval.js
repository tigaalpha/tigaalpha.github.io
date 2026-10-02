/* ── tigamodel/evaluation/retrieval-eval.js ──
   KB RETRIEVAL EVAL (docs/05 §4 / plan-v3 m07): the 124 eval cases measure
   "does the teacher answer well" — none measure "does it FETCH the right
   knowledge". 17,090 entries fetched wrong are worth zero. This module holds
   the first retrieval probes: real student questions (th/en) with the
   KNOWN-BEFOREHAND answer of which KB domains must be served and which must
   NOT. Scoring runs against the label markers the REAL getKBContext()
   (tigamodel/web.js) actually renders — the production retrieval path, not a
   reimplementation of its keyword table.

   Pure + deterministic: the caller (smoke-retrieval.mjs) supplies the served
   labels per question; scoring here is arithmetic. Gate: ≥80% = RETRIEVAL_
   GATE (docs/05 §4 promised "regression gate ไม้กันที่ 80% ตลอดไป"). ── */

export const RETRIEVAL_GATE = 0.8;

/* The served-label contract of getKBContext (KB_DOMAIN_LABEL values in
   web.js). Lines render as "• [LABEL] title — วิธีสอน: …"; anything outside
   this set (e.g. the block's own [TIGA KNOWLEDGE BASE] header) is not a
   domain marker and is ignored by the scorer. */
export const SERVED_LABELS = new Set([
  "PEDAL", "EXPRESSION", "TECHNIQUE", "JAZZ", "EAR TRAINING", "MEMORIZATION",
  "PRACTICE PLANS", "PERFORMANCE", "MOTIVATION", "THAI MUSIC", "RHYTHM",
  "THEORY", "HARMONY", "REPERTOIRE", "FORM", "ACCOMPANIMENT", "IMPROVISATION",
  "LEARNER DIFFERENCES", "SIGHT READING", "MUSIC INNOVATION",
  "MUSIC MARKETING", "MUSIC THERAPY",
]);

/* 24 probes. expect = labels that MUST appear; forbid = labels whose
   presence is the classic retrieval failure (asking about pedal ships the
   jazz block). Keywords are chosen as EXACT substrings of the real
   KB_DOMAIN_KEYWORDS table (read 2026-09-29) — the probe tests retrieval,
   not fuzzy guessing. */
export const RETRIEVAL_PROBES = [
  { id: "pedal-th", q: "ตอนไหนควรเหยียบแป้นเพดัล", expect: ["PEDAL"], forbid: ["JAZZ"] },
  { id: "pedal-en", q: "When do I use the sustain pedal?", expect: ["PEDAL"], forbid: ["JAZZ"] },
  { id: "sight-th", q: "อ่านโน้ตช้า กวาดตาไม่ทัน", expect: ["SIGHT READING"], forbid: ["JAZZ"] },
  { id: "sight-en", q: "how to improve sight reading", expect: ["SIGHT READING"], forbid: [] },
  { id: "technique-th", q: "นั่งท่าไหนดี ศอกเจ็บทุกครั้ง", expect: ["TECHNIQUE"], forbid: ["THEORY"] },
  { id: "jazz-en", q: "explain swing feel and comping", expect: ["JAZZ"], forbid: ["PEDAL"] },
  { id: "ear-en", q: "ear training dictation for beginners", expect: ["EAR TRAINING"], forbid: ["JAZZ"] },
  { id: "memorize-th", q: "ท่องจำแล้วลืมหมดทุกครั้ง", expect: ["MEMORIZATION"], forbid: ["JAZZ"] },
  { id: "plan-th", q: "ควรซ้อมวันละกี่นาทีดี", expect: ["PRACTICE PLANS"], forbid: ["JAZZ"] },
  { id: "performance-th", q: "ขึ้นเล่นบนเวทีแล้วใจสั่นมาก", expect: ["PERFORMANCE"], forbid: ["JAZZ"] },
  { id: "motivation-th", q: "เบื่อแล้วอยากเลิกเรียนเปียโน", expect: ["MOTIVATION"], forbid: ["JAZZ"] },
  { id: "culture-th", q: "อยากเล่นเพลงไทย หมอลำ หรือขิม", expect: ["THAI MUSIC"], forbid: [] },
  { id: "rhythm-th", q: "นับครึ่งจังหวะไม่ทันเลย", expect: ["RHYTHM"], forbid: ["JAZZ"] },
  { id: "rhythm-en", q: "my beat is not steady at all", expect: ["RHYTHM"], forbid: ["PEDAL"] },
  { id: "theory-en", q: "how do I transpose to another key", expect: ["THEORY"], forbid: ["JAZZ"] },
  { id: "harmony-th", q: "คอร์ด C กับ G สลับไม่ทัน", expect: ["HARMONY"], forbid: ["PEDAL"] },
  { id: "harmony-en", q: "what is a 7th chord inversion", expect: ["HARMONY"], forbid: [] },
  { id: "repertoire-en", q: "tell me about the composer Chopin", expect: ["REPERTOIRE"], forbid: ["JAZZ"] },
  { id: "form-en", q: "what is rondo form", expect: ["FORM"], forbid: ["JAZZ"] },
  { id: "accomp-th", q: "มือซ้ายเล่นเบสไม่ลื่นเลย", expect: ["ACCOMPANIMENT"], forbid: ["JAZZ"] },
  { id: "improv-th", q: "อยากด้นสด แต่งเพลงเองได้ไหม", expect: ["IMPROVISATION"], forbid: ["PEDAL"] },
  { id: "learner-th", q: "ลูกสมาธิสั้นเรียนเปียโนได้ไหม", expect: ["LEARNER DIFFERENCES"], forbid: ["JAZZ"] },
  /* docs/16 §3 (m52) coverage wave: the owner's new categories must be
     retrievable too — innovation (new domain), marketing/therapy domains */
  { id: "innovation-th", q: "นวัตกรรมเทคโนโลยีมีอะไรช่วยเรียนเปียโนบ้าง", expect: ["MUSIC INNOVATION"], forbid: ["JAZZ"] },
  { id: "innovation-en", q: "how has digital piano technology changed learning", expect: ["MUSIC INNOVATION"], forbid: [] },
  { id: "marketing-th", q: "อยากทำคลิปโปรโมทคอร์สเปียโนให้มีคนรู้จัก", expect: ["MUSIC MARKETING"], forbid: ["JAZZ"] },
  { id: "marketing-en", q: "how should a piano teacher market lessons online", expect: ["MUSIC MARKETING"], forbid: [] },
  { id: "therapy-th", q: "ดนตรีบำบัดกับสุขภาวะในการเรียนเปียโน", expect: ["MUSIC THERAPY"], forbid: ["JAZZ"] },
  { id: "therapy-en", q: "how is music used for wellbeing in piano teaching", expect: ["MUSIC THERAPY"], forbid: [] },
  /* no topical hit → the honest small core (motivation + planning), never
     the whole KB and never a random domain */
  { id: "core-empty", q: "", expect: ["MOTIVATION", "PRACTICE PLANS"], forbid: ["JAZZ", "PEDAL"] },
  /* gibberish → no TOPICAL hit (the fallback core may still serve — the
     failure being tested is a random domain firing on noise) */
  { id: "gibberish", q: "asdfgh qwerty zzxx", expect: ["MOTIVATION"], forbid: ["JAZZ", "PEDAL", "REPERTOIRE", "FORM", "SIGHT READING"] },
];

/* Extract the domain labels the REAL block actually served. */
export function servedLabels(block) {
  const out = new Set();
  const re = /\[([A-Z][A-Z ]+?)\]/g;
  let m;
  while ((m = re.exec(String(block || ""))) !== null) {
    if (SERVED_LABELS.has(m[1])) out.add(m[1]);
  }
  return out;
}

/* 1 = correct retrieval (all expected served, none forbidden); 0 otherwise. */
export function scoreRetrieval(probe, labels) {
  for (const e of probe.expect) if (!labels.has(e)) return 0;
  for (const f of probe.forbid) if (labels.has(f)) return 0;
  return 1;
}

/* accuracy = passed / total; deterministic. */
export function retrievalAccuracy(scored) {
  if (!Array.isArray(scored) || scored.length === 0) return 0;
  return scored.filter(s => s.score === 1).length / scored.length;
}
