/* ── tiga-strategy-labels.ts — split out of tigamodel/web.js (plan v3 1.5) ──
   The Practice result screen reads the strategy badge DURING RENDER, which
   used to pin the whole ~1.18 MB tigamodel tree into the main chunk. The
   vocabulary is pure data + one pure function, so it lives here as a light
   static import; web.js re-exports it for the Model Lab/admin surfaces so
   there is exactly ONE copy of the vocabulary (they re-read through web.js
   and stay in sync by construction).

   If a tigamodel surface ever adds a strategy id, add it HERE. ── */

export const TIGA_STRATEGY_LABELS = {
  "simplify-on-confusion": { th: "🧩 ลดความซับซ้อน — แบ่งท่อนใหม่", en: "🧩 Simplify — break it into chunks", zh: "🧩 降低难度 — 分段练习" },
  "return-to-prerequisite": { th: "↩️ กลับไปพื้นฐานก่อน", en: "↩️ Back to the prerequisite", zh: "↩️ 回到基础练习" },
  "ease-off-on-low-engagement": { th: "🌙 ผ่อนความเข้ม วันนี้สั้นพอ", en: "🌙 Ease off — keep today short", zh: "🌙 放松强度 — 今天短练即可" },
  "raise-challenge": { th: "🚀 เพิ่มความท้าทายให้", en: "🚀 Raise the challenge", zh: "🚀 增加挑战" },
  "simplify-on-hard-report": { th: "🧩 ช้าลงแล้วแบ่งท่อน", en: "🧩 Slow down and isolate", zh: "🧩 减速分段" },
  "continue-current-plan": { th: "✅ ทำต่อตามแผนเดิมได้", en: "✅ Continue the current plan", zh: "✅ 按原计划继续" },
};
export function tigaStrategyLabel(id, lang) {
  const t = TIGA_STRATEGY_LABELS[id];
  return t ? (t[lang] || t.en) : null;
}
