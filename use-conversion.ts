/* ── use-conversion.ts ──
   Trial-conversion funnel (owner-approved strategy 2026-09-19: "turn
   signed-in members into paying members within 30 days"). The trial is a
   full-featured Premium month, so there is no quota wall to trip over —
   the funnel therefore runs on DAY-BASED moments instead:

     d1–3   welcome    meet ครู TIGA AI, set the 4-week expectation
     d15–28 halfway    progress proof + "continue before the trial ends and
                        today's price is locked for good" (decision 2A:
                        no discount, price-lock framing only)
     d29–30 closing    show exactly what expires with the trial, CTA opens
                        the PromptPay CheckoutModal in one tap (3A)
     expired win-back  teacher still remembers you — nothing is lost (4A)

   Every popup is dismissed-once-per-trial via localStorage, never re-fires
   for paying members (plan !== "trial"/"free") or admins (effectivePlan
   maps them to "maxfamily", so they never match either branch).

   Also owns the one-time song-creation GIFT for free members (decision 1A):
   the free card advertises creation as locked; the gift lets a free member
   taste it exactly once, ever — the "wow" moment that makes upgrading feel
   earned rather than gated. Lifetime-once via localStorage, deliberately
   separate from the day-bucketed tg_usage counters (those reset daily). ── */

import { trialLenDays } from "./payment";

export const CONV_COPY = {
  th: {
    bannerUrgent: "⏳ อีก {n} วัน — หลังจบคุณจะเสีย: ครู AI ไม่จำกัด · สร้างเพลง · เกม · สมุดพก",
    bannerUrgentBtn: "รักษาสิทธิ์",
    welcome: { ic: "🎓", title: "ครู TIGA AI มาแนะนำตัว", body: "ยินดีต้อนรับสู่ TIGA.AI!\n\n30 วันข้างหน้าคุณใช้ได้เต็มรูปแบบ — ครู AI ไม่จำกัด สร้างเพลงได้ เกมทุกเกมเล่นได้ ผมจะพาเรียนทีละขั้นแบบครูตัวจริง แล้วสรุปความก้าวหน้าให้ฟังทุกสัปดาห์", cta: "🚀 เริ่มสัปดาห์แรกกันเลย" },
    halfway: { ic: "📈", title: "ครึ่งทางแล้ว — ไปได้ดีมาก!", body: "คุณเดินผ่านครึ่งแรกของโปรแกรม 30 วันแล้ว ทุกสถิติ ใบประกาศ และกราฟพัฒนาการของคุณถูกเก็บไว้ต่อเนื่อง\n\nสมาชิกที่ต่ออายุก่อนทดลองหมด จะล็อกราคาเดิมไว้ได้ตลอดไป", cta: "⭐ ดูแพ็กเกจสมาชิก" },
    closing: { ic: "⏳", title: "ใกล้หมดแล้ว — สิ่งที่กำลังจะหายไป", body: "ทดลองใช้ของคุณใกล้จบแล้ว หลังจากนี้:", items: "♾️ ครู AI ไม่จำกัด\n🎵 สร้างเพลง AI\n🎮 เกมดนตรีทุกเกม\n📋 สมุดพก + ใบประกาศ", cta: "💳 โอนเงินสมัครเลย (พร้อมเพย์)", alt: "ดูทุกแพ็กเกจ" },
    winback: { ic: "🧠", title: "ครู TIGA AI ยังจำคุณได้", body: "ทุกความก้าวหน้า ใบประกาศ และสถิติของคุณยังเก็บอยู่ครบถ้วน กลับมาเรียนต่อได้ทันทีเลย — ไม่มีอะไรหายไป", cta: "💙 กลับมาเรียนต่อ" },
    // v3 kinds — body is normally overridden by personalizedBody() with the
    // learner's own numbers; these bodies are the defensive generic fallback.
    d7proof: { ic: "🏅", title: "พิสูจน์แล้วในสัปดาห์แรก", body: "คำแนะนำของครู TIGA ได้ผลจริงกับการซ้อมของคุณ\n\nล็อกราคา 1,490฿ ไว้ตอนนี้ — ราคาเดิมตลอดไป ไม่มีขึ้น", cta: "⭐ ล็อกราคา 1,490฿ ตลอดไป" },
    proof: { ic: "📈", title: "ครูคนนี้ทำให้คุณดีขึ้นจริง", body: "จุดที่เคยติดของคุณดีขึ้นจากการซ้อมจริง\n\nล็อกสิทธิ์ครูคนนี้ไว้หลังทดลองจบ — 1,490฿/เดือน ราคาเดิมตลอดไป", cta: "⭐ ล็อกสิทธิ์ไว้" },
  },
  en: {
    bannerUrgent: "⏳ {n} days left — then you lose: unlimited AI teacher · song creation · games · practice book",
    bannerUrgentBtn: "Lock it in",
    welcome: { ic: "🎓", title: "Meet Teacher TIGA AI", body: "Welcome to TIGA.AI!\n\nFor the next 30 days everything is fully unlocked — unlimited AI teacher, song creation, every game. I'll guide you step by step like a real teacher and report your progress every week.", cta: "🚀 Start week one" },
    halfway: { ic: "📈", title: "Halfway there — great pace!", body: "You're past the first half of the 30-day program. Every stat, certificate and progress chart you've earned keeps building up.\n\nMembers who continue before the trial ends lock in today's price for good.", cta: "⭐ See membership plans" },
    closing: { ic: "⏳", title: "Almost over — what you're about to lose", body: "Your free trial ends soon. After that:", items: "♾️ Unlimited AI teacher\n🎵 AI song creation\n🎮 Every music game\n📋 Practice book + certificates", cta: "💳 Pay & continue (PromptPay)", alt: "Browse all plans" },
    winback: { ic: "🧠", title: "Teacher TIGA AI still remembers you", body: "All your progress, certificates and stats are exactly where you left them. You can continue right where you stopped — nothing is lost.", cta: "💙 Continue learning" },
    d7proof: { ic: "🏅", title: "Proven in week one", body: "Teacher TIGA's coaching is already working on your real practice.\n\nLock in 1,490฿ now — this price forever, never raised for you.", cta: "⭐ Lock 1,490฿ forever" },
    proof: { ic: "📈", title: "The coaching is working", body: "Your trouble spots are improving from real practice.\n\nKeep this teacher after the trial — 1,490฿/mo, this price forever.", cta: "⭐ Lock it in" },
  },
  zh: {
    bannerUrgent: "⏳ 还剩 {n} 天 — 到期后失去：AI老师不限次 · AI作曲 · 全部游戏 · 练习册",
    bannerUrgentBtn: "锁定权益",
    welcome: { ic: "🎓", title: "认识TIGA AI老师", body: "欢迎来到TIGA.AI！\n\n接下来30天所有功能全部开放——AI老师不限次、AI作曲、全部游戏。我会像真正的老师一样一步步带你学，每周向你汇报进步。", cta: "🚀 开始第一周" },
    halfway: { ic: "📈", title: "已过半程——非常棒！", body: "30天计划已过半，你的所有数据、证书和进步曲线都在持续累积。\n\n试用期内续费可永久锁定当前价格。", cta: "⭐ 查看会员套餐" },
    closing: { ic: "⏳", title: "即将到期——你将失去", body: "免费试用即将结束，届时：", items: "♾️ AI老师不限次\n🎵 AI作曲\n🎮 全部音乐游戏\n📋 练习册 + 证书", cta: "💳 立即扫码支付", alt: "查看全部套餐" },
    winback: { ic: "🧠", title: "TIGA AI老师还记得你", body: "你的全部进度、证书和统计都原样保存，随时可以接着学——什么都没有丢失。", cta: "💙 继续学习" },
    d7proof: { ic: "🏅", title: "第一周已验证", body: "TIGA 老师的指导对你的真实练习已经见效。\n\n现在锁定 1,490฿——永久价格，永不上调。", cta: "⭐ 永久锁定 1,490฿" },
    proof: { ic: "📈", title: "指导见效了", body: "你的薄弱点正在真实练习中改善。\n\n试用结束后保留这位老师——1,490฿/月，永久价格。", cta: "⭐ 锁定权益" },
  },
};

// ── dismissal memory: once per popup id per device ─────────────────────────
const SEEN_KEY = "tg_conv_seen";
function seenMap() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") || {}; } catch (e) { return {}; } }
export function convSeen(id) { return !!seenMap()[id]; }
export function markConvSeen(id) { try { const m = seenMap(); m[id] = 1; localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch (e) {} }

// 1-based calendar day inside this profile's trial (1..trialLenDays), else -1.
export function trialDay(profile) {
  if (!profile || !profile.created_at) return -1;
  const len = trialLenDays(profile);
  const d = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000) + 1;
  return d >= 1 && d <= len ? d : -1;
}

/* ════════════════════════════════════════════════════════════════════════
   v3 ADDITIONS (owner-approved plan v3, 2026-09-21) — "Personalized Proof
   Funnel". The day-based skeleton above stays; v3 makes every sales moment
   speak the LEARNER'S OWN NUMBERS from the real auto-teaching closed loop
   (tg_atip_outcomes), adds the d7 first-proof popup and a recurring win-
   moment proof popup, and routes everything through ONE daily sales gate
   (1 selling surface per day, ever — guardrail against nudge fatigue).
   Everything here is pure data + localStorage: no hooks, no DOM, so the
   Node e2e (scripts/verify-conversion-funnel.mjs) drives the REAL code.
   ════════════════════════════════════════════════════════════════════════ */

// ── proof stats: the learner's real before/after evidence ──────────────────
// Reads the SAME rows recordTipOutcome() writes (use-autoteach.ts) plus the
// practice log. Honest-null throughout: a field the data can't support is
// simply absent, and personalized copy is only used when improvedCount >= 1
// (never render a proud "+0%").
export function proofStats() {
  try {
    const out = (JSON.parse(localStorage.getItem("tg_atip_outcomes") || "[]") || [])
      .filter(r => r && r.resolved && r.outcome);
    const improved = out.filter(r => r.outcome.improved === true);
    const deltas = improved.map(r => Math.round(r.outcome.delta || 0)).filter(d => d > 0);
    let sessions = 0;
    try {
      const pl = JSON.parse(localStorage.getItem("tg_practice_log") || "null");
      if (pl && Array.isArray(pl.recent)) sessions = pl.recent.length;
    } catch (e) {}
    return {
      resolved: out.length,
      improvedCount: improved.length,
      bestDelta: deltas.length ? Math.max(...deltas) : null,
      totalDelta: deltas.length ? deltas.reduce((s, d) => s + d, 0) : null,
      sessions,
    };
  } catch (e) { return { resolved: 0, improvedCount: 0, bestDelta: null, totalDelta: null, sessions: 0 }; }
}

// ── the ONE-DAY-ONE-SELL gate (v3 core guardrail) ─────────────────────────
// Every NEW selling surface (d7 popup, proof popup) must pass through here.
// The original d0/d15/d29 funnels keep their own once-per-trial seenMap —
// they predate this gate and are rare enough not to need it. Day-bucketed,
// separate key from tg_usage (that one feeds REAL quota walls; mixing the
// two would make quota display lie).
const SELL_DAY_KEY = "tg_sell_day";
export function sellSlotToday() {
  try {
    const v = JSON.parse(localStorage.getItem(SELL_DAY_KEY) || "{}") || {};
    return v.d === new Date().toDateString() ? v.used || 0 : 0;
  } catch (e) { return 0; }
}
function takeSellSlot() {
  try {
    const today = new Date().toDateString();
    let v = JSON.parse(localStorage.getItem(SELL_DAY_KEY) || "{}") || {};
    if (v.d !== today) v = { d: today, used: 0 };
    if (v.used >= 1) return false;
    v.used += 1;
    localStorage.setItem(SELL_DAY_KEY, JSON.stringify(v));
    return true;
  } catch (e) { return false; }
}

// ── d7 first-proof popup ─────────────────────────────────────────────────
// The original funnel is silent d3–d14 — exactly where a learner's first
// closed loop lands. Shows ONCE, only when there is a real improved outcome
// to speak (no evidence → no popup; the skeleton funnels handle those).
export function convD7(profile, plan) {
  if (plan !== "trial" || !profile || !profile.created_at) return null;
  const day = trialDay(profile);
  if (day < 5 || day > 9 || convSeen("d7")) return null;
  const p = proofStats();
  if (!(p.improvedCount >= 1)) return null;        // no proof, no pitch
  if (!takeSellSlot()) return null;                 // someone sold today already
  return { id: "d7", kind: "d7proof", day, proof: p };
}

// ── recurring win-moment proof popup (every ≥7 days, evidence-gated) ──────
// Surfaces after a practice session where the teaching loop closed with a
// real improvement. Cap: 7 days (timestamp, NOT once-per-trial) + the daily
// sell gate. Called from the same "tiga:practice-done" flow the funnel uses.
const PROOF_LAST_KEY = "tg_proof_last";
export function proofPopupEligible(profile, plan, now = Date.now()) {
  if (plan !== "trial" || !profile) return null;
  const p = proofStats();
  if (!(p.improvedCount >= 1 && p.bestDelta != null && p.bestDelta >= 5)) return null;
  try {
    const last = Number(localStorage.getItem(PROOF_LAST_KEY) || "0");
    if (now - last < 7 * 86400000) return null;
  } catch (e) {}
  if (!takeSellSlot()) return null;
  try { localStorage.setItem(PROOF_LAST_KEY, String(now)); } catch (e) {}
  return { id: "proof", kind: "proof", day: trialDay(profile), proof: p };
}

// ── funnel event logging (Phase 0 instrumentation) ────────────────────────
// kind "conv" + item_id "<popup>:shown|cta" — rides the EXISTING logUsage
// stream + admin analytics, no new table, no schema change.
export function logConvEvent(popupId, what) {
  try {
    import("./shared-infra").then(m => { try { m.logUsage("conv", popupId + ":" + what); } catch (e) {} }, () => {});
  } catch (e) {}
}

// ── post-purchase activation (Phase 5) ─────────────────────────────────
// True exactly once per account: the first moment a paid plan lands. The app
// listens for this to fire the "teacher speaks within 60s" moment — the
// anti-regret proof that the purchase was right. Key stays set forever (free
// re-trials of the same device must not replay a "first payment" celebration).
const ACTIVATED_KEY = "tg_paid_activated";
export function firstPaidActivation(plan) {
  if (plan === "trial" || plan === "free") return false;
  try { if (localStorage.getItem(ACTIVATED_KEY)) return false; } catch (e) { return false; }
  try { localStorage.setItem(ACTIVATED_KEY, "1"); } catch (e) {}
  return true;
}

// Which one-time funnel popup should be up right now — highest priority
// first (closing > halfway > welcome), null when none applies or it was
// already dismissed. plan comes from usePayment (effectivePlan), so paying
// members and admins never match.
export function convPopupFor(profile, plan) {
  if (plan !== "trial" || !profile || !profile.created_at) return null;
  const day = trialDay(profile);
  if (day < 1) return null;
  if (day >= trialLenDays(profile) - 1) return convSeen("d29") ? null : { id: "d29", kind: "closing", day };
  if (day >= 15) return convSeen("d15") ? null : { id: "d15", kind: "halfway", day };
  if (day <= 3) return convSeen("d0") ? null : { id: "d0", kind: "welcome", day };
  const d7 = convD7(profile, plan);
  if (d7) return d7;
  return null;
}

// Expired-trial win-back: free plan AND past the trial window (a profile can
// also be "free" from day one if signup predates the trial system — those get
// the nudge too, which is intended: same loss-aversion hook, softer framing).
export function convWinBack(profile, plan) {
  if (plan !== "free" || !profile || !profile.created_at) return null;
  if ((Date.now() - new Date(profile.created_at).getTime()) <= trialLenDays(profile) * 86400000) return null;
  return convSeen("wb") ? null : { id: "wb", kind: "winback", day: -1 };
}

/* ══ PERSONALIZED COPY (v3 Phase 1) ══
   v2's insight: the skeleton popups spoke generic praise while the learner's
   real before/after evidence sat one read away. These builders return the
   popup body text for d15/d29/d7/proof: PERSONALIZED when the proof data
   supports it (improvedCount >= 1), otherwise the ORIGINAL generic copy —
   a fallback, never a proud zero. Pure functions of (lang, proof) so the
   e2e asserts all three languages on the real module. */
export function personalizedBody(popupKind, lang, proof, generic) {
  const L = lang === "th" || lang === "zh" ? lang : "en";
  const hasProof = proof && proof.improvedCount >= 1 && proof.bestDelta != null;
  if (popupKind === "halfway" && hasProof) {
    return {
      th: `ครึ่งทางแล้ว — ครู TIGA ช่วยคุณแม่นขึ้น ${proof.improvedCount} จุด (ดีขึ้นถึง +${proof.bestDelta}%) จากการซ้อมจริงของคุณ\n\nสถิติทั้งหมดนี้เดินต่อเมื่อคุณล็อกราคาไว้ — สมาชิกที่ต่อก่อนทดลองหมด ล็อกราคาเดิมตลอดไป`,
      en: `Halfway there — Teacher TIGA has already improved ${proof.improvedCount} of your weak spots (up to +${proof.bestDelta}%) from your real practice.\n\nAll of this keeps building when you lock in your price — members who continue before the trial ends lock today's price for good.`,
      zh: `已过半程——TIGA 老师已帮你改善了 ${proof.improvedCount} 个薄弱点（最高 +${proof.bestDelta}%），全部来自你的真实练习。\n\n试用结束前续费即可永久锁定当前价格，这些进步会继续累积。`,
    }[L];
  }
  if (popupKind === "closing" && hasProof) {
    const sess = proof.sessions ? `${proof.sessions}${L === "th" ? " เซสชัน" : L === "zh" ? " 次练习" : " sessions"}, ` : "";
    return {
      th: `ทดลองใช้กำลังจบ — ของคุณที่กำลังจะหายไป: ${sess}ความจำ ${proof.improvedCount} จุดของครู (ดีขึ้น +${proof.bestDelta}%) และทุกสถิติที่สะสมมา\n\nหลังหมดอายุ: ครู AI ไม่จำกัด · สร้างเพลง · เกมทุกเกม · สมุดพก`,
      en: `Your trial is ending — what you're about to lose: ${sess}a teacher who improved ${proof.improvedCount} of your weak spots (+${proof.bestDelta}%), and every stat you built.\n\nAfter it ends: unlimited AI teacher · song creation · every game · practice book.`,
      zh: `试用即将结束——你将失去：${sess}已改善 ${proof.improvedCount} 个薄弱点的 AI 老师（+${proof.bestDelta}%），以及所有累计数据。\n\n到期后：AI老师不限次 · AI作曲 · 全部游戏 · 练习册。`,
    }[L];
  }
  if (popupKind === "d7proof" && hasProof) {
    return {
      th: `สัปดาห์แรกพิสูจน์แล้ว — หลังครู TIGA แนะนำ คุณแม่นขึ้น +${proof.bestDelta}% ในจุดที่เคยติด${proof.improvedCount > 1 ? ` (รวม ${proof.improvedCount} จุด)` : ""}\n\nผู้ที่ล็อกราคาตอนพิสูจน์ได้ จะได้ราคา 1,490฿ นี้ตลอดไป — ไม่มีขึ้นราคา`,
      en: `Proven in week one — after Teacher TIGA's coaching you improved +${proof.bestDelta}% on spots you used to miss${proof.improvedCount > 1 ? ` (${proof.improvedCount} spots)` : ""}.\n\nLock in while it's proven: 1,490฿/month, this price forever — never raised for you.`,
      zh: `第一周已验证——经 TIGA 老师指导，你在曾经常错的点上提升了 +${proof.bestDelta}%${proof.improvedCount > 1 ? `（共 ${proof.improvedCount} 个点）` : ""}。\n\n现在锁定价格：1,490฿/月，永久保持——永不上调。`,
    }[L];
  }
  if (popupKind === "proof" && hasProof) {
    return {
      th: `คำแนะนำของครูได้ผลจริง — จุดที่เคยติดของคุณดีขึ้น +${proof.bestDelta}%\n\nครูคนนี้จำความก้าวหน้าของคุณได้ทุกจุด ล็อกสิทธิ์ไว้หลังทดลองจบ (1,490฿/เดือน ราคาเดิมตลอดไป)`,
      en: `The coaching is working — your trouble spot improved +${proof.bestDelta}%.\n\nThis teacher remembers every step of your progress. Lock it in before the trial ends (1,490฿/mo, this price forever).`,
      zh: `指导见效了——你的薄弱点提升了 +${proof.bestDelta}%。\n\n这位老师记得你进步的每一步。试用结束前锁定权益（1,490฿/月，永久价格）。`,
    }[L];
  }
  return generic || null; // honest fallback: the original generic copy
}

/* ══ POST-PURCHASE ACTIVATION COPY (v3 Phase 5) ══
   Fired by App when firstPaidActivation(plan) returns true (exactly once per
   account). The anti-regret moment: within 60s of paying, ครู TIGA speaks to
   confirm the purchase was right and names the FIRST thing to do next —
   because buyer's remorse peaks in the first hour, and the teacher's voice
   (not a receipt) is what makes the member feel they bought a coach. */
export const ACTIVATION_COPY = {
  th: { ic: "💙", title: "ยินดีด้วย — ครูของคุณพร้อมแล้ว", body: "ขอบคุณที่ไว้วางใจให้ผมเป็นครูเปียโนของคุณนะ จากนี้ไปผมจะจำความก้าวหน้าของคุณทุกจุด วัดผลจริงหลังทุกการซ้อม และรายงานพัฒนาการให้ฟังทุกสัปดาห์\n\nเริ่มกันเลยไหม? ซ้อม 5 นาทีแรกของสมาชิกเป็นตัวอย่างให้ผมดูหน่อย — ผมจะจับจุดที่ควรพัฒนาให้เจอเอง", cta: "🎹 เริ่มซ้อมแรกกับครู", alt: "เดี๋ยวค่อยเริ่ม" },
  en: { ic: "💙", title: "Welcome — your teacher is ready", body: "Thank you for trusting me as your piano teacher. From now on I'll remember every step of your progress, measure real results after each practice, and report your growth every week.\n\nShall we start? Give me a 5-minute first session — I'll spot exactly what to work on.", cta: "🎹 Start first session", alt: "Later" },
  zh: { ic: "💙", title: "欢迎——你的老师已就位", body: "感谢你信任我成为你的钢琴老师。从现在起我会记住你进步的每一步，每次练习后测量真实效果，每周向你汇报成长。\n\n现在开始吗？给我5分钟的第一堂课——我会立刻找出该练什么。", cta: "🎹 开始第一课", alt: "稍后再说" },
};

// ── the one-time song-creation gift (decision 1A) ──────────────────────────
const GIFT_KEY = "tg_song_gift";
export function canUseSongGift() { try { return !localStorage.getItem(GIFT_KEY); } catch (e) { return false; } }
export function consumeSongGift() { try { localStorage.setItem(GIFT_KEY, "1"); } catch (e) {} }
