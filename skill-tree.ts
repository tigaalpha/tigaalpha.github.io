/* Skill careers for robots and pets (owner, 2026-10-11: "every robot class is a career with its own skill line, at least 10 skills per
   robot, pets too; every skill has its own special effect and sound effect; skills can be upgraded").
   Pure data + small pure functions, no React, no storage except the two small helpers at the bottom (levels and the equipped slots).
   A skill is one row: [archetype, power, range-or-count, cooldown, th, en, zh]. The ARCHETYPE says what it does (a volley, a nova, a dash, a
   shield ...); the numbers, the name and the id-derived look and sound make each skill its own. 7 robot classes x 10 + 6 pet elements x 10.
   Robot skill n opens at class rank n (rank 1..10, the same Skill EXP the class already earns); pet skill n opens at pet level n.
   Levels 1..5 are bought with crystals (earned by playing, never sold). */
export type Arch = "volley" | "nova" | "dash" | "shield" | "heal" | "haste" | "slow" | "stun" | "chain" | "drain" | "meteor" | "turret" | "execute"
  | "p_atk" | "p_hp" | "p_crit" | "p_regen" | "p_cdr" | "p_speed" | "p_steal" | "p_guard" | "p_loot" | "p_xp";
export type Skill = { id: string; a: Arch; p: number; r: number; cd: number; n: { th: string; en: string; zh: string }; idx: number; owner: string; kind: "robot" | "pet" };
type Row = [Arch, number, number, number, string, string, string];
export const isPassive = (a: string) => a.startsWith("p_");
export const SKILL_MAX_LV = 5;
export const skillCost = (lv: number) => 8 * (lv + 1);   // crystals for level lv -> lv+1: 16, 24, 32, 40 (a skill starts at level 1 when its rank opens)
const R = (a: Arch, p: number, r: number, cd: number, th: string, en: string, zh: string): Row => [a, p, r, cd, th, en, zh];

const ROBOT: Record<string, Row[]> = {
  striker: [
    R("volley", 0.55, 3, 5, "ยิงรัวสามนัด", "Rapid Burst", "三连爆发"), R("dash", 1.8, 260, 6, "พุ่งแทง", "Lunge", "突刺冲锋"), R("p_atk", 0.04, 0, 0, "กระหายเลือด", "Bloodlust", "嗜血"),
    R("nova", 2.4, 200, 7, "คลื่นกระแทก", "Shockwave", "冲击波"), R("execute", 3.2, 420, 8, "ปิดฉาก", "Finisher", "终结一击"), R("p_crit", 0.02, 0, 0, "สัญชาตญาณนักล่า", "Killer Instinct", "猎杀本能"),
    R("chain", 1.6, 4, 8, "ฟันสายฟ้า", "Arc Slash", "电弧斩"), R("meteor", 2.2, 3, 12, "ค้อนจากวงโคจร", "Orbital Hammer", "轨道重锤"), R("p_steal", 0.02, 0, 0, "คมดูดเลือด", "Vampiric Edge", "吸血之刃"),
    R("nova", 5, 340, 16, "มหาวินาศคลั่ง", "Berserker Cataclysm", "狂战灾变")],
  bulwark: [
    R("shield", 2.2, 0, 8, "ป้อมปราการ", "Bastion", "壁垒"), R("stun", 1.2, 170, 8, "กระแทกโล่", "Shield Bash", "盾击"), R("p_guard", 0.03, 0, 0, "เกราะหนา", "Plating", "加厚装甲"),
    R("heal", 0.2, 0, 10, "ซ่อมสนาม", "Field Repair", "战地修复"), R("p_hp", 0.05, 0, 0, "ป้อมเหล็ก", "Fortress", "钢铁要塞"), R("stun", 1.8, 260, 11, "กดแรงโน้มถ่วง", "Gravity Slam", "重力猛击"),
    R("slow", 3.5, 300, 10, "กับดักแม่เหล็ก", "Magnetic Trap", "磁力陷阱"), R("shield", 3.5, 0, 14, "อีจิส", "Aegis", "神盾"), R("p_regen", 0.004, 0, 0, "ใยนาโน", "Nano-Weave", "纳米织网"),
    R("nova", 3.5, 300, 15, "แผ่นดินไหวไททัน", "Titan Quake", "泰坦震地")],
  ghost: [
    R("dash", 1.2, 320, 5, "ก้าวเงา", "Shadow Step", "暗影步"), R("volley", 0.4, 5, 6, "เข็มพายุฝน", "Needle Rain", "飞针暴雨"), R("p_crit", 0.025, 0, 0, "จุดบอด", "Blindspot", "视觉盲点"),
    R("shield", 1.8, 0, 9, "เสื้อคลุมเฟส", "Phase Cloak", "相位披风"), R("execute", 3.6, 460, 9, "ลอบสังหาร", "Assassinate", "暗杀"), R("p_speed", 0.04, 0, 0, "วิ่งเงียบ", "Silent Run", "无声疾行"),
    R("chain", 1.4, 5, 9, "สายผี", "Ghost Wire", "幽灵线"), R("drain", 1.6, 240, 11, "ดูดวิญญาณ", "Soul Siphon", "灵魂虹吸"), R("p_atk", 0.04, 0, 0, "จดจ่อสังหาร", "Lethal Focus", "致命专注"),
    R("meteor", 2.4, 6, 17, "ห่ากระสุนคราส", "Eclipse Barrage", "日蚀弹幕")],
  tactician: [
    R("slow", 3, 340, 8, "สแกนและมาร์ก", "Scan & Mark", "扫描标记"), R("volley", 0.6, 4, 6, "ยิงแม่นยำ", "Precision Salvo", "精确齐射"), R("p_cdr", 0.03, 0, 0, "คำนวณไว้แล้ว", "Calculated", "运筹帷幄"),
    R("execute", 3.4, 520, 9, "ล็อกเป้า", "Target Lock", "目标锁定"), R("stun", 1.4, 280, 10, "แฟลช EMP", "EMP Flash", "电磁脉冲"), R("p_crit", 0.02, 0, 0, "จุดอ่อน", "Weak Point", "弱点洞察"),
    R("meteor", 2.4, 4, 13, "โจมตีวงโคจร", "Orbital Strike", "轨道打击"), R("haste", 5, 0, 14, "ปลุกโอเวอร์คล็อก", "Overclock Tactics", "超频战术"), R("p_xp", 0.05, 0, 0, "วิเคราะห์การรบ", "Combat Analytics", "战斗分析"),
    R("chain", 2, 7, 15, "ใยสังหาร", "Kill Web", "杀戮之网")],
  engineer: [
    R("turret", 6, 0.35, 12, "ป้อมอัตโนมัติ", "Auto-Turret", "自动炮塔"), R("heal", 0.18, 0, 9, "โดรนซ่อม", "Repair Drone", "维修无人机"), R("p_regen", 0.004, 0, 0, "ซ่อมตัวเอง", "Self-Repair", "自我修复"),
    R("slow", 3.5, 280, 9, "โฟมหน่วง", "Foam Sprayer", "泡沫喷射"), R("turret", 8, 0.5, 15, "ป้อมคู่", "Twin Turrets", "双联炮塔"), R("p_loot", 0.06, 0, 0, "สิทธิ์เก็บซาก", "Salvage Rights", "回收权"),
    R("shield", 3, 0, 13, "สนามพลัง", "Force Field", "力场"), R("volley", 0.7, 6, 9, "จรวดฝัก", "Rocket Pods", "火箭巢"), R("p_hp", 0.05, 0, 0, "โครงเสริมแรง", "Reinforced Frame", "强化骨架"),
    R("heal", 0.55, 0, 18, "ยกเครื่อง", "Overhaul", "全面检修")],
  herald: [
    R("heal", 0.2, 0, 8, "คอร์ดเยียวยา", "Healing Chord", "治愈和弦"), R("haste", 5, 0, 11, "เร่งจังหวะ", "Tempo Up", "加速节拍"), R("p_cdr", 0.03, 0, 0, "เสียงก้อง", "Resonance", "共鸣"),
    R("shield", 3, 0, 12, "โล่ประสาน", "Harmony Ward", "和谐护盾"), R("nova", 2, 260, 7, "คลื่นเสียง", "Sonic Wave", "音波"), R("p_xp", 0.05, 0, 0, "เสียงอาจารย์", "Mentor's Voice", "导师之声"),
    R("slow", 4, 320, 10, "เสียงขัด", "Dissonance", "不和谐音"), R("haste", 7, 0, 16, "ครีเชนโด", "Crescendo", "渐强"), R("p_loot", 0.06, 0, 0, "โชคผู้อุปถัมภ์", "Patron's Luck", "赞助者之运"),
    R("heal", 0.6, 0, 20, "เพลงแห่งชีวิต", "Anthem of Life", "生命赞歌")],
  virtuoso: [
    R("nova", 2.2, 220, 6, "คอร์ดเมเจอร์", "Major Chord", "大三和弦"), R("chain", 1.5, 4, 7, "อาร์เพจจิโอ", "Arpeggio", "琶音"), R("p_atk", 0.04, 0, 0, "หูสัมบูรณ์", "Perfect Pitch", "绝对音感"),
    R("volley", 0.5, 5, 6, "สแตกคาโต", "Staccato", "断音"), R("stun", 1.5, 260, 10, "เฟอร์มาตา", "Fermata", "延长记号"), R("p_speed", 0.04, 0, 0, "อัลเลโกร", "Allegro", "快板"),
    R("meteor", 2.3, 5, 13, "คาเดนซา", "Cadenza", "华彩乐段"), R("drain", 1.7, 260, 11, "เสียงสะท้อนดูด", "Resonant Drain", "共振汲取"), R("p_crit", 0.025, 0, 0, "ฝีมือเอก", "Virtuosity", "精湛技艺"),
    R("nova", 5, 360, 17, "ซิมโฟนีฟอร์ติสซิโม", "Fortissimo Symphony", "强音交响曲")],
};
const PET: Record<string, Row[]> = {
  volt: [
    R("chain", 1.0, 3, 7, "ไฟช็อตต่อเนื่อง", "Chain Zap", "连锁电击"), R("p_cdr", 0.02, 0, 0, "ประจุไฟ", "Static Charge", "静电充能"), R("stun", 1, 200, 9, "ช็อตชา", "Paralysing Jolt", "麻痹电击"),
    R("volley", 0.35, 4, 6, "ลูกบอลสายฟ้า", "Spark Orbs", "电光球"), R("p_speed", 0.03, 0, 0, "ขาเร็วฟ้าแลบ", "Lightning Legs", "闪电之足"), R("nova", 1.8, 220, 9, "พัลส์ไฟฟ้า", "Voltage Pulse", "电压脉冲"),
    R("haste", 4, 0, 12, "ไฟกระชาก", "Surge", "电涌"), R("p_crit", 0.015, 0, 0, "ประกายคม", "Sharp Spark", "锐利电火花"), R("meteor", 2, 3, 13, "ฟ้าผ่าลงพื้น", "Thunder Strike", "落雷"), R("nova", 3.5, 320, 16, "พายุสายฟ้า", "Thunderstorm", "雷暴")],
  ember: [
    R("volley", 0.4, 3, 6, "ลูกไฟ", "Fireballs", "火球"), R("p_atk", 0.03, 0, 0, "ไฟในใจ", "Inner Flame", "心火"), R("nova", 1.8, 210, 8, "ระเบิดเพลิง", "Flame Burst", "烈焰爆发"),
    R("drain", 1.2, 220, 10, "เผาผลาญ", "Burning Touch", "灼烧之触"), R("p_steal", 0.015, 0, 0, "ไอร้อนดูดพลัง", "Heat Siphon", "热能汲取"), R("meteor", 2.2, 3, 12, "ฝนอุกกาบาตไฟ", "Fire Rain", "火雨"),
    R("slow", 3, 260, 9, "ควันหนา", "Smoke Screen", "烟幕"), R("p_regen", 0.003, 0, 0, "ถ่านร้อน", "Warm Embers", "余烬之暖"), R("chain", 1.4, 4, 11, "เปลวไฟต่อกัน", "Wildfire", "野火蔓延"), R("nova", 3.8, 330, 17, "ฟีนิกซ์ระเบิด", "Phoenix Blast", "凤凰爆")],
  frost: [
    R("slow", 4, 300, 8, "ลมเยือกแข็ง", "Frost Breath", "寒冰吐息"), R("p_guard", 0.02, 0, 0, "ขนน้ำแข็ง", "Icy Coat", "冰霜皮毛"), R("stun", 1.4, 220, 10, "แช่แข็ง", "Deep Freeze", "深度冻结"),
    R("volley", 0.4, 4, 6, "เสี้ยนน้ำแข็ง", "Ice Shards", "冰锥"), R("p_hp", 0.03, 0, 0, "ใจเย็น", "Cool Heart", "冷静之心"), R("shield", 2.2, 0, 11, "เกราะน้ำแข็ง", "Crystal Armour", "水晶铠甲"),
    R("nova", 2, 240, 9, "คลื่นหิมะ", "Snow Wave", "雪浪"), R("p_cdr", 0.02, 0, 0, "หนาวนิ่ง", "Stillness", "寂静"), R("meteor", 2.1, 4, 13, "ลูกเห็บยักษ์", "Hailstorm", "冰雹"), R("stun", 2.4, 340, 17, "ยุคน้ำแข็ง", "Ice Age", "冰河时代")],
  flora: [
    R("heal", 0.12, 0, 8, "กลีบเยียวยา", "Petal Heal", "花瓣治愈"), R("p_regen", 0.003, 0, 0, "รากฟื้นฟู", "Root Renewal", "根系复苏"), R("slow", 3.5, 260, 9, "เถาพันเท้า", "Vine Snare", "藤蔓缠绕"),
    R("volley", 0.35, 5, 6, "ลูกดอกหนาม", "Thorn Darts", "荆棘镖"), R("p_loot", 0.05, 0, 0, "ผลไม้โชคดี", "Lucky Fruit", "幸运果实"), R("drain", 1.2, 240, 10, "ดูดน้ำหวาน", "Nectar Drain", "花蜜汲取"),
    R("shield", 2.4, 0, 11, "เปลือกไม้", "Bark Shield", "树皮护盾"), R("p_xp", 0.04, 0, 0, "ปัญญาป่า", "Forest Wisdom", "森林智慧"), R("stun", 1.2, 240, 11, "สปอร์หลับ", "Sleep Spores", "催眠孢子"), R("heal", 0.45, 0, 18, "ฤดูใบไม้ผลิ", "Spring Bloom", "春之绽放")],
  steel: [
    R("shield", 2, 0, 9, "ผนึกเหล็ก", "Iron Guard", "钢铁守护"), R("p_guard", 0.03, 0, 0, "ลำตัวเหล็กกล้า", "Steel Body", "钢铁之躯"), R("stun", 1.2, 200, 9, "กระแทกหนัก", "Heavy Slam", "沉重冲击"),
    R("volley", 0.5, 3, 6, "กระสุนโลหะ", "Slug Shots", "金属弹"), R("p_atk", 0.03, 0, 0, "คมเขี้ยวเหล็ก", "Steel Fangs", "钢牙"), R("nova", 2.2, 220, 9, "ระเบิดสะเก็ด", "Shrapnel Burst", "破片爆发"),
    R("turret", 5, 0.3, 12, "ป้อมจิ๋ว", "Mini Turret", "迷你炮塔"), R("p_hp", 0.04, 0, 0, "โครงแข็ง", "Hardened Frame", "硬化框架"), R("meteor", 2.2, 3, 13, "ค้อนตกจากฟ้า", "Falling Anvil", "天降铁砧"), R("shield", 4, 0, 16, "ปราการเหล็ก", "Iron Bastion", "钢铁堡垒")],
  aether: [
    R("volley", 0.4, 4, 6, "ประกายดารา", "Star Motes", "星屑"), R("p_xp", 0.05, 0, 0, "สายตาแห่งดารา", "Starlit Insight", "星辉洞察"), R("haste", 4, 0, 11, "คลื่นเวลา", "Time Ripple", "时间涟漪"),
    R("chain", 1.3, 4, 8, "แสงโยงใย", "Light Web", "光之织网"), R("p_cdr", 0.025, 0, 0, "กาลเวลาไหล", "Flowing Time", "流转时光"), R("heal", 0.2, 0, 10, "แสงโอบกอด", "Embracing Light", "光之拥抱"),
    R("slow", 4, 320, 10, "ม่านหมอก", "Veil of Mist", "迷雾帷幕"), R("p_crit", 0.02, 0, 0, "ดวงดาวเป็นใจ", "Fortune Star", "幸运星"), R("meteor", 2.3, 4, 13, "ฝนดาวตก", "Meteor Shower", "流星雨"), R("nova", 4, 330, 17, "มหานวดารา", "Supernova", "超新星")],
};

const build = (tab: Record<string, Row[]>, kind: "robot" | "pet"): Record<string, Skill[]> => {
  const o: Record<string, Skill[]> = {};
  for (const k of Object.keys(tab)) o[k] = tab[k].map((r, i) => ({ id: kind[0] + "_" + k + "_" + (i + 1), a: r[0], p: r[1], r: r[2], cd: r[3], n: { th: r[4], en: r[5], zh: r[6] }, idx: i + 1, owner: k, kind }));
  return o;
};
export const ROBOT_TREE = build(ROBOT, "robot");
export const PET_TREE = build(PET, "pet");
export const treeOf = (kind: "robot" | "pet", owner: string): Skill[] => ((kind === "robot" ? ROBOT_TREE : PET_TREE)[owner]) || [];

/* ── what a skill is worth at a level ── */
export const powerAt = (s: Skill, lv: number) => s.p * (isPassive(s.a) ? Math.max(1, lv) : 1 + 0.15 * (Math.max(1, lv) - 1));
export const cdAt = (s: Skill, lv: number) => s.cd * (1 - 0.04 * (Math.max(1, lv) - 1));

/* ── the look and the sound of a skill come from its id, so no two skills share all of it ── */
const hashOf = (s: string) => String(s).split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 7) >>> 0;
export function skillLook(s: Skill) { const h = hashOf(s.id); return { style: h % 5, hue: (h >> 3) % 360, spin: ((h >> 7) % 2) ? 1 : -1, n: 10 + ((h >> 9) % 14), sparkle: (h >> 13) % 3 }; }
export function skillSound(s: Skill) { const h = hashOf(s.id); return { h, pitch: 0.7 + (h % 13) * 0.06, bright: (h >> 4) % 3, wave: (["sine", "triangle", "square", "sawtooth"] as const)[(h >> 6) % 4] }; }

/* ── descriptions, built from the archetype and the real numbers ── */
export function skillDesc(s: Skill, lv: number, lang: string): string {
  const p = powerAt(s, lv), t = (th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en), pc = (v: number) => Math.round(v * 100) + "%", r = Math.round(s.r);
  switch (s.a) {
    case "volley": return t(`ยิง ${r} นัด นัดละ ${pc(p)} ของดาเมจ`, `Fires ${r} bolts at ${pc(p)} damage each`, `发射 ${r} 发，每发 ${pc(p)} 伤害`);
    case "nova": return t(`คลื่นรอบตัว รัศมี ${r} ดาเมจ ${pc(p)}`, `A ring around you, radius ${r}, ${pc(p)} damage`, `周身冲击环，半径 ${r}，${pc(p)} 伤害`);
    case "dash": return t(`พุ่งไป ${r} ฟันทุกตัวที่ผ่าน ${pc(p)}`, `Dash ${r} forward, cutting everything for ${pc(p)}`, `前冲 ${r}，路径上敌人受 ${pc(p)} 伤害`);
    case "shield": return t(`อมตะ ${p.toFixed(1)} วินาที`, `Invulnerable for ${p.toFixed(1)} s`, `${p.toFixed(1)} 秒无敌`);
    case "heal": return t(`ฟื้นเลือด ${pc(p)}`, `Restores ${pc(p)} of your health`, `恢复 ${pc(p)} 生命`);
    case "haste": return t(`เคลื่อนที่และโจมตีไวขึ้น ${p.toFixed(1)} วินาที`, `Faster moving and attacking for ${p.toFixed(1)} s`, `${p.toFixed(1)} 秒内移动与攻击加速`);
    case "slow": return t(`ศัตรูในรัศมี ${r} ช้าลง ${p.toFixed(1)} วินาที`, `Slows enemies within ${r} for ${p.toFixed(1)} s`, `${r} 范围内敌人减速 ${p.toFixed(1)} 秒`);
    case "stun": return t(`ศัตรูในรัศมี ${r} ชะงัก ${p.toFixed(1)} วินาที`, `Stuns enemies within ${r} for ${p.toFixed(1)} s`, `${r} 范围内敌人眩晕 ${p.toFixed(1)} 秒`);
    case "chain": return t(`ฟ้าผ่าต่อกัน ${r} เป้า ดาเมจ ${pc(p)}`, `Lightning jumps through ${r} foes for ${pc(p)}`, `闪电连锁 ${r} 个目标，${pc(p)} 伤害`);
    case "drain": return t(`ดูดเลือดศัตรูในรัศมี ${r} ${pc(p)} แล้วฟื้นให้ตัวเอง`, `Drains foes within ${r} for ${pc(p)} and heals you`, `汲取 ${r} 范围敌人 ${pc(p)} 并回血`);
    case "meteor": return t(`เรียกอุกกาบาต ${r} ลูกใส่ศัตรู ${pc(p)}`, `Calls ${r} meteors on foes for ${pc(p)} each`, `召唤 ${r} 颗陨石，每颗 ${pc(p)}`);
    case "turret": return t(`วางป้อมอัตโนมัติ ${p.toFixed(0)} วินาที`, `Deploys an auto-turret for ${p.toFixed(0)} s`, `部署自动炮塔 ${p.toFixed(0)} 秒`);
    case "execute": return t(`ฟาดศัตรูที่เลือดน้อยสุด ${pc(p)} (แรงสองเท่าถ้าต่ำกว่า 40%)`, `Strikes the weakest foe for ${pc(p)} (double under 40% health)`, `重击最虚弱敌人 ${pc(p)}（低于 40% 生命翻倍）`);
    case "p_atk": return t(`ดาเมจ +${pc(p)}`, `+${pc(p)} damage`, `伤害 +${pc(p)}`);
    case "p_hp": return t(`เลือดสูงสุด +${pc(p)}`, `+${pc(p)} max health`, `最大生命 +${pc(p)}`);
    case "p_crit": return t(`โอกาสคริ +${pc(p)}`, `+${pc(p)} crit chance`, `暴击率 +${pc(p)}`);
    case "p_regen": return t(`ฟื้นเลือด ${(p * 100).toFixed(1)}% ต่อวินาที`, `Regenerates ${(p * 100).toFixed(1)}% health per second`, `每秒恢复 ${(p * 100).toFixed(1)}% 生命`);
    case "p_cdr": return t(`คูลดาวน์สกิล −${pc(p)}`, `Skill cooldowns −${pc(p)}`, `技能冷却 −${pc(p)}`);
    case "p_speed": return t(`วิ่งเร็ว +${pc(p)}`, `+${pc(p)} move speed`, `移速 +${pc(p)}`);
    case "p_steal": return t(`ดูดเลือด ${pc(p)} ของดาเมจ`, `Heals ${pc(p)} of damage dealt`, `吸血 ${pc(p)} 伤害`);
    case "p_guard": return t(`ลดดาเมจที่ได้รับ ${pc(p)}`, `Takes ${pc(p)} less damage`, `受到伤害 −${pc(p)}`);
    case "p_loot": return t(`คริสตัลที่เก็บได้ +${pc(p)}`, `+${pc(p)} crystals collected`, `水晶收益 +${pc(p)}`);
    default: return t(`EXP +${pc(p)}`, `+${pc(p)} EXP`, `经验 +${pc(p)}`);
  }
}

/* ── the passives, added up: the numbers the run actually uses ── */
export function passiveSum(skills: { s: Skill; lv: number }[]) {
  const o = { atk: 0, hp: 0, crit: 0, regen: 0, cdr: 0, speed: 0, steal: 0, guard: 0, loot: 0, xp: 0 };
  for (const { s, lv } of skills) if (isPassive(s.a) && lv > 0) (o as any)[s.a.slice(2)] += powerAt(s, lv);
  o.cdr = Math.min(0.4, o.cdr); o.guard = Math.min(0.5, o.guard); o.steal = Math.min(0.2, o.steal); o.crit = Math.min(0.3, o.crit);
  return o;
}

/* ── storage: levels (0 = locked/unbought -> 1 on unlock), equipped slots (3 robot actives, 2 pet actives) ── */
const LV_KEY = "tg_skl_lv", EQ_KEY = "tg_skl_eq";
export const readSkillLv = (): Record<string, number> => { try { const v = JSON.parse(localStorage.getItem(LV_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
export const lvOf = (id: string) => Math.max(1, Math.min(SKILL_MAX_LV, readSkillLv()[id] | 0 || 1));
export function buySkillLv(id: string, crystals: number): { ok: boolean; cost: number } {
  const all = readSkillLv(), lv = Math.max(1, all[id] | 0 || 1); if (lv >= SKILL_MAX_LV) return { ok: false, cost: 0 };
  const cost = skillCost(lv); if (crystals < cost) return { ok: false, cost };
  try { all[id] = lv + 1; localStorage.setItem(LV_KEY, JSON.stringify(all)); return { ok: true, cost }; } catch (e) { return { ok: false, cost }; }
}
export const readEquip = (): { robot: string[]; pet: string[] } => { try { const v = JSON.parse(localStorage.getItem(EQ_KEY) || "{}") || {}; return { robot: Array.isArray(v.robot) ? v.robot : [], pet: Array.isArray(v.pet) ? v.pet : [] }; } catch (e) { return { robot: [], pet: [] }; } };
export function toggleEquip(kind: "robot" | "pet", id: string): boolean {
  const e = readEquip(), cap = kind === "robot" ? 3 : 2, list = e[kind].filter(x => x !== id), had = list.length !== e[kind].length;
  if (!had) { if (list.length >= cap) list.shift(); list.push(id); }
  e[kind] = list; try { localStorage.setItem(EQ_KEY, JSON.stringify(e)); return !had; } catch (er) { return had; }
}
/** the equipped actives, filled up with the first unlocked active skills when the player has chosen nothing */
export function equippedOf(kind: "robot" | "pet", owner: string, rank: number): Skill[] {
  const tree = treeOf(kind, owner), cap = kind === "robot" ? 3 : 2, open = (s: Skill) => s.idx <= rank && !isPassive(s.a);
  const chosen = readEquip()[kind].map(id => tree.find(s => s.id === id)).filter((s): s is Skill => !!s && open(s));
  if (chosen.length) return chosen.slice(0, cap);
  return tree.filter(open).slice(0, cap);
}
