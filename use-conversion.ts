/* ── use-conversion.ts ──
   Trial-conversion funnel (owner decision 2026-10-04). The trial is now SEVEN
   days at FULL MAX level (see isMaxPlan in payment.tsx), so the day-based
   skeleton was re-cut to fit a week:

     d1–3   welcome    meet ครู TIGA AI, set the 7-day expectation
     d5–6   d7proof    the learner's OWN before/after numbers, only when
                        there is real evidence behind them (never a proud +0)
     d7     closing    "today is the LAST day" + exactly what Max unlocks,
                        CTA opens the CheckoutModal for Max in one tap (3A)
     expired win-back  teacher still remembers you — nothing is lost (4A)

   The old thirty-day ladder had a halfway price-lock at d15–28 that a
   seven-day trial can never reach, so it was removed from the probe instead
   of left as dead code pretending to run.

   Every popup is dismissed-once-per-trial via localStorage, never re-fires
   for paying members (plan is neither a trial nor "free") or admins
   (effectivePlan maps them to "premium", so they never match either branch).
   There is one trial now, but it is still reached through isTrialPlan()
   rather than a string compare — that is what keeps a legacy "trialmax" row
   in the funnel instead of silently skipping the member.

   Also owns the one-time song-creation GIFT for free members (decision 1A):
   the free card advertises creation as locked; the gift lets a free member
   taste it exactly once, ever — the "wow" moment that makes upgrading feel
   earned rather than gated. Lifetime-once via localStorage, deliberately
   separate from the day-bucketed tg_usage counters (those reset daily). ── */

import { trialLenDays, isTrialPlan, canonicalPlan, PLAN_PRICE } from "./payment";

/* ══ WHICH COPY A TRIAL GETS ══════════════════════════════════════════════
   There is one answer now. The funnel used to split on the promotion cohort —
   first 10,000 signups were quoted Max at ฿3,999, everyone after the cap was
   quoted Premium at ฿1,490 — because there genuinely were two paid tiers to
   land on. There is one now (owner, 2026-10-04), so every reader of this file
   gets the same Premium table and the same ฿1,490.

   The old signature took the plan so it could pick a table; the parameter is
   kept so the callers do not change, and it is deliberately IGNORED rather
   than quietly reintroduced — a member who somehow still carries "max" must
   hear about the plan they can actually buy, not one that is gone.

   Prices are never typed as literals. They come from PLAN_PRICE, the same
   table the checkout charges from, so a price change in one place cannot
   leave the funnel quoting a number nobody was ever offered. */
const fmtThb = (n) => n.toLocaleString("en-US");   // 1490 -> "1,490"
export function trialPriceThb(_plan) { return fmtThb(PLAN_PRICE.premium); }
export function trialTierName(_plan) { return "Premium"; }
/* The plan the closing CTA should open checkout for — the only sellable tier. */
export function convCheckoutTier(_plan) { return "premium"; }
export function convCopyFor(lang, _plan) { return CONV_COPY[lang] || CONV_COPY.en; }

/* ── the funnel copy, built from the tier ──────────────────────────────────
   ONE table, parameterised by (tier name, price, what-you-lose, perks). The
   old code had the prices typed in as literals — "3,999" in eight places —
   which is exactly how the previous build ended up quoting 1,490฿ (the
   Premium price) while giving away a Max trial. They now come from PLAN_PRICE,
   the same object the checkout charges from, so there is no second copy of the
   number to forget.

   Tier words and prices are the ONLY differences between the promotion cohort
   (Max) and everyone after the 10,000 cap (Premium). The shape of the
   messages — welcome, first-week proof, last-day warning, win-back — is
   identical, because the promotion changes what the seven days are worth, not
   what the seven days are. */
function copyTable(t) {
  const { name, price, perks } = t;
  return {
    th: {
      bannerUrgent: `⏳ อีก {n} วัน — หลังจบ ${name} จะหมด: ${perks.th}`,
      bannerUrgentBtn: `ต่อ ${name}`,
      winbackAlt: "ดูทุกแพ็กเกจ",
      welcome: { ic: "🎓", title: "ครู TIGA AI มาแนะนำตัว", body: `ยินดีต้อนรับสู่ TIGA.AI!\n\n7 วันข้างหน้าคุณได้ ${name} เต็มรูปแบบ — ครู AI ไม่จำกัด ${perks.th} และเกมทุกเกม ผมจะพาเรียนทีละขั้นแบบครูตัวจริง`, cta: "🚀 เริ่มวันแรกกันเลย" },
      closing: { ic: "⏳", title: "วันสุดท้ายของการทดลองเล่นฟรี 7 วัน", body: `วันนี้เป็นวันสุดท้ายของการทดลองเล่นฟรี 7 วัน หากอยากใช้แพ็กเกจ ${name} ต่อ กรุณาจ่ายเงินต่อเดือน ${price} บาท`, items: perks.items, cta: `💳 ต่อ ${name} ${price} บาท/เดือน`, alt: "ดูทุกแพ็กเกจ" },
      winback: { ic: "🧠", title: "ครู TIGA AI ยังจำคุณได้", body: "ทุกความก้าวหน้า ใบประกาศ และสถิติของคุณยังเก็บอยู่ครบถ้วน กลับมาเรียนต่อได้ทันทีเลย — ไม่มีอะไรหายไป", cta: "💙 กลับมาเรียนต่อ" },
      // v3 kinds — body is normally overridden by personalizedBody() with the
      // learner's own numbers; these bodies are the defensive generic fallback.
      d7proof: { ic: "🏅", title: "พิสูจน์แล้วในสัปดาห์แรก", body: `คำแนะนำของครู TIGA ได้ผลจริงกับการซ้อมของคุณ\n\n${name} ต่อได้วันนี้ที่ ${price} บาท/เดือน`, cta: `⭐ ต่อ ${name} ${price} บาท/เดือน` },
      proof: { ic: "📈", title: "ครูคนนี้ทำให้คุณดีขึ้นจริง", body: `จุดที่เคยติดของคุณดีขึ้นจากการซ้อมจริง\n\nเก็บครูคนนี้ไว้หลังทดลองจบ — ${name} ${price} บาท/เดือน`, cta: `⭐ ต่อ ${name} ไว้เลย` },
    },
    en: {
      bannerUrgent: `⏳ {n} days left — then ${name} ends: ${perks.en}`,
      bannerUrgentBtn: `Keep ${name}`,
      winbackAlt: "Browse all plans",
      welcome: { ic: "🎓", title: "Meet Teacher TIGA AI", body: `Welcome to TIGA.AI!\n\nFor the next 7 days you get the full ${name} plan — unlimited AI teacher, ${perks.en}, and every game. I'll guide you step by step like a real teacher.`, cta: "🚀 Start day one" },
      closing: { ic: "⏳", title: "Last day of your 7-day free trial", body: `Today is the last day of your 7-day free trial. To keep the ${name} plan, pay ${price} baht per month.`, items: perks.itemsEn, cta: `💳 Keep ${name} — ฿${price}/month`, alt: "Browse all plans" },
      winback: { ic: "🧠", title: "Teacher TIGA AI still remembers you", body: "All your progress, certificates and stats are exactly where you left them. You can continue right where you stopped — nothing is lost.", cta: "💙 Continue learning" },
      d7proof: { ic: "🏅", title: "Proven in week one", body: `Teacher TIGA's coaching is already working on your real practice.\n\nKeep ${name} from today at ${price} baht per month.`, cta: `⭐ Keep ${name} — ${price}฿/month` },
      proof: { ic: "📈", title: "The coaching is working", body: `Your trouble spots are improving from real practice.\n\nKeep this teacher after the trial — ${name} at ${price} baht per month.`, cta: `⭐ Keep ${name}` },
    },
    zh: {
      bannerUrgent: `⏳ 还剩 {n} 天 — 到期后 ${name} 结束：${perks.zh}`,
      bannerUrgentBtn: `续费 ${name}`,
      winbackAlt: "查看全部套餐",
      welcome: { ic: "🎓", title: "认识TIGA AI老师", body: `欢迎来到TIGA.AI！\n\n接下来7天你将获得完整 ${name} 套餐——AI老师不限次、${perks.zh}、以及所有游戏。我会像真正的老师一样一步步带你学。`, cta: "🚀 开始第一天" },
      closing: { ic: "⏳", title: "7 天免费试用的最后一天", body: `今天是 7 天免费试用的最后一天。如需继续使用 ${name} 套餐，请每月支付 ${price} 泰铢。`, items: perks.itemsZh, cta: `💳 续费 ${name} ฿${price}/月`, alt: "查看全部套餐" },
      winback: { ic: "🧠", title: "TIGA AI老师还记得你", body: "你的全部进度、证书和统计都原样保存，随时可以接着学——什么都没有丢失。", cta: "💙 继续学习" },
      d7proof: { ic: "🏅", title: "第一周已验证", body: `TIGA 老师的指导对你的真实练习已经见效。\n\n今天起以 ${price} 泰铢/月 继续使用 ${name}。`, cta: `⭐ 续费 ${name} ฿${price}/月` },
      proof: { ic: "📈", title: "指导见效了", body: `你的薄弱点正在真实练习中改善。\n\n试用结束后保留这位老师——${name} ${price} 泰铢/月。`, cta: `⭐ 续费 ${name}` },
    },
  };
}

/* The one trial table. Its perk list is the UNION of what the two old tables
   advertised: Premium's AI song creation and games, and the Max/Max Family
   items (live voice teacher, every exclusive piece, Daily Mentor, the weekly
   AI report) — because Premium now contains all of them. Leaving the Max items
   out would have made the funnel advertise LESS than the plan it is selling,
   which is the one mistake here that would cost actual money. */
export const CONV_COPY = copyTable({
  name: "Premium",
  price: fmtThb(PLAN_PRICE.premium),
  perks: {
    th: "ครูเสียงพูดคุยสด · เพลง Exclusive · สร้างเพลง AI · ทุกเกม",
    en: "a live voice teacher, every exclusive piece, AI song creation, every game",
    zh: "实时语音老师、全部独家曲目、AI作曲、全部游戏",
    items: "♾️ ครู AI 10 คำถาม/วัน\n🎙️ ครูเสียงพูดคุยสด\n👑 เพลง Exclusive ทั้งหมด\n🎵 สร้างเพลง AI\n🎮 เกมดนตรีทุกเกม\n📊 Daily Mentor + รายงานรายสัปดาห์",
    itemsEn: "♾️ AI tutor, 10 questions/day\n🎙️ Live voice teacher\n👑 Every exclusive piece\n🎵 AI song creation\n🎮 Every music game\n📊 Daily Mentor + weekly AI report",
    itemsZh: "♾️ AI老师 10个提问/天\n🎙️ 实时语音老师\n👑 全部独家曲目\n🎵 AI作曲\n🎮 全部音乐游戏\n📊 Daily Mentor + 每周AI报告",
  },
});

/* Kept as a name because it was imported as the non-promotion table; it is the
   same object now, and saying so is better than deleting an export that a
   reader would assume had moved. */
export const STANDARD_COPY = CONV_COPY;

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

// ── first-week proof popup ───────────────────────────────────────────────
// The funnel is silent d4 — exactly where a learner's first closed loop
// lands. Shows ONCE, only when there is a real improved outcome to speak (no
// evidence → no popup; the skeleton funnels handle those). Stopped one day
// short of the trial end on purpose: the LAST day belongs to the closing
// "today is your last day" popup, and two sales popups on the same day is
// exactly the nudge fatigue the one-sell-per-day gate exists to prevent.
export function convD7(profile, plan) {
  if (!isTrialPlan(plan) || !profile || !profile.created_at) return null;
  const day = trialDay(profile);
  if (day < 5 || day > trialLenDays(profile) - 1 || convSeen("d7")) return null;
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
  if (!isTrialPlan(plan) || !profile) return null;
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
  if (isTrialPlan(plan) || canonicalPlan(plan) === "free") return false;
  try { if (localStorage.getItem(ACTIVATED_KEY)) return false; } catch (e) { return false; }
  try { localStorage.setItem(ACTIVATED_KEY, "1"); } catch (e) {}
  return true;
}

// Which one-time funnel popup should be up right now — highest priority
// first (closing > welcome > proof), null when none applies or it was
// already dismissed. plan comes from usePayment (effectivePlan), so paying
// members and admins never match.
//
// `closing` fires on the LAST day of the trial exactly (day >= trialLenDays),
// not the day before it as the old thirty-day ladder did: with a seven-day
// trial, "the day before it ends" is already day 6, and the owner asked for
// the warning to read as "today is your last day" on day 7 itself.
export function convPopupFor(profile, plan) {
  if (!isTrialPlan(plan) || !profile || !profile.created_at) return null;
  const day = trialDay(profile);
  if (day < 1) return null;
  if (day >= trialLenDays(profile)) return convSeen("closing") ? null : { id: "closing", kind: "closing", day };
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
   popup body text for closing/d7proof/proof: PERSONALIZED when the proof data
   supports it (improvedCount >= 1), otherwise the ORIGINAL generic copy —
   a fallback, never a proud zero. Pure functions of (lang, proof) so the
   e2e asserts all three languages on the real module.

   The old "halfway" builder is gone with the d15 phase it served: a
   seven-day trial never reaches day 15, so it could only ever return dead
   copy.

   `plan` is the trial tier this member is actually on, and every price and
   tier name below is read from PLAN_PRICE through trialPriceThb/trialTierName.
   The earlier build hard-coded 3,999฿ while the table it belonged to quoted
   1,490฿ — the funnel and its own copy disagreed about what it was selling. */
export function personalizedBody(popupKind, lang, proof, generic, plan) {
  const L = lang === "th" || lang === "zh" ? lang : "en";
  const price = trialPriceThb(plan);
  const tier = trialTierName(plan);
  const hasProof = proof && proof.improvedCount >= 1 && proof.bestDelta != null;
  if (popupKind === "closing" && hasProof) {
    const sess = proof.sessions ? `${proof.sessions}${L === "th" ? " เซสชัน" : L === "zh" ? " 次练习" : " sessions"}, ` : "";
    return {
      th: `วันนี้เป็นวันสุดท้ายของการทดลองเล่นฟรี 7 วัน — ของคุณที่จะหายไป: ${sess}ความจำ ${proof.improvedCount} จุดของครู (ดีขึ้น +${proof.bestDelta}%) และทุกสถิติที่สะสมมา\n\nหากอยากใช้แพ็กเกจ ${tier} ต่อ กรุณาจ่ายเงินต่อเดือน ${price} บาท`,
      en: `Today is the last day of your 7-day free trial — what you'd lose: ${sess}a teacher who improved ${proof.improvedCount} of your weak spots (+${proof.bestDelta}%), and every stat you built.\n\nTo keep the ${tier} plan, pay ${price} baht per month.`,
      zh: `今天是 7 天免费试用的最后一天——你将失去：${sess}已改善 ${proof.improvedCount} 个薄弱点的 AI 老师（+${proof.bestDelta}%），以及所有累计数据。\n\n如需继续使用 ${tier} 套餐，请每月支付 ${price} 泰铢。`,
    }[L];
  }
  if (popupKind === "d7proof" && hasProof) {
    return {
      th: `สัปดาห์แรกพิสูจน์แล้ว — หลังครู TIGA แนะนำ คุณแม่นขึ้น +${proof.bestDelta}% ในจุดที่เคยติด${proof.improvedCount > 1 ? ` (รวม ${proof.improvedCount} จุด)` : ""}\n\n${tier} ต่อได้วันนี้ที่ ${price} บาท/เดือน — เท่าราคาแผน ${tier} ตามปกติ`,
      en: `Proven in week one — after Teacher TIGA's coaching you improved +${proof.bestDelta}% on spots you used to miss${proof.improvedCount > 1 ? ` (${proof.improvedCount} spots)` : ""}.\n\nKeep ${tier} from today: ${price} baht per month, the normal ${tier} price.`,
      zh: `第一周已验证——经 TIGA 老师指导，你在曾经常错的点上提升了 +${proof.bestDelta}%${proof.improvedCount > 1 ? `（共 ${proof.improvedCount} 个点）` : ""}。\n\n今天起续费 ${tier}：${price} 泰铢/月，即 ${tier} 套餐正常价格。`,
    }[L];
  }
  if (popupKind === "proof" && hasProof) {
    return {
      th: `คำแนะนำของครูได้ผลจริง — จุดที่เคยติดของคุณดีขึ้น +${proof.bestDelta}%\n\nครูคนนี้จำความก้าวหน้าของคุณได้ทุกจุด เก็บไว้หลังทดลองจบ (${tier} ${price} บาท/เดือน)`,
      en: `The coaching is working — your trouble spot improved +${proof.bestDelta}%.\n\nThis teacher remembers every step of your progress. Keep it after the trial (${tier} at ${price} baht per month).`,
      zh: `指导见效了——你的薄弱点提升了 +${proof.bestDelta}%。\n\n这位老师记得你进步的每一步。试用结束后保留（${tier} ${price} 泰铢/月）。`,
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
