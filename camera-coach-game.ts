/* ── camera-coach-game.ts ──
   GAME LAYER for the hand-posture camera coach (owner request: "หาทางทำ
   หน้าสอนเรื่องนี้ให้สนุกขึ้น ใส่ความเป็นเกมเข้าไปเพิ่มมากว่านี้อีก").

   DESIGN — pure function of data the live loop already computes, so the
   camera hook stays the single owner of frames/geometry and this module
   only turns per-frame numbers into game juice:

   1. LIVE SCORE BAR  — session score 0-100 built from the SAME
      good-frame ratio the exit recap already grades, smoothed so it
      climbs while good, decays while flat. No new source of truth.
   2. COMBO COUNTER  — consecutive good frames; multiplier tiers ×1→×4
      with names, shown as a badge; resets on a bad frame (hysteresis
      via a 12-frame grace window so one noisy frame doesn't kill a
      combo — mirrors the debounced-tip philosophy).
   3. MICRO-CHALLENGES — timed missions ("hold good shape for 15s",
      "keep wrist level for 12s", "combo 30", "both hands 8s"…).
      Each solved pays score bonus + stars; they cycle forever so there
      is always a next thing to chase.
   4. RANKS + PRAISE — score thresholds pop a rank title and one-shot
      praise messages (3 languages), escalating at combo milestones.
      Every message composes ONLY from computed numbers.

   No network, no model call, no invented facts: every number rendered
   comes from frames the hook already measures. Nothing here touches
   rewards/EXP — the existing exitCamera() recap stays the sole payer
   (single source of truth for the economy). ── */

// ── Combo ──
export const COMBO_TIERS = [
  { mult: 1, name: { th: "เริ่มต้น", en: "Warming up", zh: "起步" } },
  { mult: 2, name: { th: "ดีมาก ×2", en: "On fire ×2", zh: "很棒 ×2" } },
  { mult: 3, name: { th: "มือทอง ×3", en: "Golden hands ×3", zh: "金手 ×3" } },
  { mult: 4, name: { th: "นักเปียโน ×4", en: "Pianist ×4", zh: "钢琴家 ×4" } },
];
export function comboTier(combo) {
  if (combo >= 60) return COMBO_TIERS[3];
  if (combo >= 30) return COMBO_TIERS[2];
  if (combo >= 12) return COMBO_TIERS[1];
  return COMBO_TIERS[0];
}

// ── Score ──
// start at 40 so the bar isn't dead at spawn; climbs while good, decays
// while flat; at exit it converges with the recap's real ratio.
const SCORE_START = 40;
export function scoreStart() { return SCORE_START; }
export function updateScore(prev, isGood) {
  if (isGood) return Math.min(100, prev + 1.5);
  return Math.max(0, prev - 0.8);
}

// ── Rank titles (score bands) ──
export const SCORE_RANKS = [
  { min: 90, icon: "👑", th: "ระดับครูมือ", en: "Master level", zh: "大师级" },
  { min: 75, icon: "🏆", th: "มือระดับทอง", en: "Gold hands", zh: "金牌手" },
  { min: 60, icon: "⭐", th: "กำลังดีเลย", en: "Getting good", zh: "渐入佳境" },
  { min: 40, icon: "🌱", th: "เริ่มเข้าที่", en: "Taking shape", zh: "初见成效" },
  { min: 0,  icon: "🎯", th: "เริ่มฝึกกัน", en: "Let's practice", zh: "开始练习" },
];
export function scoreRank(score) {
  for (const r of SCORE_RANKS) if (score >= r.min) return r;
  return SCORE_RANKS[SCORE_RANKS.length - 1];
}

// ── Micro-challenges ──
// needSec = seconds of continuous qualifying frames to solve (0 = instant
// goal types: combo/score thresholds).
export const CHALLENGES = [
  { id: "hold",    needSec: 15, th: "ถือท่าดี 15 วินาที",       en: "Hold good shape for 15s", zh: "保持良好手型15秒" },
  { id: "wrist",   needSec: 12, th: "ข้อมือระดับ 12 วินาที",    en: "Level wrist for 12s",     zh: "手腕保持水平12秒" },
  { id: "combo30", needSec: 0,  th: "เก็บคอมโบ 30",             en: "Reach a 30 combo",        zh: "连击达到30" },
  { id: "both",    needSec: 8,  th: "มือสองข้างดีพร้อมกัน 8 วิ", en: "Both hands good for 8s",  zh: "双手同好8秒" },
  { id: "combo60", needSec: 0,  th: "เก็บคอมโบ 60",             en: "Reach a 60 combo",        zh: "连击达到60" },
  { id: "score80", needSec: 0,  th: "ทำคะแนนถึง 80",            en: "Score 80 points",         zh: "得分达到80" },
];
export const CHALLENGE_SEC = 20;    // seconds per mission window
export const CHALLENGE_BONUS = 150; // score bonus on solve
export const CHALLENGE_STARS = 3;   // stars per solve
export const COMBO_GRACE = 12;      // bad frames a combo survives (camera noise hysteresis)

// Fresh per-session game state — created by the hook on openCamera().
export function freshGameState() {
  return {
    score: scoreStart(), combo: 0, grace: 0, bestCombo: 0,
    stars: 0, solved: 0,
    chIdx: 0, chT: 0, // window time elapsed (hands-visible seconds only)
    chCount: { good: 0, wrist: 0, both: 0 },
    rankIdx: 3, // "Taking shape" at spawn score 40
    praiseText: "", praiseUntil: 0,
  };
}

// ONE FRAME STEP — the whole live game in a pure function so the smoke
// test can drive it exactly like the render loop does.
//   g     — game state object (mutated in place, returned for chaining)
//   frame — { hasHands, good, wristOk, bothGood } for this frame
//   dtMs  — ms since last frame
//   nowMs — wall clock (for praise expiry)
// returns events: [{type:"praise",text}|{type:"rank",rank}|{type:"solved"}]
export function gameStep(g, frame, dtMs, nowMs) {
  const ev = [];
  if (!frame.hasHands) return ev; // game pauses when hands leave view — fair, no decay while away
  const dt = dtMs / 1000;

  // score + combo
  g.score = updateScore(g.score, frame.good);
  if (frame.good) { g.combo += 1; g.grace = COMBO_GRACE; }
  else if (g.grace > 0) g.grace -= 1; // noise tolerance — one bad frame doesn't kill a combo
  else g.combo = 0;
  if (g.combo > g.bestCombo) g.bestCombo = g.combo;
  const pr = praiseFor(g.combo);
  if (pr) { g.praiseText = pr; g.praiseUntil = nowMs + 2200; ev.push({ type: "praise", text: pr }); }

  // mission window (only hands-visible time counts)
  g.chT += dt;
  if (frame.good) g.chCount.good += dt;
  if (frame.wristOk) g.chCount.wrist += dt;
  if (frame.bothGood) g.chCount.both += dt;
  const ch = CHALLENGES[g.chIdx % CHALLENGES.length];
  const res = evalChallenge({ goodSec: g.chCount.good, wristSec: g.chCount.wrist, bothSec: g.chCount.both, combo: g.combo, score: g.score, challenge: ch });
  if (res.solved) {
    g.stars += CHALLENGE_STARS; g.solved += 1; g.score = Math.min(100, g.score + CHALLENGE_BONUS / 10); // 150 raw = +15 score points (bar stays 0-100)
    g.chIdx = (g.chIdx + 1) % CHALLENGES.length; g.chT = 0; g.chCount = { good: 0, wrist: 0, both: 0 };
    ev.push({ type: "solved" });
  } else if (g.chT >= CHALLENGE_SEC) {
    g.chIdx = (g.chIdx + 1) % CHALLENGES.length; g.chT = 0; g.chCount = { good: 0, wrist: 0, both: 0 };
    ev.push({ type: "expire" });
  }

  // rank (score band) — celebrate only genuine climbs
  const rank = scoreRank(g.score);
  const rIdx = SCORE_RANKS.indexOf(rank);
  if (rIdx < g.rankIdx) { g.rankIdx = rIdx; ev.push({ type: "rank", rank }); }
  return ev;
}

// Current mission, computed for rendering: { ch, prog, secLeft }
export function missionView(g, nowMs) {
  const ch = CHALLENGES[g.chIdx % CHALLENGES.length];
  const res = evalChallenge({ goodSec: g.chCount.good, wristSec: g.chCount.wrist, bothSec: g.chCount.both, combo: g.combo, score: g.score, challenge: ch });
  return { ch, prog: res.progress, secLeft: Math.max(0, Math.ceil(CHALLENGE_SEC - g.chT)) };
}

// Pure evaluate: given per-frame counters accumulated while the challenge
// was active, return { solved, progress } — progress 0..1 for the bar.
// ctx: { goodSec, wristSec, bothSec, combo, score, challenge }
export function evalChallenge(ctx) {
  const c = ctx.challenge;
  switch (c.id) {
    case "hold":    return { solved: ctx.goodSec >= c.needSec,  progress: Math.min(1, ctx.goodSec / c.needSec) };
    case "wrist":   return { solved: ctx.wristSec >= c.needSec, progress: Math.min(1, ctx.wristSec / c.needSec) };
    case "both":    return { solved: ctx.bothSec >= c.needSec,  progress: Math.min(1, ctx.bothSec / c.needSec) };
    case "combo30": return { solved: ctx.combo >= 30, progress: Math.min(1, ctx.combo / 30) };
    case "combo60": return { solved: ctx.combo >= 60, progress: Math.min(1, ctx.combo / 60) };
    case "score80": return { solved: ctx.score >= 80, progress: Math.min(1, ctx.score / 80) };
    default:        return { solved: false, progress: 0 };
  }
}

// ── Praise (one-shot, escalating at combo milestones) ──
export function praiseFor(combo, lang) {
  if (combo === 12) return { th: "🔥 คอมโบ ×2 แล้ว!", en: "🔥 Combo ×2!", zh: "🔥 连击 ×2！" }[lang] || "🔥 Combo ×2!";
  if (combo === 30) return { th: "✨ มือทอง! ลุ้น ×4 ต่อไป", en: "✨ Golden hands! Next: ×4", zh: "✨ 金手！冲 ×4" }[lang] || "✨";
  if (combo === 60) return { th: "👑 นักเปียโนตัวจริง! ×4 สุดขีด", en: "👑 True pianist! Max ×4", zh: "👑 真钢琴家！满 ×4" }[lang] || "👑";
  return null;
}
export function rankUpPraise(rank, lang) {
  return { th: `${rank.icon} ขึ้นระดับ: ${rank.th}!`, en: `${rank.icon} Rank up: ${rank.en}!`, zh: `${rank.icon} 升级：${rank.zh}！` }[lang] || rank.en;
}
export function missionSolvedPraise(lang) {
  return { th: "🎯 ภารกิจสำเร็จ! +⭐⭐⭐", en: "🎯 Mission complete! +⭐⭐⭐", zh: "🎯 任务完成！+⭐⭐⭐" }[lang] || "🎯 Mission complete!";
}
