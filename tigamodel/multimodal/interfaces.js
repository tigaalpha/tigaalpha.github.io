/* ── tigamodel/multimodal/interfaces.js — Phase 4 (spec §18–20) ──
   THE HONEST REGISTRY of multimodal capability. Spec §20 is explicit:
   "ห้ามอ้างว่าวิเคราะห์ได้ หากยังไม่มีโมดูลหรือข้อมูลเพียงพอ — ถ้ายังไม่
   implement ให้สร้าง interface และระบุสถานะว่าเป็น planned หรือ not
   implemented". This file is that declaration, machine-readable so UI and
   future encoders can NEVER overclaim:

     implemented  — runs today, real output (self-report, performance signals)
     planned      — interface + schema exist, engine does not (camera modes,
                    piano performance audio analysis, STT/TTS…)
     forbidden    — permanently out of bounds per spec §16/§28 (face-based
                    mood/mental-state inference, biometric identification)

   Consumers: capabilityEngine depth, back-office multimodal tab, and the
   §20 guard — analyzePerformance() throws unless a real engine registers. ── */

export const MULTIMODAL_REGISTRY = [
  /* ── §17 self-report — IMPLEMENTED (Phase 4) ── */
  { id: "self_report", kind: "input", label: { th: "คำตอบตรงจากนักเรียน (micro-poll)", en: "Direct student answers (micro-poll)", zh: "学生直接反馈" },
    status: "implemented", modalities: ["self_report"], spec: "§17" },

  /* ── performance signals (mic/MIDI/tap grading) — IMPLEMENTED (app-side, pre-existing) ── */
  { id: "performance_signals", kind: "input", label: { th: "สัญญาณการเล่น (ความแม่น/พลาดซ้ำ/หยุด/จังหวะ)", en: "Performance signals (accuracy/repeats/pauses/rhythm)", zh: "演奏信号" },
    status: "implemented", modalities: ["midi", "audio_pitch"], spec: "§20 subset" },

  /* ── state estimation + fusion — IMPLEMENTED (v1: self_report+session+history) ── */
  { id: "state_estimator", kind: "engine", label: { th: "ประมาณสถานะผู้เรียน (fusion v1)", en: "Student state estimation (fusion v1)", zh: "学习者状态估计" },
    status: "implemented", modalities: ["self_report", "session", "history"], spec: "§14–15" },

  /* ── camera modes — PLANNED (§19) ── */
  { id: "front_camera", kind: "input", label: { th: "กล้องหน้า (สัญญาณที่สังเกตได้)", en: "Front camera (observable signals)", zh: "前置摄像头" },
    status: "planned", modalities: ["vision"], spec: "§19",
    note: "observable facial/head signals only; NEVER mood inference (§16); consent required (§28)" },
  { id: "rear_camera", kind: "input", label: { th: "กล้องหลัง (มือ/คีย์บอร์ด/โน้ต)", en: "Rear camera (hands/keyboard/score)", zh: "后置摄像头" },
    status: "planned", modalities: ["vision"], spec: "§19" },
  { id: "dual_camera_sync", kind: "engine", label: { th: "ซิงก์สองกล้อง (timestamp)", en: "Dual-camera timestamp sync", zh: "双摄时间同步" },
    status: "planned", modalities: ["vision"], spec: "§19" },

  /* ── piano performance audio analysis — PLANNED (§20) ── */
  { id: "performance_audio_analysis", kind: "engine", label: { th: "วิเคราะห์เสียงเปียโนขั้นลึก (pedaling/phrasing/balance)", en: "Deep piano audio analysis (pedaling/phrasing/balance)", zh: "钢琴演奏深度分析" },
    status: "planned", modalities: ["audio"], spec: "§20" },

  /* ── speech — PLANNED (§18) ── */
  { id: "speech_to_text", kind: "input", label: { th: "แปลงเสียงพูด (ถาม-ตอบ)", en: "Speech to text (Q&A)", zh: "语音转文字" },
    status: "planned", modalities: ["audio"], spec: "§18",
    note: "native-stt.ts exists for Capacitor Voice Tutor; tigamodel integration pending" },
  { id: "text_to_speech", kind: "output", label: { th: "อ่านออกเสียงครู TiGA", en: "Teacher TiGA voice-out", zh: "教师语音输出" },
    status: "planned", modalities: ["audio"], spec: "§18",
    note: "owner excluded TTS from Auto Teaching 2.0 (2026-09-20); revisit for Phase 4 lessons" },

  /* ── sheet music / MusicXML — PLANNED (§18) ── */
  { id: "score_input", kind: "input", label: { th: "โน้ตดนตรี / MusicXML", en: "Sheet music / MusicXML", zh: "乐谱/MusicXML" },
    status: "planned", modalities: ["score"], spec: "§18" },

  /* ── FORBIDDEN forever (§16, §28) ── */
  { id: "face_mood_inference", kind: "engine", label: { th: "วินิจฉัยอารมณ์จากใบหน้า", en: "Mood inference from facial expression", zh: "面部情绪推断" },
    status: "forbidden", modalities: ["vision"], spec: "§16",
    note: "ยิ้ม ≠ เข้าใจ, หน้าบึ้ง ≠ ไม่สนุก — expressions are never sole evidence of inner state" },
  { id: "biometric_identity", kind: "engine", label: { th: "จำใบหน้าเพื่อระบุตัวตน", en: "Face-based identity recognition", zh: "人脸识别" },
    status: "forbidden", modalities: ["vision"], spec: "§28" },
];

export function multimodalSummary() {
  const s = { implemented: 0, planned: 0, forbidden: 0 };
  for (const m of MULTIMODAL_REGISTRY) if (s[m.status] != null) s[m.status]++;
  return s;
}

export function multimodalStatus(id) {
  const m = MULTIMODAL_REGISTRY.find(x => x.id === id);
  return m ? m.status : null;
}

/* §20 guard: any code path that would CLAIM deep piano-audio analysis must
   go through a registered real engine. None exists → this throws, which is
   the point: it is impossible to overclaim by accident. */
let _perfEngine = null;
export function registerPerformanceAnalysisEngine(fn) { _perfEngine = typeof fn === "function" ? fn : null; }
export function analyzePerformance(recording) {
  if (!_perfEngine) {
    throw Object.assign(new Error("performance audio analysis is PLANNED (spec §20) — no engine registered; do not present analysis that does not exist"), { code: "TIGA_CAPABILITY_PLANNED" });
  }
  return _perfEngine(recording);
}
