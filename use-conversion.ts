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
  },
  en: {
    bannerUrgent: "⏳ {n} days left — then you lose: unlimited AI teacher · song creation · games · practice book",
    bannerUrgentBtn: "Lock it in",
    welcome: { ic: "🎓", title: "Meet Teacher TIGA AI", body: "Welcome to TIGA.AI!\n\nFor the next 30 days everything is fully unlocked — unlimited AI teacher, song creation, every game. I'll guide you step by step like a real teacher and report your progress every week.", cta: "🚀 Start week one" },
    halfway: { ic: "📈", title: "Halfway there — great pace!", body: "You're past the first half of the 30-day program. Every stat, certificate and progress chart you've earned keeps building up.\n\nMembers who continue before the trial ends lock in today's price for good.", cta: "⭐ See membership plans" },
    closing: { ic: "⏳", title: "Almost over — what you're about to lose", body: "Your free trial ends soon. After that:", items: "♾️ Unlimited AI teacher\n🎵 AI song creation\n🎮 Every music game\n📋 Practice book + certificates", cta: "💳 Pay & continue (PromptPay)", alt: "Browse all plans" },
    winback: { ic: "🧠", title: "Teacher TIGA AI still remembers you", body: "All your progress, certificates and stats are exactly where you left them. You can continue right where you stopped — nothing is lost.", cta: "💙 Continue learning" },
  },
  zh: {
    bannerUrgent: "⏳ 还剩 {n} 天 — 到期后失去：AI老师不限次 · AI作曲 · 全部游戏 · 练习册",
    bannerUrgentBtn: "锁定权益",
    welcome: { ic: "🎓", title: "认识TIGA AI老师", body: "欢迎来到TIGA.AI！\n\n接下来30天所有功能全部开放——AI老师不限次、AI作曲、全部游戏。我会像真正的老师一样一步步带你学，每周向你汇报进步。", cta: "🚀 开始第一周" },
    halfway: { ic: "📈", title: "已过半程——非常棒！", body: "30天计划已过半，你的所有数据、证书和进步曲线都在持续累积。\n\n试用期内续费可永久锁定当前价格。", cta: "⭐ 查看会员套餐" },
    closing: { ic: "⏳", title: "即将到期——你将失去", body: "免费试用即将结束，届时：", items: "♾️ AI老师不限次\n🎵 AI作曲\n🎮 全部音乐游戏\n📋 练习册 + 证书", cta: "💳 立即扫码支付", alt: "查看全部套餐" },
    winback: { ic: "🧠", title: "TIGA AI老师还记得你", body: "你的全部进度、证书和统计都原样保存，随时可以接着学——什么都没有丢失。", cta: "💙 继续学习" },
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

// ── the one-time song-creation gift (decision 1A) ──────────────────────────
const GIFT_KEY = "tg_song_gift";
export function canUseSongGift() { try { return !localStorage.getItem(GIFT_KEY); } catch (e) { return false; } }
export function consumeSongGift() { try { localStorage.setItem(GIFT_KEY, "1"); } catch (e) {} }
