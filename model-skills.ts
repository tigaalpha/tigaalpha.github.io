/* ── model-skills.ts ──
   Every chassis is a class, and every class plays the duel differently.

   The duel these are for is a music quiz: two players answer questions about
   notes, rhythm, intervals and scales, and the answers drive a fight. So the
   skills act on the QUIZ, not on some abstract battle — they buy time, strip a
   wrong option, protect the first mistake in a category, turn a streak into
   damage. A skill that only said "+20% damage" would be a stat in disguise;
   these change how a round is played, which is what makes picking RONIN feel
   different from picking PIP rather than just looking different.

   Three per model, in the usual shape: a PASSIVE that is always true, an ACTIVE
   on a cooldown, and an ULTIMATE once per duel. Icons reuse the item-art
   archetypes so the skill sheet is drawn in the same language as the shop.

   Balance note: the four combat stats already total the same 40 on every
   chassis (see MODEL_COMBAT). Skills are deliberately NOT balanced by raw
   number — they are balanced by condition. REAPER's passive is huge and only
   fires when the opponent is nearly down; KEEPER's is small and always on. ── */

export const MODEL_CLASS = {
  striker:   { th: "สายจู่โจม",   en: "Striker",   zh: "突击系", c: "#e0563f", art: "sword" },
  bulwark:   { th: "สายป้องกัน",  en: "Bulwark",   zh: "守护系", c: "#3d86c6", art: "shield" },
  ghost:     { th: "สายลอบเร้น",  en: "Ghost",     zh: "潜行系", c: "#7b3fd0", art: "eye" },
  tactician: { th: "สายวางแผน",   en: "Tactician", zh: "策略系", c: "#2fa87a", art: "scope" },
  engineer:  { th: "สายช่างกล",   en: "Engineer",  zh: "工程系", c: "#c98f2a", art: "wrench" },
  herald:    { th: "สายประสาน",   en: "Herald",    zh: "协奏系", c: "#c0603f", art: "speaker" },
  virtuoso:  { th: "สายบรรเลง",   en: "Virtuoso",  zh: "演奏系", c: "#d0559a", art: "keytar" },
};

export const TIER_LABEL = {
  passive:  { th: "ติดตัว",   en: "Passive",  zh: "被动" },
  active:   { th: "ใช้งาน",   en: "Active",   zh: "主动" },
  ultimate: { th: "ไม้ตาย",   en: "Ultimate", zh: "终极" },
};

const sk = (tier, art, th, en, zh, dth, den, dzh) =>
  ({ tier, art, n: { th, en, zh }, d: { th: dth, en: den, zh: dzh } });

export const MODEL_SKILLS = {
  /* ── STRIKERS ── the damage is real and so is the exposure */
  vanguard: { cls: "striker", skills: [
    sk("passive", "chip", "แรงส่งสะสม", "Momentum Rounds", "动量弹链",
       "ตอบถูกติดกัน ดาเมจ +8% ต่อครั้ง สูงสุด +40%",
       "Each answer right in a row adds 8% damage, up to 40%.",
       "连续答对每次伤害 +8%，最高 +40%。"),
    sk("active", "blaster", "ระดมยิง", "Suppressing Fire", "压制射击",
       "ยิงรัวหนึ่งชุด ดาเมจตามจำนวนข้อที่ตอบถูกในยกนี้",
       "A burst whose damage counts every question you got right this round.",
       "一轮扫射，伤害按本回合答对题数计算。"),
    sk("ultimate", "burst", "โหมดล่าสังหาร", "Termination Mode", "终结模式",
       "3 ข้อถัดไป ดาเมจ ×2 แต่ตอบผิดก็เสียเลือด ×2",
       "For three questions: double damage dealt, double damage taken on a miss.",
       "接下来三题：伤害翻倍，答错受伤也翻倍。") ] },
  reaper: { cls: "striker", skills: [
    sk("passive", "beam", "ไร้ปรานี", "Ruthless", "无情",
       "เมื่อเลือดคู่ต่อสู้ต่ำกว่า 40% ดาเมจ +25%",
       "Below 40% opponent health, your damage rises 25%.",
       "对手血量低于 40% 时，伤害 +25%。"),
    sk("active", "grenade", "ตัดวงจร", "Execute Protocol", "处决协议",
       "ดาเมจคิดจากเลือดที่คู่ต่อสู้เสียไปแล้ว ยิ่งเจ็บยิ่งแรง",
       "Damage scales with health the opponent has already lost.",
       "伤害按对手已损失的血量计算。"),
    sk("ultimate", "charge", "วงจรไหม้", "Scorched Circuit", "焦化回路",
       "เสียเลือดตัวเอง 15% เพื่อทำดาเมจ 40%",
       "Burn 15% of your own health to deal 40%.",
       "自损 15% 血量，造成 40% 伤害。") ] },
  ronin: { cls: "striker", skills: [
    sk("passive", "sword", "ไอไอโด", "Iaido", "居合",
       "ถ้าตอบถูกก่อนคู่ต่อสู้ ดาเมจ +30%",
       "Answer right before your opponent does and hit 30% harder.",
       "比对手先答对，伤害 +30%。"),
    sk("active", "cutter", "วิถีดาบเดียว", "Single Stroke", "一刀流",
       "ดาเมจมหาศาล แต่ตอบผิดคือพลาดทั้งตา",
       "Enormous damage — but a wrong answer wastes the whole turn.",
       "巨额伤害，但答错则整回合落空。"),
    sk("ultimate", "boomerang", "ระบำดาบ", "Blade Dance", "剑舞",
       "โจมตี 3 ครั้งติดกัน ครั้งละ 40% ของดาเมจปกติ",
       "Three strikes in a row at 40% damage each.",
       "连续三击，每击 40% 伤害。") ] },
  talon: { cls: "striker", skills: [
    sk("passive", "scope", "ไม่มีพลาด", "No Miss", "无失",
       "การโจมตีของคุณทะลุการหลบทุกชนิด",
       "Your attacks cannot be dodged.",
       "你的攻击无法被闪避。"),
    sk("active", "beam", "ล็อกเป้าหมาย", "Target Lock", "目标锁定",
       "2 ข้อถัดไป ดาเมจ +20% และทะลุโล่",
       "For two questions: 20% more damage, and shields do not stop it.",
       "接下来两题：伤害 +20%，无视护盾。"),
    sk("ultimate", "burst", "ห่วงโซ่สังหาร", "Kill Chain", "杀戮链",
       "ตอบถูกติด 3 ข้อ แล้วปล่อยดาเมจรวมทั้งหมดทีเดียว",
       "Chain three right answers, then release all of it at once.",
       "连答对三题后，一次性释放全部伤害。") ] },

  /* ── BULWARKS ── they win by still being there */
  sentinel: { cls: "bulwark", skills: [
    sk("passive", "shield", "เกราะเสริมแรง", "Hardened Plating", "强化装甲",
       "ดาเมจที่ได้รับลดลง 15% ตลอดการต่อสู้",
       "All damage taken is reduced by 15%.",
       "全程受到的伤害降低 15%。"),
    sk("active", "barrier", "ตั้งโล่กำบัง", "Bulwark Stance", "壁垒姿态",
       "ดูดซับดาเมจครั้งถัดไปทั้งหมด",
       "Absorb the next hit completely.",
       "完全吸收下一次伤害。"),
    sk("ultimate", "helm", "โปรโตคอลป้อมปราการ", "Fortress Protocol", "堡垒协议",
       "3 ข้อถัดไป ตอบผิดไม่เสียเลือด แต่ตอบถูกก็ไม่ทำดาเมจ",
       "Three questions where mistakes cost nothing — and right answers deal nothing.",
       "三题内答错不掉血，但答对也不造成伤害。") ] },
  atlas: { cls: "bulwark", skills: [
    sk("passive", "limb", "ไม่มีอะไรขยับได้", "Unmovable", "不动如山",
       "ไม่ติดผลลดความเร็วหรือลดเวลาตอบใดๆ",
       "Immune to every slow and every clock cut.",
       "免疫一切减速与缩时效果。"),
    sk("active", "shield", "ยืนรับแทน", "Take The Hit", "代为承受",
       "ดูดซับดาเมจ 2 ข้อ แล้วสะท้อนกลับครึ่งหนึ่ง",
       "Soak two questions' damage, then return half of it.",
       "吸收两题伤害，并反弹一半。"),
    sk("ultimate", "plate", "กำแพงไททัน", "Titan Wall", "泰坦之墙",
       "เลือดสูงสุด +30% และฟื้นเต็มส่วนที่เพิ่มมาทันที",
       "Raise max health 30% and immediately fill the new space.",
       "最大生命 +30%，并立刻填满新增部分。") ] },
  mochi: { cls: "bulwark", skills: [
    sk("passive", "plate", "นุ่มจนไม่เจ็บ", "Squish", "软化",
       "ดาเมจที่รับต่อครั้งไม่เกิน 12% ของเลือดสูงสุด",
       "No single hit can take more than 12% of your health.",
       "单次受伤不超过最大生命的 12%。"),
    sk("active", "orb", "ดูดซับแรงกระแทก", "Squish Absorb", "软化吸收",
       "เก็บดาเมจที่รับไว้ แล้วคืนกลับเป็นเลือดครึ่งหนึ่ง",
       "Store the damage you take, then convert half of it back to health.",
       "储存所受伤害，将其中一半转回生命。"),
    sk("ultimate", "fusion", "กอดอุ่นๆ", "Warm Hug", "温暖拥抱",
       "ฟื้นเลือด 35% และล้างผลติดลบทั้งหมด",
       "Heal 35% and clear every negative effect.",
       "恢复 35% 生命并清除所有负面效果。") ] },

  /* ── GHOSTS ── they win by not being hit */
  phantom: { cls: "ghost", skills: [
    sk("passive", "eye", "ผิวเลียนแบบ", "Mimetic Skin", "拟态外壳",
       "มีโอกาส 20% หลบดาเมจทั้งหมด",
       "A 20% chance to avoid any hit entirely.",
       "20% 几率完全闪避任何伤害。"),
    sk("active", "trail", "เปลี่ยนรูปหลบ", "Mimic Dodge", "拟态闪避",
       "ข้อถัดไป ตอบผิดก็ไม่เสียเลือด",
       "The next question costs nothing if you get it wrong.",
       "下一题答错不掉血。"),
    sk("ultimate", "orb", "หล่อขึ้นรูปใหม่", "Liquid Reform", "液态重塑",
       "ฟื้นเลือด 25% และล้างผลติดลบทั้งหมด",
       "Reform: heal 25% and clear every negative effect.",
       "重塑：恢复 25% 生命并清除负面效果。") ] },
  specter: { cls: "ghost", skills: [
    sk("passive", "eye", "กลมกลืน", "Blend In", "融入",
       "คู่ต่อสู้มองไม่เห็นเลือดจริงของคุณ",
       "Your real health is hidden from your opponent.",
       "对手无法看到你的真实血量。"),
    sk("active", "chip", "แฝงตัวเข้าใกล้", "Infiltrate", "潜入",
       "ขโมยซิงค์ของคู่ต่อสู้ 30%",
       "Steal 30% of your opponent's sync.",
       "窃取对手 30% 的同步值。"),
    sk("ultimate", "trail", "โปรโตคอลไร้ตัวตน", "Ghost Protocol", "幽灵协议",
       "2 ข้อถัดไป ไม่รับดาเมจเลย",
       "Take no damage at all for two questions.",
       "两题内完全不受伤害。") ] },
  pebble: { cls: "ghost", skills: [
    sk("passive", "gyro", "กลิ้งหลบ", "Roll Away", "滚动闪避",
       "ตอบผิดครั้งแรกของทุกยกไม่เสียเลือด",
       "The first mistake of every round is free.",
       "每回合第一次答错不掉血。"),
    sk("active", "boomerang", "เด้งเปลี่ยนข้อ", "Bounce", "弹跳换题",
       "เปลี่ยนคำถามข้อปัจจุบันเป็นข้อใหม่",
       "Swap the current question for a different one.",
       "将当前题目换成另一题。"),
    sk("ultimate", "thruster", "เร่งสุดแรง", "Full Tilt", "全速",
       "4 ข้อถัดไป ความเร็วเป็นสองเท่า",
       "Double speed for four questions.",
       "接下来四题速度翻倍。") ] },

  /* ── TACTICIANS ── they win by knowing first */
  scout: { cls: "tactician", skills: [
    sk("passive", "scope", "อ่านเกมล่วงหน้า", "Preconstruct", "预演推算",
       "เห็นหมวดของคำถามข้อถัดไปก่อนเสมอ",
       "You always see what the next question is about before it arrives.",
       "总能提前看到下一题的类别。"),
    sk("active", "chip", "วิเคราะห์", "Analyse", "分析",
       "ตัดตัวเลือกที่ผิดออก 2 ข้อ",
       "Strike two wrong options off the current question.",
       "从当前题目中划去两个错误选项。"),
    sk("ultimate", "gyro", "จำลองย้อนเวลา", "Reconstruction", "情景重建",
       "ย้อนคำตอบผิดล่าสุดของคุณ แล้วตอบใหม่",
       "Rewind your last wrong answer and take it again.",
       "回溯你最近一次答错，并重新作答。") ] },
  sentry: { cls: "tactician", skills: [
    sk("passive", "battery", "ของมาตรฐานกองทัพ", "Standard Issue", "标准配给",
       "ทักษะทุกอย่างของคุณคูลดาวน์เร็วขึ้น 20%",
       "All your skills come back 20% sooner.",
       "所有技能冷却缩短 20%。"),
    sk("active", "blaster", "สั่งยิงพร้อมกัน", "Volley Order", "齐射指令",
       "ยิงชุด 3 นัด นัดละไม่มาก แต่ทะลุโล่ทุกนัด",
       "Three small shots — every one of them ignores shields.",
       "三次小额射击，全部无视护盾。"),
    sk("ultimate", "drone", "เรียกกำลังเสริม", "Reinforcements", "增援",
       "2 ข้อถัดไป ตอบถูกทำดาเมจสองเท่า",
       "Right answers deal double damage for two questions.",
       "接下来两题答对造成双倍伤害。") ] },
  pixel: { cls: "tactician", skills: [
    sk("passive", "chip", "แม่นทุกพิกเซล", "Pixel Perfect", "像素级精准",
       "คำถามอ่านโน้ต ตอบถูกทำดาเมจ +25%",
       "Note-reading questions hit 25% harder when you get them right.",
       "读谱题答对伤害 +25%。"),
    sk("active", "pad", "ลวงหน้าจอ", "Screen Feint", "屏幕虚招",
       "ซ่อนคำตอบของคุณจากคู่ต่อสู้ 2 ข้อ",
       "Hide your answers from your opponent for two questions.",
       "两题内对手看不到你的作答。"),
    sk("ultimate", "burst", "กลิตช์", "Glitch", "故障",
       "สลับตำแหน่งตัวเลือกของคู่ต่อสู้ 3 ข้อ",
       "Scramble your opponent's answer buttons for three questions.",
       "三题内打乱对手的选项顺序。") ] },

  /* ── ENGINEERS ── they win by lasting */
  pip: { cls: "engineer", skills: [
    sk("passive", "scope", "สแกนวินิจฉัย", "Diagnostics", "诊断扫描",
       "เห็นว่าคู่ต่อสู้อ่อนหมวดไหนที่สุด",
       "You can see which category your opponent is weakest in.",
       "可以看到对手最弱的题型。"),
    sk("active", "wrench", "ซ่อมกลางสนาม", "Field Repair", "战地维修",
       "ฟื้นเลือด 20%",
       "Patch yourself up for 20% health.",
       "恢复 20% 生命。"),
    sk("ultimate", "coil", "โอเวอร์คล็อก", "Overclock", "超频",
       "3 ข้อถัดไป เวลาตอบ +50% และซิงค์ ×2",
       "Three questions with 50% more time and double sync.",
       "接下来三题作答时间 +50%，同步值翻倍。") ] },
  nova: { cls: "engineer", skills: [
    sk("passive", "battery", "หนุนพลังตั้งต้น", "Assist Boost", "初始助推",
       "เริ่มทุกยกด้วยซิงค์ +3",
       "Every round starts you 3 sync ahead.",
       "每回合开局同步值 +3。"),
    sk("active", "plug", "ชาร์จใหม่", "Recharge", "再充能",
       "ลดคูลดาวน์ทักษะทั้งหมดของคุณลงหนึ่งตา",
       "Take a turn off every one of your cooldowns.",
       "所有技能冷却减少一回合。"),
    sk("ultimate", "fusion", "ซูเปอร์โนวา", "Supernova", "超新星",
       "เปลี่ยนซิงค์ที่สะสมทั้งหมดเป็นดาเมจ แล้วฟื้นเลือดครึ่งหนึ่งของนั้น",
       "Spend all stored sync as damage, then heal for half of it.",
       "将全部同步值转为伤害，并回复其一半为生命。") ] },

  /* ── HERALDS ── they win by changing the terms */
  envoy: { cls: "herald", skills: [
    sk("passive", "chip", "หกล้านรูปแบบภาษา", "Six Million Forms", "百万语系",
       "คำถามที่มีศัพท์ดนตรีต่างประเทศ ได้ซิงค์สองเท่า",
       "Questions using foreign musical terms give double sync.",
       "含外语音乐术语的题目获得双倍同步值。"),
    sk("active", "speaker", "แปลให้", "Translate", "翻译",
       "เปิดเผยตัวเลือกที่ผิดหนึ่งข้อ",
       "Reveal one wrong option.",
       "揭示一个错误选项。"),
    sk("ultimate", "barrier", "เอกสิทธิ์ทางการทูต", "Diplomatic Immunity", "外交豁免",
       "ยกเลิกไม้ตายของคู่ต่อสู้หนึ่งครั้ง",
       "Cancel your opponent's ultimate, once.",
       "取消对手的终极技能一次。") ] },
  keeper: { cls: "herald", skills: [
    sk("passive", "shield", "ปกป้องคนข้างหลัง", "Shelter", "庇护",
       "ตอบผิดข้อแรกของแต่ละหมวดไม่เสียเลือด",
       "The first mistake in each category costs you nothing.",
       "每个题型第一次答错不掉血。"),
    sk("active", "vent", "มือนิ่ง", "Steady Hand", "稳定之手",
       "เพิ่มเวลาตอบให้ตัวเอง 5 วินาที",
       "Five more seconds on your own clock.",
       "自己的作答时间 +5 秒。"),
    sk("ultimate", "halo", "เพลงกล่อม", "Lullaby", "摇篮曲",
       "คู่ต่อสู้เหลือเวลาตอบเพียง 70% เป็นเวลา 3 ข้อ",
       "Your opponent gets only 70% of the clock for three questions.",
       "三题内对手只有 70% 的作答时间。") ] },
  meridian: { cls: "herald", skills: [
    sk("passive", "eye", "เข้าอกเข้าใจ", "Empathy", "共情",
       "เมื่อเลือดต่ำกว่า 30% ซิงค์ที่ได้เป็นสองเท่า",
       "Below 30% health you gain sync twice as fast.",
       "血量低于 30% 时同步值获取翻倍。"),
    sk("active", "coil", "ปลุกให้ตื่นรู้", "Awaken", "觉醒",
       "ดาเมจครั้งถัดไปคิดตามซิงค์ที่สะสมไว้",
       "Your next hit scales with the sync you have banked.",
       "下一次伤害按已累积的同步值计算。"),
    sk("ultimate", "burst", "การลุกขึ้น", "Uprising", "起义",
       "เปลี่ยนซิงค์ทั้งหมดเป็นดาเมจทันที",
       "Convert all sync into damage at once.",
       "立即将全部同步值转化为伤害。") ] },

  /* ── VIRTUOSI ── they win by playing better */
  halcyon: { cls: "virtuoso", skills: [
    sk("passive", "halo", "เสียงประสานสงบ", "Calm Chorus", "宁静和声",
       "ซิงค์ไม่รีเซ็ตเมื่อคุณตอบผิด",
       "A wrong answer no longer resets your sync.",
       "答错不会重置你的同步值。"),
    sk("active", "keytar", "ประสานเสียง", "Harmony", "和声",
       "ตอบถูกคำถามคอร์ดหรือสเกล ฟื้นเลือด 8%",
       "Answer a chord or scale question right and heal 8%.",
       "答对和弦或音阶题恢复 8% 生命。"),
    sk("ultimate", "burst", "เคเดนซ์ปิดท้าย", "Grand Cadence", "终止式",
       "ปิดยกด้วยดาเมจที่คิดจากซิงค์สะสมทั้งหมด",
       "Close the round with damage drawn from all your banked sync.",
       "以全部同步值结算伤害收尾。") ] },
  aurora: { cls: "virtuoso", skills: [
    sk("passive", "halo", "ออร่าบนเวที", "Stage Presence", "舞台气场",
       "ตอบถูกติดกันสะสมแสง — ทุก 3 ครั้ง ดาเมจ +15%",
       "Every third right answer in a row adds 15% damage.",
       "每连续答对三题伤害 +15%。"),
    sk("active", "speaker", "ท่อนฮุกซ้ำ", "Encore Hook", "安可副歌",
       "ใช้ผลของทักษะล่าสุดของคุณซ้ำอีกครั้ง",
       "Repeat the effect of the last skill you used.",
       "重复你上一个使用的技能效果。"),
    sk("ultimate", "burst", "ออโรร่าฟินาเล่", "Aurora Finale", "极光终章",
       "ดาเมจใหญ่ครั้งเดียว และฟื้นเลือด 15%",
       "One large hit, and 15% health back.",
       "一次大型伤害，并回复 15% 生命。") ] },
};

/* the class a chassis belongs to, for anything that just needs the label */
export function classOf(model) {
  const e = MODEL_SKILLS[model];
  return (e && MODEL_CLASS[e.cls]) || MODEL_CLASS.striker;
}
// the class KEY, for anything that needs to branch on the class rather than
// display it — the avatar picks its shoulder crest off this
export function classKeyOf(model) {
  const e = MODEL_SKILLS[model];
  return (e && MODEL_CLASS[e.cls]) ? e.cls : "striker";
}
export function skillsOf(model) {
  const e = MODEL_SKILLS[model];
  return (e && e.skills) || [];
}
