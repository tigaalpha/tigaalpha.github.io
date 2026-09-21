/* ── use-educate.ts ──
   Game-feature education engine (owner-approved plan 2026-09-19): pets,
   PvP arena, robot chassis and the shop are real, working features with
   real gameplay value (pets grant combat bonuses, PvP pays real coins/XP,
   the chest is a free daily drop) — but they live behind the Profile page,
   so most learners never discover them. This module surfaces ONE tip at a
   time at the exact moment the learner has a REASON to care:

     first-coins   after the first practice session pays coins
     profile       first visit to the Profile page (chest is still unopened)
     pet           coin balance reaches ~half of PET_COST (1500)
     shop          first time the shop is opened, or coins exceed 5000 with
                   nothing bought lately
     (chassis pick + PvP-loss→practice hints live at their call sites —
     they're contextual to those screens, not timed tips)

   Rules from the plan: each tip fires ONCE per device (same localStorage
   pattern as the conversion funnel), the caller must not show it while a
   conversion/broadcast popup is up (priority guard lives in App.tsx), and
   every tip's CTA navigates straight to the feature — never just "it's in
   the profile page somewhere". ── */

export const PET_COST_REF = 1500;   // pet-lab.tsx PET_COST — kept in sync manually
const SEEN_KEY = "tg_edu_seen";

export const EDU_COPY = {
  th: {
    firstCoins: { ic: "🪙", title: "เหรียญแรกของคุณ!", body: "เหรียญสะสมได้จากการซ้อมเปียโนทุกรอบ และอย่าลืมเปิดหีบสมบัติฟรีทุกวันที่หน้าโปรไฟล์ — ของข้างในสุ่มได้ทั้งเหรียญและไอเทม", cta: "🎁 ไปที่โปรไฟล์", go: "profile" },
    chest: { ic: "🎁", title: "หีบสมบัติของคุณรออยู่", body: "เปิดฟรีวันละ 1 ครั้ง ยิ่งซ้อมมาก ของข้างในยิ่งดี กดเลยก่อนหมดวันนี้", cta: "🎁 เปิดหีบเลย", go: "chest" },
    pet: { ic: "🐾", title: "ใกล้ได้สัตว์เลี้ยงแล้ว!", body: "สัตว์เลี้ยงไม่ใช่ของตกแต่ง — แต่ละตัวให้พลังต่างกันจริง เช่น ดาเมจ +10% ฟื้นเลือดทุกยก หรือเกจสกิลเร็ว +15% ใช้ได้ในสนามประลอง เก็บเหรียญอีกหน่อยก้อรับตัวแรกได้", cta: "🐾 ดูสัตว์เลี้ยง", go: "pet" },
    shop: { ic: "🛍️", title: "ร้านค้ามี 2 โลก", body: "หมวด Battle คือของใช้สู้จริง (สกินหุ่น สัตว์เลี้ยง อาวุธ) หมวด Studio คือของตกแต่ง (สกินเปียโน กรอบ ธีม) ลองเดินดู — ของถูกใจอาจถูกกว่าที่คิด", cta: "🛍️ เปิดร้านค้า", go: "shop" },
    rich: { ic: "🪙", title: "เหรียญเยอะแบบนี้ ใช้ให้คุ้มเลย", body: "คุณมีเหรียญพอซื้อของในร้านได้หลายชิ้นแล้ว — สัตว์เลี้ยงตัวใหม่หรือสกินหุ่นระดับหายาก รออยู่ อย่าเก็บไว้เฉย ๆ น่าเสียดาย", cta: "🛍️ ไปเลือกของ", go: "shop" },
  },
  en: {
    firstCoins: { ic: "🪙", title: "Your first coins!", body: "Coins come from every practice session — and don't forget the free daily treasure chest on the Profile page: coins and items, randomized inside.", cta: "🎁 Go to Profile", go: "profile" },
    chest: { ic: "🎁", title: "Your treasure chest is waiting", body: "One free open per day — the more you practice, the better the loot. Tap it before today's gone.", cta: "🎁 Open it now", go: "chest" },
    pet: { ic: "🐾", title: "A pet is within reach!", body: "Pets aren't decoration — each one grants a real combat bonus: +10% damage, healing every wave, or +15% skill gauge. Usable in the PvP Arena. A few more coins and your first one is yours.", cta: "🐾 Browse pets", go: "pet" },
    shop: { ic: "🛍️", title: "The shop has two worlds", body: "Battle gear actually fights (robot skins, pets, weapons); Studio gear decorates (piano skins, frames, themes). Have a look — favorites cost less than you'd think.", cta: "🛍️ Open the shop", go: "shop" },
    rich: { ic: "🪙", title: "That many coins — put them to work", body: "You can already afford several shop items — a new pet or a rare robot skin is waiting. Don't let them sit there.", cta: "🛍️ Pick something", go: "shop" },
  },
  zh: {
    firstCoins: { ic: "🪙", title: "你的第一枚金币！", body: "每次练琴都能赚金币，别忘了每天在个人主页免费开一次宝箱——里面随机有金币和道具。", cta: "🎁 去个人主页", go: "profile" },
    chest: { ic: "🎁", title: "你的宝箱在等你", body: "每天免费开一次——练得越多，奖品越好。趁今天还没结束赶紧开。", cta: "🎁 立即开箱", go: "chest" },
    pet: { ic: "🐾", title: "宠物近在咫尺！", body: "宠物不是装饰——每只都有真实战斗加成：伤害+10%、每波回血、技能槽+15%，在PvP竞技场里真正生效。再攒一点金币，第一只就是你的。", cta: "🐾 查看宠物", go: "pet" },
    shop: { ic: "🛍️", title: "商店有两个世界", body: "战斗装备真的能打（机体皮肤、宠物、武器）；工作室装备负责好看（钢琴皮肤、相框、主题）。逛逛吧——心仪的东西比想象中便宜。", cta: "🛍️ 打开商店", go: "shop" },
    rich: { ic: "🪙", title: "金币这么多，花在刀刃上", body: "你已经买得起好几件商店商品了——新宠物或稀有机体皮肤都在等你，别让它们闲置。", cta: "🛍️ 去挑一件", go: "shop" },
  },
};

function seenMap() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") || {}; } catch (e) { return {}; } }
export function eduSeen(id) { return !!seenMap()[id]; }
export function markEduSeen(id) { try { const m = seenMap(); m[id] = 1; localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch (e) {} }

/* The next tip worth showing, or null. Priority order matters: first-coins
   beats the profile tip for a brand-new learner (they'll see the chest hint
   on their first Profile visit anyway); the "rich" nudge outranks the plain
   shop intro once balances are high. Owners/admins get tips too — these
   features are for everyone, unlike the paid-funnel popups. */
export function eduTipFor({ coins = 0, chestAvail = false, firstCoinsSeen = false, shopOpenNow = false }) {
  if (!firstCoinsSeen) return { id: "firstCoins", kind: "firstCoins" };
  if (shopOpenNow && !eduSeen("shop")) return { id: "shop", kind: "shop" };
  if (coins >= 5000 && !eduSeen("rich")) return { id: "rich", kind: "rich" };
  if (coins >= Math.round(PET_COST_REF * 0.5) && !eduSeen("pet")) return { id: "pet", kind: "pet" };
  if (chestAvail && !eduSeen("chest")) return { id: "chest", kind: "chest" };
  return null;
}

/* PvP loss → practice hand-off (plan point 5): after a lost arena fight,
   point the learner at the weakest note category from their own result.
   weakKind is the arena's own category id of the most-missed questions. */
export function pvpLossCopy(weakKindLabel) {
  return {
    th: { title: "💪 ใกล้แล้ว!", body: `โน้ตที่ตอบช้าอยู่หมวด "${weakKindLabel}" — กลับไปซ้อมทางนั้นสัก 3 รอบ แล้วมาแก้มือดูอีกที หุ่นคุณมีสัตว์เลี้ยงช่วยด้วยนะ`, cta: "🎹 ซ้อมจุดอ่อนตอนนี้" },
    en: { title: "💪 So close!", body: `The slow answers were in "${weakKindLabel}" — three practice rounds there, then come back for a rematch. Your pet has your back.`, cta: "🎹 Practice that now" },
    zh: { title: "💪 就差一点！", body: `答得慢的题都在"${weakKindLabel}"——先去练三轮，再回来复仇。你的宠物会帮你的。`, cta: "🎹 现在就去练" },
  };
}
