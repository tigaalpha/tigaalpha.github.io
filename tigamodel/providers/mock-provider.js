/* ── tigamodel/providers/mock-provider.js ──
   Deterministic provider for tests, offline development, CI and eval-suite
   baselines. Returns canned-but-structured teaching responses derived from
   the request itself (so different inputs → different outputs, making
   assertions meaningful). NEVER call this "the AI" — it is scaffolding that
   lets every engine downstream be built and tested before any real model
   is wired. ── */

import { makeTIGAResponse } from "../core/schema.js";

export function createMockProvider({ name = "mock" } = {}) {
  return {
    declare() {
      return {
        taskTypes: ["chat", "diagnose", "coach-tip", "weekly-report", "practice-plan", "lesson-plan", "exercise", "feedback", "performance-analysis"],
        cost: "free",
        latency: "fast",
        privacy: "local", // nothing leaves the process — honest classification
        modalities: ["text"],
      };
    },
    async complete(req) {
      const m = (req.message || "").toLowerCase();
      let text;
      if (/ง่าย|easy|太简单/.test(m)) {
        text = "[mock] เก่งมากที่บอกครู — งั้นเราเพิ่มความท้าทายนิดนึง: ลองเล่นช้าลงแต่นับจังหวะให้นิ่ง แล้วค่อยเร่งทีละนิด";
      } else if (/ยาก|hard|难|ไม่เข้าใจ|confus|สับสน/.test(m)) {
        text = "[mock] ไม่เป็นไร เราแบ่งใหม่: ลองเล่นแค่ 2 ท่อนแรกช้า ๆ ตามครู แล้วครูจะฟังว่าจุดไหนติด ค่อยแก้ทีละจุด";
      } else if (req.task_type === "diagnose") {
        text = "[mock] จากข้อมูลที่ส่งมา จุดที่ควรดูก่อนคือความนิ่งของจังหวะ — เล่นช้าลงพร้อมนับเบา ๆ แล้วสังเกตว่าโน้ตไหนรีบหรือช้ากว่าเพื่อน";
      } else if (req.task_type === "coach-tip" || req.task_type === "practice-plan") {
        text = "[mock] วันนี้ลอง 10 นาที: ทบทวนท่อนที่เคยติด 3 นาที → ซ้อมช้า 4 นาที → เล่นเพลงที่ชอบ 3 นาทีปิดท้าย";
      } else {
        text = `[mock] รับทราบครับ — เรื่อง "${(req.message || "").slice(0, 40)}" ครูจะอธิบายทีละขั้น ลองทำตามขั้นแรกก่อนแล้วบอกครูว่าได้ผลไหม`;
      }
      return makeTIGAResponse({ traceId: req.trace_id, text, provider: name, model: "mock-1", status: "ok", confidence: 0.5 });
    },
  };
}
